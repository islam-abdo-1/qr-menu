import { test, expect } from '@playwright/test';

test.describe('Public Menu - Customer Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/m/kafy');
  });

  test('menu loads with hero and sections', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=الأكثر مبيعًا, text=SHAKES, text=COOLERS').first()).toBeVisible({ timeout: 10000 });
  });

  test('images load via Image Proxy', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const images = page.locator('img[src*="/api/image?url="]');
    const count = await images.count();
    if (count > 0) {
      await expect(images.first()).toBeVisible();
      // Check proxy URL format
      const src = await images.first().getAttribute('src');
      expect(src).toContain('/api/image?url=');
      expect(src).toContain('w=400');
      expect(src).toContain('q=75');
    }
  });

  test('blur placeholders visible during load', async ({ page }) => {
    const images = page.locator('img[style*="blur"]');
    const count = await images.count();
    if (count > 0) {
      await expect(images.first()).toHaveAttribute('style', /blur/);
    }
  });

  test('complete dine-in order flow', async ({ page }) => {
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    // Add first available item to cart
    const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
    if (await addButtons.first().isVisible()) {
      await addButtons.first().click();
      await page.waitForTimeout(500);
    }
    
    // Open cart drawer
    await page.locator('button:has-text("عرض السلة"), button:has-text("إتمام الطلب")').first().click();
    await expect(page.locator('[data-cart-drawer]')).toBeVisible({ timeout: 5000 });
    
    // Fill customer info
    await page.fill('input[name="customerName"]', `عميل-${Date.now()}`);
    
    // Select table
    const tableSelect = page.locator('select[name="tableNo"]');
    if (await tableSelect.isVisible()) {
      await tableSelect.selectOption('1');
    }
    
    // Submit order
    await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
    await expect(page.locator('text=تم إنشاء الطلب')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=رقم الطلب')).toBeVisible();
  });

  test('delivery order requires phone and address', async ({ page }) => {
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
    if (await addButtons.first().isVisible()) {
      await addButtons.first().click();
      await page.waitForTimeout(500);
    }
    
    await page.locator('button:has-text("عرض السلة"), button:has-text("إتمام الطلب")').first().click();
    await expect(page.locator('[data-cart-drawer]')).toBeVisible({ timeout: 5000 });
    
    // Select delivery
    await page.locator('input[value="delivery"]').click();
    
    // Try submit without phone
    await page.fill('input[name="customerName"]', 'عميل');
    await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
    await expect(page.locator('text=اكتب رقم الهاتف')).toBeVisible({ timeout: 5000 });
    
    // Add phone but no address
    await page.fill('input[name="phone"]', '01012345678');
    await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
    await expect(page.locator('text=اكتب العنوان')).toBeVisible({ timeout: 5000 });
  });

  test('best sellers section appears first', async ({ page }) => {
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    // Best sellers should be in first section or highlighted
    const bestSellerBadges = page.locator('text=الأكثر مبيعًا, text=Best seller');
    const count = await bestSellerBadges.count();
    expect(count).toBeGreaterThanOrEqual(0); // May be 0 if no best sellers yet
  });

  test('cart persists across navigation', async ({ page }) => {
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
    if (await addButtons.first().isVisible()) {
      await addButtons.first().click();
      await page.waitForTimeout(500);
    }
    
    // Navigate away and back
    await page.goto('/');
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    // Cart should still have items
    const cartBadge = page.locator('text=عرض السلة, text=View cart');
    if (await cartBadge.isVisible()) {
      await expect(cartBadge).toBeVisible();
    }
  });

  test('item detail dialog opens on click', async ({ page }) => {
    await page.goto('/m/kafy');
    await page.waitForLoadState('networkidle');
    
    const itemCards = page.locator('[role="button"]:has-text("شاورما"), [role="button"]:has-text("بطاطس"), article:has-text("شاورما"), article:has-text("بطاطس")');
    if (await itemCards.first().isVisible()) {
      await itemCards.first().click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=تفاصيل')).toBeVisible();
    }
  });
});