# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public\menu.spec.ts >> Public Menu - Customer Flow >> complete dine-in order flow
- Location: test\e2e\public\menu.spec.ts:35:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-cart-drawer]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('[data-cart-drawer]') with timeout 5000ms
  - waiting for locator('[data-cart-drawer]')

```

```yaml
- banner:
  - text: أهلًا بكم في
  - img "مطعم ابو الذهب"
  - heading "مطعم ابو الذهب" [level=1]
  - paragraph: نكهات أصيلة تُقدَّم بشغف، ننتظركم على مائدتنا
  - button "استكشف المنيو"
  - paragraph: امسح رمز QR على طاولتك لتفتح القائمة من هاتفك
- navigation:
  - img "مطعم ابو الذهب"
  - text: مطعم ابو الذهب
  - button "BURGER"
  - button "MAGGI & MOMO"
  - button "مشاركة المنيو": مشاركة
- heading "BURGER" [level=2]
- button "عرض تفاصيل PANEER BURGER":
  - img "PANEER BURGER"
  - text: ١٢٥ ج.م
  - heading "PANEER BURGER" [level=3]
  - text: ١٢٥ ج.م متاح الآن
  - button "إضافة إلى السلة": "1"
- button "عرض تفاصيل PANEER CHEESE BURGER":
  - img "PANEER CHEESE BURGER"
  - text: ١٥٠ ج.م
  - heading "PANEER CHEESE BURGER" [level=3]
  - text: ١٥٠ ج.م متاح الآن
  - button "إضافة إلى السلة": أضف
- heading "MAGGI & MOMO" [level=2]
- button "عرض تفاصيل CRUNCHY PANEER MOMO 8PC":
  - img "CRUNCHY PANEER MOMO 8PC"
  - text: ١٣٠ ج.م
  - heading "CRUNCHY PANEER MOMO 8PC" [level=3]
  - text: ١٣٠ ج.م متاح الآن
  - button "إضافة إلى السلة": أضف
- button "Close"
- complementary:
  - heading "سلة الطلب 1" [level=3]
  - button "إغلاق"
  - list:
    - listitem:
      - paragraph: PANEER BURGER
      - paragraph: ١٢٥ ج.م
      - button "−"
      - text: "1"
      - button "+"
      - button "حذف"
  - text: الإجمالي ١٢٥ ج.م
  - button "متابعة الطلب"
