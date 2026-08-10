export const dictionaries = {
  ar: {
    dir: "rtl",
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
} as const;

/** شكل القاموس موحّد — العربية هي اللغة الوحيدة للمنيو العام */
export type Dictionary = {
  dir: string;
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

export function getDictionary(): Dictionary {
  return dictionaries.ar;
}