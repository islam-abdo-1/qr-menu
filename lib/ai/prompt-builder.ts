import type { AiMenuStyle } from "@prisma/client";

/**
 * باني برومبت توليد صورة منتج — حتمي وقابل للاختبار (البند 65).
 * يجمع: المنتج + الوصف + القسم + النمط + سياق المطعم + القيود السلبية.
 * لا نصوص عشوائية — نفس المدخلات = نفس البرومبت دائماً.
 */

export type StyleConfig = {
  lighting?: string;
  background?: string;
  camera_angle?: string;
  composition?: string;
  depth_of_field?: string;
  color_direction?: string;
  presentation?: string;
};

export type PromptInput = {
  itemName: string;
  itemDescription?: string | null;
  categoryName: string;
  categoryType?: string | null;
  style: {
    name: string;
    styleConfig: StyleConfig;
  } | null;
  restaurantContext?: string | null;
};

/** القيود السلبية الثابتة — لا نصوص ولا أسعار ولا شعارات (البند 67) */
const NEGATIVE_RULES = [
  "Rules:",
  "- Show the requested product accurately and recognizably.",
  "- Photorealistic professional restaurant food photography.",
  "- No text.",
  "- No prices.",
  "- No logos.",
  "- No watermark.",
  "- No menu card.",
  "- No poster.",
  "- No UI elements.",
  "- No unrelated food or beverages.",
  "- No random ingredients scattered around.",
  "- No extra products.",
  "- No hands or people.",
  "- Focus only on the requested product.",
].join("\n");

/**
 * يبني برومبت توليد صورة منتج — إنجليزي (الموديلات أداءها الأفضل بالإنجليزية
 * حتى للمنتجات العربية — اسم المنتج العربي يُمرر كما هو ليُصوَّر بدقة).
 */
export function buildProductImagePrompt(input: PromptInput): string {
  const parts: string[] = [];

  parts.push(
    "Create a professional photorealistic restaurant menu product photograph.",
  );
  parts.push("");
  parts.push("Product:");
  parts.push(input.itemName);
  if (input.itemDescription) {
    parts.push(`Description: ${input.itemDescription}`);
  }

  parts.push("");
  parts.push("Menu Category:");
  parts.push(input.categoryName);

  // خصائص نوع القسم — توجيه دلالي يساعد الموديل
  const typeHint = categoryTypeHint(input.categoryType);
  if (typeHint) {
    parts.push(`Food characteristics: ${typeHint}`);
  }

  if (input.style) {
    parts.push("");
    parts.push(`Visual Style: ${input.style.name}`);
    const c = input.style.styleConfig;
    if (c.lighting) parts.push(`Lighting: ${c.lighting}.`);
    if (c.background) parts.push(`Background: ${c.background}.`);
    if (c.composition) parts.push(`Composition: ${c.composition}.`);
    if (c.camera_angle) parts.push(`Camera: ${c.camera_angle}.`);
    if (c.depth_of_field) parts.push(`Depth of field: ${c.depth_of_field}.`);
    if (c.color_direction) parts.push(`Color direction: ${c.color_direction}.`);
    if (c.presentation) parts.push(`Presentation: ${c.presentation}.`);
  } else {
    parts.push("");
    parts.push(
      "Visual Style: clean appetizing restaurant photography, natural soft lighting, subtle background, centered composition.",
    );
  }

  parts.push("");
  parts.push(
    "Composition requirement: centered hero product shot suitable for a mobile QR menu product card, square 1:1 framing.",
  );

  if (input.restaurantContext) {
    parts.push(`Restaurant context: ${input.restaurantContext}`);
  }

  parts.push("");
  parts.push(NEGATIVE_RULES);

  return parts.join("\n");
}

/** توجيه دلالي لكل نوع قسم — يحسّن دقة المنتج المُصوَّر */
export function categoryTypeHint(
  categoryType: string | null | undefined,
): string | null {
  switch (categoryType) {
    case "grilled_food":
      return "char-grilled meat dish with authentic grill marks, served hot";
    case "burgers":
      return "stacked burger with visible layers, fresh bun and toppings";
    case "pizza":
      return "oven-baked pizza with melted cheese and visible toppings";
    case "pasta":
      return "italian pasta dish with sauce, plated restaurant style";
    case "seafood":
      return "fresh seafood dish, glistening and well-prepared";
    case "breakfast":
      return "classic breakfast plate, fresh and inviting morning meal";
    case "desserts":
      return "dessert with appealing texture and garnish, indulgent presentation";
    case "hot_drinks":
      return "hot beverage in a clean cup with visible steam or foam";
    case "cold_drinks":
      return "cold refreshing beverage in a glass with ice, condensation visible";
    case "coffee":
      return "coffee drink with rich crema or latte art in an appropriate cup";
    case "juices":
      return "fresh fruit juice, vibrant natural color, fresh fruit garnish";
    case "main_dishes":
      return "hearty main course dish, complete restaurant plating";
    case "appetizers":
      return "appetizer portion, elegantly plated starter";
    case "salads":
      return "fresh crisp salad with visible vegetables and dressing";
    case "sandwiches":
      return "sandwich with visible fillings, fresh bread";
    default:
      return null;
  }
}

/** برومبت تحليل المنيو — نظام صارم ضد الهلوسة (البند 14) */
export const MENU_ANALYSIS_SYSTEM = [
  "You extract restaurant menus from OCR text. Output ONLY valid JSON matching the schema.",
  "Rules: 1) No inventions. 2) Exact names. 3) Unclear price → null. 4) Unclear category → null.",
  "5) Preserve order. 6) Merge multi-page categories. 7) image.detected=false. 8) sourcePage from OCR.",
  "9) Variants for sizes/flavors only. 10) Currency from menu. 11) Confidence 0-1 per item.",
  "12) Descriptions null if missing. Output ONLY JSON - no extra text.",
].join("\n");

/** تعليمات المستخدم لتحليل المنيو */
export function menuAnalysisUserPrompt(currencyHint?: string): string {
  const currency = currencyHint ?? "EGP";
  return [
    `استخرج المنيو كـ JSON بهذا الشكل فقط:`,
    `{`,
    `  "restaurant": { "name": "string", "currency": "${currency}" },`,
    `  "categories": [`,
    `    { "name": "string", "description": "string", "order": 1,`,
    `      "categoryType": "APPETIZER|MAIN_DISH|DRINKS|DESSERT|SIDE_DISH|OTHER",`,
    `      "categoryConfidence": 0.9,`,
    `      "items": [`,
    `        { "name": "string", "description": "string", "price": 149,`,
    `          "variants": [],`,
    `          "image": { "detected": false, "confidence": 0, "region": { "x": 0, "y": 0, "w": 0, "h": 0 } },`,
    `          "sourcePage": 1, "confidence": 0.9 }`,
    `      ]`,
    `    }`,
    `  ]`,
    `}`,
    `القواعد: 1) JSON فقط. 2) لا تبتدع. 3) سعر غير واضح → null.`,
    `4) categoryType من القائمة فقط. 5) variants للخيارات فقط.`,
    `6) image.detected=false دائماً. 7) sourcePage من OCR. 8) عملة: ${currency}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** نوع مساعد لتمرير النمط من قاعدة البيانات */
export type StyleLike = Pick<AiMenuStyle, "name" | "styleConfig">;
