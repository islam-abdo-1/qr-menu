import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1:has-text("دخول")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("دخول")')).toBeVisible();
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h1:has-text("إنشاء"), h1:has-text("التسجيل")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="restaurantName"]')).toBeVisible();
    await expect(page.locator('input[name="slug"]')).toBeVisible();
  });

  test('signup creates restaurant and redirects to admin', async ({ page }) => {
    const uniqueSlug = `test-${Date.now()}`;
    await page.goto('/signup');
    
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="restaurantName"]', 'مطعم تجريبي');
    await page.fill('input[name="slug"]', uniqueSlug);
    
    await page.click('button:has-text("إنشاء"), button:has-text("تسجيل")');
    
    // Should redirect to admin or show success
    await expect(page.locator('text=تم إنشاء المطعم, text=مرحباً, h1:has-text("مطعمك")').first()).toBeVisible({ timeout: 15000 });
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button:has-text("دخول")');
    
    await expect(page.locator('text=Invalid login credentials, text=بيانات الدخول غير صحيحة, text=خطأ').first()).toBeVisible({ timeout: 5000 });
  });

  test('forgot password page works', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('h1:has-text("نسيت"), h1:has-text("استعادة")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});