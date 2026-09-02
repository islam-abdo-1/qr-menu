import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * قوالب الأنماط المركزية — 16 preset تغطي كل CATEGORY_TYPES بـ ألوان متباينة واضحة.
 * Lazy seed: تُزرع تلقائياً عند أول استخدام إن كان الجدول فارغاً.
 */

type PresetDef = {
  name: string;
  nameAr: string;
  slug: string;
  description: string;
  categoryType: string;
  colors: [string, string];
  styleConfig: {
    lighting: string;
    background: string;
    camera_angle: string;
    composition: string;
    depth_of_field: string;
    color_direction: string;
    presentation: string;
  };
};

export const STYLE_PRESETS: PresetDef[] = [
  {
    name: "Premium Grill",
    nameAr: "مشاوي فاخرة",
    slug: "grill-premium",
    description: "إضاءة دافئة · خلفية داكنة راقية",
    categoryType: "grilled_food",
    colors: ["#1a1a2e", "#d4a853"],
    styleConfig: {
      lighting: "warm directional lighting with subtle highlights on grill marks",
      background: "dark premium restaurant ambiance, softly blurred",
      camera_angle: "45-degree food photography angle",
      composition: "centered plated dish, generous portion",
      depth_of_field: "shallow depth of field",
      color_direction: "warm dark tones with golden accents",
      presentation: "premium restaurant plating on dark ceramic or slate",
    },
  },
  {
    name: "Modern Burger",
    nameAr: "برجر عصري",
    slug: "burger-modern",
    description: "ألوان جريئة · عرض ديناميكي",
    categoryType: "burgers",
    colors: ["#0f0f0f", "#ff6b35"],
    styleConfig: {
      lighting: "bright studio lighting with slight rim light",
      background: "clean dark surface with subtle texture",
      camera_angle: "low 25-degree hero angle",
      composition: "stacked burger centered, layers visible",
      depth_of_field: "medium depth of field",
      color_direction: "high contrast dark background with vibrant orange/red accents",
      presentation: "artisan bun, melted cheese visible, fresh toppings",
    },
  },
  {
    name: "Neapolitan Pizza",
    nameAr: "بيتزا نابوليتان",
    slug: "pizza-neapolitan",
    description: "أجواء فرن حطب · ألوان دافئة",
    categoryType: "pizza",
    colors: ["#fff8e1", "#e65100"],
    styleConfig: {
      lighting: "warm wood-fired oven glow, natural flames visible",
      background: "rustic stone oven interior, lightly charred crust",
      camera_angle: "top-down 80-degree or 45-degree",
      composition: "whole pizza centered, slices visible",
      depth_of_field: "medium",
      color_direction: "warm golden crust, vibrant red sauce, white mozzarella",
      presentation: "charred leopard spots on crust, fresh basil leaves",
    },
  },
  {
    name: "Authentic Pasta",
    nameAr: "معكرونة إيطالية",
    slug: "pasta-authentic",
    description: "مطعم إيطالي · تقديم كلاسيكي",
    categoryType: "pasta",
    colors: ["#fef3e2", "#bf360c"],
    styleConfig: {
      lighting: "soft warm window light from side",
      background: "rustic wooden table, Italian restaurant vibe",
      camera_angle: "45-degree angle showing pasta texture",
      composition: "twirled pasta on white porcelain plate",
      depth_of_field: "shallow",
      color_direction: "warm cream sauce tones, golden parmesan",
      presentation: "elegant twirl, grated cheese, herb garnish",
    },
  },
  {
    name: "Fresh Seafood",
    nameAr: "مأكولات بحرية",
    slug: "seafood-fresh",
    description: "ألوان بحرية · نضارة واضحة",
    categoryType: "seafood",
    colors: ["#e0f2f1", "#00695c"],
    styleConfig: {
      lighting: "bright natural daylight, slight sparkle on seafood",
      background: "clean light surface, subtle ocean hint",
      camera_angle: "eye-level 30-degree",
      composition: "centered seafood dish, lemon wedge, herbs",
      depth_of_field: "shallow",
      color_direction: "cool teal/green tones, pearlescent seafood",
      presentation: "glistening fresh fish/shrimp, citrus, microgreens",
    },
  },
  {
    name: "Healthy Breakfast",
    nameAr: "فطور صحي",
    slug: "breakfast-healthy",
    description: "إضاءة صباحية · ألوان فاتحة",
    categoryType: "breakfast",
    colors: ["#fffde7", "#fbc02d"],
    styleConfig: {
      lighting: "bright morning sunlight, soft shadows",
      background: "light marble or wood table",
      camera_angle: "top-down 90-degree",
      composition: "balanced plate: eggs, toast, fruit, coffee",
      depth_of_field: "medium",
      color_direction: "warm yellows, fresh greens, bright whites",
      presentation: "artisanal bread, sunny eggs, fresh berries",
    },
  },
  {
    name: "Luxury Dessert",
    nameAr: "حلويات فاخرة",
    slug: "dessert-luxury",
    description: "تقديم راقٍ · وردي وأبيض",
    categoryType: "desserts",
    colors: ["#fce4ec", "#c2185b"],
    styleConfig: {
      lighting: "soft diffused elegant lighting",
      background: "pastel or dark elegant backdrop",
      camera_angle: "45-degree close angle",
      composition: "artful dessert plating with sauce drizzle",
      depth_of_field: "very shallow",
      color_direction: "soft pastels with chocolate accents",
      presentation: "elegant dessert plate with mint or gold leaf garnish",
    },
  },
  {
    name: "Cozy Hot Drinks",
    nameAr: "مشروبات ساخنة",
    slug: "hot-drinks-cozy",
    description: "أجواء دافئة · بخار ظاهر",
    categoryType: "hot_drinks",
    colors: ["#3e2723", "#d7ccc8"],
    styleConfig: {
      lighting: "warm moody cafe lighting, visible steam",
      background: "dark wooden cafe table, blurred warm lights",
      camera_angle: "45-degree angle",
      composition: "centered cup with saucer, latte art visible",
      depth_of_field: "shallow",
      color_direction: "rich browns, warm creams, amber tones",
      presentation: "ceramic cup, visible steam, foam art",
    },
  },
  {
    name: "Refreshing Cold Drinks",
    nameAr: "مشروبات باردة",
    slug: "cold-drinks-refreshing",
    description: "انتعاش · تكثف على الكوب",
    categoryType: "cold_drinks",
    colors: ["#e3f2fd", "#1976d2"],
    styleConfig: {
      lighting: "bright crisp daylight",
      background: "clean light surface with ice reflection",
      camera_angle: "eye-level straight-on",
      composition: "tall glass with ice, condensation droplets",
      depth_of_field: "shallow",
      color_direction: "cool blues, crystal clear liquid, fresh garnish",
      presentation: "clear glass, ice cubes, mint/fruit garnish",
    },
  },
  {
    name: "Artisan Coffee",
    nameAr: "قهوة مختصة",
    slug: "coffee-artisan",
    description: "لاتيه آرت · بني غامق وكريمي",
    categoryType: "coffee",
    colors: ["#263238", "#a1887f"],
    styleConfig: {
      lighting: "soft window light from side",
      background: "minimalist warm neutral surface",
      camera_angle: "top-down 90 degrees or 45-degree",
      composition: "centered cup showing latte art",
      depth_of_field: "shallow",
      color_direction: "warm cream and coffee browns",
      presentation: "artisan ceramic cup, coffee beans nearby",
    },
  },
  {
    name: "Natural Juices",
    nameAr: "عصائر طبيعية",
    slug: "juices-natural",
    description: "ألوان فواكه زاهية · طبيعي",
    categoryType: "juices",
    colors: ["#fff3e0", "#ef6c00"],
    styleConfig: {
      lighting: "bright vibrant daylight",
      background: "colorful surface with fresh fruit pieces",
      camera_angle: "slightly elevated",
      composition: "tall glass with fruit garnish",
      depth_of_field: "medium",
      color_direction: "saturated vibrant fruit colors",
      presentation: "tall glass, fresh fruit around, pulp visible",
    },
  },
  {
    name: "Hearty Main Dish",
    nameAr: "أطباق رئيسية",
    slug: "main-hearty",
    description: "تقديم متوازن · ألوان طبيعية",
    categoryType: "main_dishes",
    colors: ["#fafafa", "#333333"],
    styleConfig: {
      lighting: "balanced soft studio lighting",
      background: "neutral warm surface",
      camera_angle: "45-degree",
      composition: "complete balanced plating with sides",
      depth_of_field: "medium",
      color_direction: "natural appetizing colors",
      presentation: "standard restaurant plate with garnish",
    },
  },
  {
    name: "Elegant Appetizer",
    nameAr: "مقبلات",
    slug: "appetizer-elegant",
    description: "تقديم أنيق · كميات صغيرة",
    categoryType: "appetizers",
    colors: ["#fbe9e7", "#bf360c"],
    styleConfig: {
      lighting: "soft directional lighting",
      background: "dark slate or stone surface",
      camera_angle: "45-degree close",
      composition: "small elegant portions, artistic arrangement",
      depth_of_field: "shallow",
      color_direction: "warm terracotta, golden highlights",
      presentation: "small plates, microgreens, sauce dots",
    },
  },
  {
    name: "Fresh Salad",
    nameAr: "سلطات طازجة",
    slug: "salad-fresh",
    description: "خضرة نضرة · ألوان طبيعية",
    categoryType: "salads",
    colors: ["#e8f5e9", "#388e3c"],
    styleConfig: {
      lighting: "bright natural light",
      background: "light wooden bowl or white plate",
      camera_angle: "top-down 70-degree",
      composition: "colorful mixed vegetables, dressing drizzle",
      depth_of_field: "medium",
      color_direction: "vibrant greens, reds, oranges from vegetables",
      presentation: "wooden bowl, fresh crisp vegetables, nuts/seeds",
    },
  },
  {
    name: "Gourmet Sandwich",
    nameAr: "ساندويشات",
    slug: "sandwich-gourmet",
    description: "طبقات واضحة · خبز حرفي",
    categoryType: "sandwiches",
    colors: ["#f3e5f5", "#7b1fa2"],
    styleConfig: {
      lighting: "soft side lighting showing layers",
      background: "rustic wooden board",
      camera_angle: "45-degree showing cross-section",
      composition: "half sandwich showing fillings, side chips",
      depth_of_field: "medium",
      color_direction: "golden bread, colorful fillings",
      presentation: "artisan bread, visible layers, pickle spear",
    },
  },
  {
    name: "Universal Style",
    nameAr: "نمط عام",
    slug: "universal",
    description: "متوازن · يناسب كل الأصناف",
    categoryType: "other",
    colors: ["#f5f5f5", "#757575"],
    styleConfig: {
      lighting: "clean soft studio lighting",
      background: "neutral gray surface",
      camera_angle: "45-degree",
      composition: "centered product, clean presentation",
      depth_of_field: "medium",
      color_direction: "neutral balanced tones",
      presentation: "simple clean plating",
    },
  },
];