- button "1 عرض السلة ١٢٥ ج.م"
- contentinfo:
  - img "مطعم ابو الذهب"
  - paragraph: مطعم ابو الذهب
  - paragraph: مسح ضوئي — تصفّح القائمة الكاملة من هاتفك
  - paragraph: © 2026 مطعم ابو الذهب
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | test.describe('Public Menu - Customer Flow', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/m/kafy');
  6   |   });
  7   | 
  8   |   test('menu loads with hero and sections', async ({ page }) => {
  9   |     await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
  10  |     await expect(page.locator('text=الأكثر مبيعًا, text=SHAKES, text=COOLERS').first()).toBeVisible({ timeout: 10000 });
  11  |   });
  12  | 
  13  |   test('images load via Image Proxy', async ({ page }) => {
  14  |     await page.waitForLoadState('networkidle');
  15  |     const images = page.locator('img[src*="/api/image?url="]');
  16  |     const count = await images.count();
  17  |     if (count > 0) {
  18  |       await expect(images.first()).toBeVisible();
  19  |       // Check proxy URL format
  20  |       const src = await images.first().getAttribute('src');
  21  |       expect(src).toContain('/api/image?url=');
  22  |       expect(src).toContain('w=400');
  23  |       expect(src).toContain('q=75');
  24  |     }
  25  |   });
  26  | 
  27  |   test('blur placeholders visible during load', async ({ page }) => {
  28  |     const images = page.locator('img[style*="blur"]');
  29  |     const count = await images.count();
  30  |     if (count > 0) {
  31  |       await expect(images.first()).toHaveAttribute('style', /blur/);
  32  |     }
  33  |   });
  34  | 
  35  |   test('complete dine-in order flow', async ({ page }) => {
  36  |     await page.goto('/m/kafy');
  37  |     await page.waitForLoadState('networkidle');
  38  |     
  39  |     // Add first available item to cart
  40  |     const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
  41  |     if (await addButtons.first().isVisible()) {
  42  |       await addButtons.first().click();
  43  |       await page.waitForTimeout(500);
  44  |     }
  45  |     
  46  |     // Open cart drawer
  47  |     await page.locator('button:has-text("عرض السلة"), button:has-text("إتمام الطلب")').first().click();
> 48  |     await expect(page.locator('[data-cart-drawer]')).toBeVisible({ timeout: 5000 });
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  49  |     
  50  |     // Fill customer info
  51  |     await page.fill('input[name="customerName"]', `عميل-${Date.now()}`);
  52  |     
  53  |     // Select table
  54  |     const tableSelect = page.locator('select[name="tableNo"]');
  55  |     if (await tableSelect.isVisible()) {
  56  |       await tableSelect.selectOption('1');
  57  |     }
  58  |     
  59  |     // Submit order
  60  |     await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
  61  |     await expect(page.locator('text=تم إنشاء الطلب')).toBeVisible({ timeout: 10000 });
  62  |     await expect(page.locator('text=رقم الطلب')).toBeVisible();
  63  |   });
  64  | 
  65  |   test('delivery order requires phone and address', async ({ page }) => {
  66  |     await page.goto('/m/kafy');
  67  |     await page.waitForLoadState('networkidle');
  68  |     
  69  |     const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
  70  |     if (await addButtons.first().isVisible()) {
  71  |       await addButtons.first().click();
  72  |       await page.waitForTimeout(500);
  73  |     }
  74  |     
  75  |     await page.locator('button:has-text("عرض السلة"), button:has-text("إتمام الطلب")').first().click();
  76  |     await expect(page.locator('[data-cart-drawer]')).toBeVisible({ timeout: 5000 });
  77  |     
  78  |     // Select delivery
  79  |     await page.locator('input[value="delivery"]').click();
  80  |     
  81  |     // Try submit without phone
  82  |     await page.fill('input[name="customerName"]', 'عميل');
  83  |     await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
  84  |     await expect(page.locator('text=اكتب رقم الهاتف')).toBeVisible({ timeout: 5000 });
  85  |     
  86  |     // Add phone but no address
  87  |     await page.fill('input[name="phone"]', '01012345678');
  88  |     await page.click('button:has-text("تأكيد الطلب"), button:has-text("إرسال الطلب")');
  89  |     await expect(page.locator('text=اكتب العنوان')).toBeVisible({ timeout: 5000 });
  90  |   });
  91  | 
  92  |   test('best sellers section appears first', async ({ page }) => {
  93  |     await page.goto('/m/kafy');
  94  |     await page.waitForLoadState('networkidle');
  95  |     
  96  |     // Best sellers should be in first section or highlighted
  97  |     const bestSellerBadges = page.locator('text=الأكثر مبيعًا, text=Best seller');
  98  |     const count = await bestSellerBadges.count();
  99  |     expect(count).toBeGreaterThanOrEqual(0); // May be 0 if no best sellers yet
  100 |   });
  101 | 
  102 |   test('cart persists across navigation', async ({ page }) => {
  103 |     await page.goto('/m/kafy');
  104 |     await page.waitForLoadState('networkidle');
  105 |     
  106 |     const addButtons = page.locator('button:has-text("إضافة"), button:has-text("أضف")');
  107 |     if (await addButtons.first().isVisible()) {
  108 |       await addButtons.first().click();
  109 |       await page.waitForTimeout(500);
  110 |     }
  111 |     
  112 |     // Navigate away and back
  113 |     await page.goto('/');
  114 |     await page.goto('/m/kafy');
  115 |     await page.waitForLoadState('networkidle');
  116 |     
  117 |     // Cart should still have items
  118 |     const cartBadge = page.locator('text=عرض السلة, text=View cart');
  119 |     if (await cartBadge.isVisible()) {
  120 |       await expect(cartBadge).toBeVisible();
  121 |     }
  122 |   });
  123 | 
  124 |   test('item detail dialog opens on click', async ({ page }) => {
  125 |     await page.goto('/m/kafy');
  126 |     await page.waitForLoadState('networkidle');
  127 |     
  128 |     const itemCards = page.locator('[role="button"]:has-text("شاورما"), [role="button"]:has-text("بطاطس"), article:has-text("شاورما"), article:has-text("بطاطس")');
  129 |     if (await itemCards.first().isVisible()) {
  130 |       await itemCards.first().click();
  131 |       await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
  132 |       await expect(page.locator('text=تفاصيل')).toBeVisible();
  133 |     }
  134 |   });
  135 | });
```