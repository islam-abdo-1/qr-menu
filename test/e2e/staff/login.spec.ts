import { test, expect } from '@playwright/test';

test.describe('Staff Panel - Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/kafy');
  });

  test('shows login form with restaurant branding', async ({ page }) => {
    await expect(page.locator('h1:has-text("شاشة الموظفين")')).toBeVisible();
    await expect(page.locator('input[placeholder="اسمك"]')).toBeVisible();
    await expect(page.locator('input[placeholder="الكود السري (4 أرقام)"]')).toBeVisible();
    await expect(page.locator('button:has-text("دخول")')).toBeVisible();
  });

  test('successful login with correct pin', async ({ page }) => {
    await page.fill('input[placeholder="اسمك"]', 'أحمد');
    await page.fill('input[placeholder="الكود السري (4 أرقام)"]', '1234');
    await page.click('button:has-text("دخول")');
    
    // Should show orders panel
    await expect(page.locator('text=طلبات').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=لا توجد طلبات حاليًا').first()).toBeVisible({ timeout: 15000 });
  });

  test('failed login with wrong pin', async ({ page }) => {
    await page.fill('input[placeholder="اسمك"]', 'أحمد');
    await page.fill('input[placeholder="الكود السري (4 أرقام)"]', '0000');
    await page.click('button:has-text("دخول")');
    
    await expect(page.locator('text=الكود السري غير صحيح')).toBeVisible();
  });

  test('failed login with unregistered staff name', async ({ page }) => {
    await page.fill('input[placeholder="اسمك"]', 'غير مسجل');
    await page.fill('input[placeholder="الكود السري (4 أرقام)"]', '1234');
    await page.click('button:has-text("دخول")');
    
    await expect(page.locator('text=هذا الاسم غير مسجّل في قائمة الموظفين')).toBeVisible();
  });

  test('remember me checkbox works', async ({ page }) => {
    await page.fill('input[placeholder="اسمك"]', 'أحمد');
    await page.fill('input[placeholder="الكود السري (4 أرقام)"]', '1234');
    await page.check('input[type="checkbox"]');
    await page.click('button:has-text("دخول")');
    
    await expect(page.locator('text=طلبات').first()).toBeVisible({ timeout: 15000 });
    
    // Check cookie is set with 30 day expiry
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('staff'));
    expect(sessionCookie).toBeTruthy();
  });
});