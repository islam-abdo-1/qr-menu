import { test, expect } from '@playwright/test';

async function loginAsStaff(page, slug = 'kafy', name = 'أحمد', pin = '1234') {
  await page.goto(`/staff/${slug}`);
  await page.fill('input[placeholder="اسمك"]', name);
  await page.fill('input[placeholder="الكود السري (4 أرقام)"]', pin);
  await page.click('button:has-text("دخول")');
  await expect(page.locator('text=طلبات').first()).toBeVisible({ timeout: 15000 });
}

async function createTestOrder(page, slug = 'kafy', options = {}) {
  const { type = 'dine-in', tableNo = '1', items = 1 } = options;
  
  await page.goto(`/m/${slug}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
  
  // Add items to cart
  for (let i = 0; i < items; i++) {
    const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
    if (await addButtons.first().isVisible()) {
      await addButtons.first().click();
      await page.waitForTimeout(500);
    }
  }
  
  // Open cart and checkout
  await page.locator('button:has-text("عرض السلة"), button:has-text("إتمام الطلب")').first().click();
  await expect(page.locator('[data-cart-drawer]')).toBeVisible({ timeout: 5000 });
  
  await page.fill('input[name="customerName"]', `عميل-${Date.now()}`);
  
  if (type === 'dine-in') {
    await page.selectOption('select[name="tableNo"]', tableNo);
  } else {
    await page.locator('input[value="delivery"]').click();
    await page.fill('input[name="phone"]', '01012345678');
    await page.fill('textarea[name="address"]', 'عنوان تجريبي');
  }
  
  await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
  await expect(page.locator('text=تم إنشاء الطلب'), { timeout: 10000 }).toBeVisible();
}

test.describe('Staff Panel - Orders Flow', () => {
  test('order appears in real-time via polling', async ({ page }) => {
    await loginAsStaff(page);
    
    // Create order in another tab
    const orderPage = await page.context().newPage();
    await createTestOrder(orderPage);
    await orderPage.close();
    
    // Wait for polling to pick it up (max 15s)
    await expect(page.locator('text=طلب جديد — رقم')).toBeVisible({ timeout: 20000 });
  });

  test('order status transition: new -> preparing -> done', async ({ page }) => {
    await loginAsStaff(page);
    await createTestOrder(page);
    
    // Wait for order card
    const orderCard = page.locator('[data-order-status="new"]').first();
    await expect(orderCard).toBeVisible({ timeout: 15000 });
    
    // Click "بدء التحضير"
    await orderCard.locator('button:has-text("بدء التحضير")').click();
    await expect(orderCard.locator('text=في التحضير')).toBeVisible({ timeout: 5000 });
    
    // Click "تم التسليم"
    await orderCard.locator('button:has-text("تم التسليم")').click();
    await expect(orderCard.locator('text=تم التسليم')).toBeVisible({ timeout: 5000 });
    await expect(orderCard.locator('text=تم التسليم في')).toBeVisible();
  });

  test('order details dialog shows images and prices', async ({ page }) => {
    await loginAsStaff(page);
    await createTestOrder(page, 'kafy', { items: 1 });
    
    const orderCard = page.locator('[data-order-status="new"]').first();
    await orderCard.locator('button:has-text("تفاصيل الطلب")').click();
    
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('img[src*="/api/image"]').first()).toBeVisible(); // Image via proxy
    await expect(page.locator('text=إجمالي الطلب')).toBeVisible();
    await expect(page.locator('text=تفاصيل الطلب رقم')).toBeVisible();
  });

  test('manual refresh button works', async ({ page }) => {
    await loginAsStaff(page);
    await createTestOrder(page);
    
    // Wait for order
    await expect(page.locator('[data-order-status="new"]').first()).toBeVisible({ timeout: 15000 });
    
    // Click refresh
    await page.click('button[aria-label="تحديث"]');
    await expect(page.locator('[data-order-status="new"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('session lost banner appears and allows re-login', async ({ page }) => {
    await loginAsStaff(page);
    
    // Simulate session expiry by clearing cookies
    await page.context().clearCookies();
    
    // Wait for polling to detect session loss (max 25s)
    await expect(page.locator('text=انتهت الجلسة')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('button:has-text("إعادة الدخول")')).toBeVisible();
    
    // Click re-login
    await page.click('button:has-text("إعادة الدخول")');
    await expect(page.locator('h1:has-text("شاشة الموظفين")')).toBeVisible();
  });

  test('logout works', async ({ page }) => {
    await loginAsStaff(page);
    
    await page.click('button[aria-label="خروج"]');
    await expect(page.locator('h1:has-text("شاشة الموظفين")')).toBeVisible({ timeout: 5000 });
  });
});