/** يضمن وجود القوالب — lazy seed عند أول استخدام */
export async function ensureStylesSeeded(): Promise<void> {
  const count = await prisma.aiMenuStyle.count();
  if (count > 0) return;
  await prisma.aiMenuStyle.createMany({
    data: STYLE_PRESETS.map((p) => ({
      name: p.name,
      slug: p.slug,
      description: p.description,
      categoryType: p.categoryType,
      styleConfig: { ...p.styleConfig, colors: p.colors, nameAr: p.nameAr } as unknown as object,
      isActive: true,
    })),
  });
}

export type ActiveStyle = {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  description: string | null;
  categoryType: string;
  colors: string[];
  styleConfig?: {
    lighting: string;
    background: string;
    camera_angle: string;
    composition: string;
    depth_of_field: string;
    color_direction: string;
    presentation: string;
  };
};

/** جلب الأنماط المفعلة — مع حد عدد للتجربة (4 قوالب) */
export async function getActiveStyles(
  styleCountLimit: number | null,
): Promise<ActiveStyle[]> {
  await ensureStylesSeeded();
  const styles = await prisma.aiMenuStyle.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const mapped: ActiveStyle[] = styles.map((s) => {
    const cfg = s.styleConfig as Record<string, unknown>;
    return {
      id: s.id,
      name: s.name,
      nameAr: (cfg.nameAr as string) ?? s.name,
      slug: s.slug,
      description: s.description,
      categoryType: s.categoryType,
      colors: (cfg.colors as string[]) ?? ["#d4a853", "#1a1a2e"],
      styleConfig: cfg as {
        lighting: string;
        background: string;
        camera_angle: string;
        composition: string;
        depth_of_field: string;
        color_direction: string;
        presentation: string;
      },
    };
  });
  return styleCountLimit !== null ? mapped.slice(0, styleCountLimit) : mapped;
}

