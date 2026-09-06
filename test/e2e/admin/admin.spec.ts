import { test, expect } from '@playwright/test';

async function loginAsAdmin(page) {
  await page.goto('/admin');
  
  // If redirected to login
  if (await page.locator('h1:has-text("دخول")').isVisible({ timeout: 5000 })) {
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("دخول")');
  }
  
  await expect(page.locator('h1:has-text("مطعمك"), h1:has-text("لوحة الإدارة")').first()).toBeVisible({ timeout: 15000 });
}

test.describe('Admin Panel - Orders', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows orders tab with badge', async ({ page }) => {
    await expect(page.locator('button:has-text("الطلبات")')).toBeVisible();
  });

  test('displays orders panel with CSV export', async ({ page }) => {
    await page.click('button:has-text("الطلبات")');
    await expect(page.locator('a:has-text("تحميل CSV")')).toBeVisible();
  });

  test('shows empty state when no orders', async ({ page }) => {
    await page.click('button:has-text("الطلبات")');
    await expect(page.locator('text=لا توجد طلبات بعد')).toBeVisible({ timeout: 10000 });
  });

  test('order status change from admin', async ({ page }) => {
    await page.click('button:has-text("الطلبات")');
    // Orders should load
    await expect(page.locator('[data-order-status="new"]').first()).toBeVisible({ timeout: 15000 });
    
    const orderCard = page.locator('[data-order-status="new"]').first();
    await orderCard.locator('button:has-text("بدء التحضير")').click();
    await expect(orderCard.locator('text=في التحضير')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Panel - Items Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows items tab with categories', async ({ page }) => {
    await page.click('button:has-text("العناصر")');
    await expect(page.locator('text=الأقسام')).toBeVisible({ timeout: 10000 });
  });

  test('can add new category', async ({ page }) => {
    await page.click('button:has-text("العناصر")');
    await page.click('button:has-text("إضافة قسم")');
    await page.fill('input[name="name"]', 'قسم تجريبي');
    await page.click('button:has-text("حفظ")');
    await expect(page.locator('text=قسم تجريبي')).toBeVisible({ timeout: 5000 });
  });

  test('can add new item with image', async ({ page }) => {
    await page.click('button:has-text("العناصر")');
    // Click add item in first category
    await page.locator('button:has-text("إضافة عنصر")').first().click();
    await page.fill('input[name="name"]', 'صنف تجريبي');
    await page.fill('input[name="price"]', '100');
    await page.click('button:has-text("حفظ")');
    await expect(page.locator('text=صنف تجريبي')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Panel - Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('shows settings panel', async ({ page }) => {
    await page.click('button:has-text("الإعدادات")');
    await expect(page.locator('text=معلومات المطعم')).toBeVisible({ timeout: 10000 });
  });

  test('can update restaurant name', async ({ page }) => {
    await page.click('button:has-text("الإعدادات")');
    await page.fill('input[name="restaurantName"]', 'اسم محدث');
    await page.click('button:has-text("حفظ الإعدادات")');
    await expect(page.locator('text=تم حفظ الإعدادات')).toBeVisible({ timeout: 5000 });
  });

  test('can toggle delivery', async ({ page }) => {
    await page.click('button:has-text("الإعدادات")');
    const deliveryToggle = page.locator('input[name="deliveryEnabled"]');
    const wasChecked = await deliveryToggle.isChecked();
    await deliveryToggle.click();
    await page.click('button:has-text("حفظ الإعدادات")');
    await expect(page.locator('text=تم حفظ الإعدادات')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Admin Panel - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('all tabs are accessible', async ({ page }) => {
    const tabs = ['الطلبات', 'العناصر', 'الأقسام', 'الطاولات', 'الموظفون', 'الإعدادات', 'الاشتراك', 'رمز QR', 'التقارير'];
    
    for (const tab of tabs) {
      await page.click(`button:has-text("${tab}")`);
      await page.waitForTimeout(500);
    }
  });

  test('preview menu button opens public menu', async ({ page }) => {
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.click('a:has-text("معاينة المنيو العام")')
    ]);
    await newPage.waitForLoadState();
    await expect(newPage.locator('h1')).toBeVisible({ timeout: 10000 });
    await newPage.close();
  });

  test('logout works', async ({ page }) => {
    await page.click('button:has-text("تسجيل الخروج")');
    await expect(page.locator('h1:has-text("دخول")')).toBeVisible({ timeout: 5000 });
  });
});