export const dictionaries = {
  ar: {
    dir: "rtl",
    header: { languageShort: "English" },
    hero: {
      welcome: "أهلًا بكم في",
      tagline: "نكهات أصيلة تُقدَّم بشغف، ننتظركم على مائدتنا",
      explore: "استكشف المنيو",
      scanHint: "امسح رمز QR على طاولتك لتفتح القائمة من هاتفك",
    },
    menu: { empty: "لا توجد عناصر متاحة حاليًا — عد قريبًا!" },
    footer: "مسح ضوئي — تصفّح القائمة الكاملة من هاتفك",
    login: {
      title: "لوحة إدارة المنيو",
      subtitle: "سجّل دخولك للتحكم في قائمتك",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      submit: "دخول",
      submitting: "جارٍ الدخول...",
      error: "بيانات الدخول غير صحيحة",
    },
    qr: {
      title: "رمز قائمة الطعام",
      desc: "اطبع هذا الرمز وضعه على الطاولات",
      download: "تحميل PNG للطباعة",
    },
  },
  en: {
    dir: "ltr",
    header: { languageShort: "العربية" },
    hero: {
      welcome: "Welcome to",
      tagline: "Authentic flavors, served with passion — your table is waiting",
      explore: "Explore the menu",
      scanHint: "Scan the QR code on your table to open the menu on your phone",
    },
    menu: { empty: "No items available right now — check back soon!" },
    footer: "Scan to browse the full menu on your phone",
    login: {
      title: "Admin area",
      subtitle: "Sign in to manage your menu",
      email: "Email address",
      password: "Password",
      submit: "Sign in",
      submitting: "Signing in...",
      error: "Invalid credentials",
    },
    qr: {
      title: "Menu QR code",
      desc: "Print this code and place it on tables",
      download: "Download PNG for printing",
    },
  },
} as const;

/** شكل القاموس موحّد للغتين (عربي/إنجليزي) حتى لا ينكسر الكود */
export type Dictionary = {
  dir: string;
  header: { languageShort: string };
  hero: {
    welcome: string;
    tagline: string;
    explore: string;
    scanHint: string;
  };
  menu: { empty: string };
  footer: string;
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    submit: string;
    submitting: string;
    error: string;
  };
  qr: {
    title: string;
    desc: string;
    download: string;
  };
};

export const defaultLocale = "ar";

export function getDictionary(locale: string): Dictionary {
  return locale === "en" ? dictionaries.en : dictionaries.ar;
}