/** جلب نمط واحد بالـ ID */
export async function getStyleById(id: string): Promise<ActiveStyle | null> {
  await ensureStylesSeeded();
  const style = await prisma.aiMenuStyle.findUnique({
    where: { id },
  });
  if (!style) return null;
  const cfg = style.styleConfig as Record<string, unknown>;
  return {
    id: style.id,
    name: style.name,
    nameAr: (cfg.nameAr as string) ?? style.name,
    slug: style.slug,
    description: style.description,
    categoryType: style.categoryType,
    colors: (cfg.colors as string[]) ?? ["#d4a853", "#1a1a2e"],
    styleConfig: cfg as {
      lighting: string;
      background: string;
      camera_angle: string;
      composition: string;
      depth_of_field: string;
      color_direction: string;
      presentation: string;
    },
  };
}

/** جلب النمط المناسب لنوع قسم — للربط التلقائي */
export async function getStyleForCategoryType(categoryType: string | null): Promise<ActiveStyle | null> {
  if (!categoryType) return null;
  await ensureStylesSeeded();
  const style = await prisma.aiMenuStyle.findFirst({
    where: { categoryType, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!style) return null;
  const cfg = style.styleConfig as Record<string, unknown>;
  return {
    id: style.id,
    name: style.name,
    nameAr: (cfg.nameAr as string) ?? style.name,
    slug: style.slug,
    description: style.description,
    categoryType: style.categoryType,
    colors: (cfg.colors as string[]) ?? ["#d4a853", "#1a1a2e"],
    styleConfig: cfg as {
      lighting: string;
      background: string;
      camera_angle: string;
      composition: string;
      depth_of_field: string;
      color_direction: string;
      presentation: string;
    },
  };
}