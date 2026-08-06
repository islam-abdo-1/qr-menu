"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, BellRing, Heart, QrCode, Rocket, ScanLine, Sparkles, Store, UtensilsCrossed } from "lucide-react";

type Lang = "ar" | "en";

const T = {
  ar: {
    badge: "منصّة المنيو الرقمي",
    title1: "منيو رقمي لمطعمك",
    title2: "ينطلق في دقيقة",
    subtitle: "أنشئ قائمة طعام إلكترونية لرابط خاص بمطعمك، واجعل زبائنك يطلبون مباشرة من موبايلهم — بدون تطبيقات وبدون تعقيد.",
    cta: "أنشئ مطعمك مجانًا",
    demo: "شاهد مثالًا حيًا",
    featuresTitle: "كل ما يحتاجه مطعمك",
    features: [
      { icon: QrCode, title: "رمز QR للطاولات", desc: "رمز جاهز للطباعة — الزبون يمسح ويفتح القائمة فورًا من موبايله." },
      { icon: Heart, title: "قائمة تفضيلات", desc: "زبائنك يحفظون أطباقهم المفضلة بحساب بسيط ويصلون لها على أي جهاز." },
      { icon: BellRing, title: "استقبال الطلبات", desc: "الطلب يوصل لقسم الموظفين لحظيًا مع تنبيه صوتي وحالات متابعة." },
      { icon: Store, title: "لوحة تحكم كاملة", desc: "أضف الأقسام والعناصر والصور والأسعار — والتعديلات تظهر فورًا." },
    ],
    footer: "قائمة رقمية — مسح ضوئي — طلب مباشر",
    lang: "English",
  },
  en: {
    badge: "Digital Menu Platform",
    title1: "A digital menu for your",
    title2: "restaurant in minutes",
    subtitle: "Create an online menu with your own link, and let customers order straight from their phones — no apps, no hassle.",
    cta: "Create your restaurant free",
    demo: "See a live example",
    featuresTitle: "Everything your restaurant needs",
    features: [
      { icon: QrCode, title: "Table QR codes", desc: "Print-ready QR — customers scan and open your menu instantly." },
      { icon: Heart, title: "Favorites", desc: "Customers save their favorite dishes with a simple account, on any device." },
      { icon: BellRing, title: "Order intake", desc: "Orders reach your staff in real time with sound alerts and status tracking." },
      { icon: Store, title: "Full dashboard", desc: "Manage categories, items, images and prices — changes appear instantly." },
    ],
    footer: "Digital menu — scan — order directly",
    lang: "العربية",
  },
};

export function Landing({ lang = "ar" }: { lang?: Lang }) {
  const t = T[lang];
  const other: Lang = lang === "ar" ? "en" : "ar";

  return (
    <main className="texture-dots min-h-screen overflow-hidden bg-background text-cream">
      {/* ───── Hero ───── */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px 500px at 50% -10%, rgba(212,168,83,0.22), transparent 60%), radial-gradient(800px 420px at 85% 110%, rgba(200,76,33,0.18), transparent 55%), linear-gradient(180deg, #14100D 0%, #1B1510 100%)",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -end-24 -top-24 hidden h-72 w-72 animate-float rounded-full bg-gold/15 blur-3xl sm:block" aria-hidden />
        <div className="pointer-events-none absolute -start-24 bottom-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden />

        <div className="container relative flex min-h-[100svh] flex-col items-center justify-center gap-7 py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-xs font-bold tracking-wide text-gold backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t.badge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-3xl font-display text-4xl font-bold text-gold-gradient drop-shadow-[0_4px_24px_rgba(212,168,83,0.25)] sm:text-6xl md:text-7xl"
          >
            {t.title1}
            <br />
            {t.title2}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="max-w-xl text-sm leading-relaxed text-cream/80 sm:text-base"
          >
            {t.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              href="/signup"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-l from-gold to-[#a87a2b] px-8 py-4 text-sm font-black text-background shadow-[0_12px_40px_-8px_rgba(212,168,83,0.5)] transition-all hover:scale-[1.03] hover:brightness-110 active:scale-95 sm:w-auto"
            >
              <Rocket className="h-4 w-4" />
              {t.cta}
            </Link>
            <Link
              href="/m/kafy"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-8 py-4 text-sm font-black text-gold backdrop-blur transition-all hover:bg-gold/20 active:scale-95 sm:w-auto"
            >
              <ScanLine className="h-4 w-4" />
              {t.demo}
            </Link>
          </motion.div>

          <p className="mt-2 flex items-center gap-1.5 text-xs text-cream/70">
            <UtensilsCrossed className="h-3.5 w-3.5 text-gold" />
            {lang === "ar" ? "ابدأ الآن — الإعداد خلال دقيقة واحدة" : "Start now — set up in under a minute"}
          </p>
        </div>
      </header>

      {/* ───── المميزات ───── */}
      <section className="relative border-t border-gold/15 bg-[#0D0A08] py-20">
        <div className="container max-w-5xl">
          <h2 className="mb-12 text-center font-display text-4xl font-bold text-gold-gradient sm:text-5xl">
            {t.featuresTitle}
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {t.features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.08, 0.3) }}
                  className="group flex flex-col gap-4 rounded-3xl border border-border bg-card p-7 transition-all duration-300 hover:-translate-y-1 hover:border-gold/40"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 text-gold ring-1 ring-gold/30">
                    <Icon className="h-7 w-7" />
                  </span>
                  <div>
                    <h3 className="font-display text-xl font-bold text-cream">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-cream/75">{f.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───── الفوتر ───── */}
      <footer className="border-t border-gold/15 bg-[#0D0A08] py-12 text-center text-cream">
        <div className="container flex flex-col items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
            <Store className="h-6 w-6" />
          </span>
          <p className="font-display text-2xl font-bold text-gold-gradient">QR Menu</p>
          <p className="flex items-center gap-2 text-sm text-cream/70">
            <ScanLine className="h-4 w-4 text-gold" />
            {t.footer}
          </p>
          <Link
            href={other === "ar" ? "/" : "/en"}
            className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-black text-gold transition-colors hover:bg-gold/20"
          >
            <ArrowLeft className={`h-3.5 w-3.5 ${lang === "ar" ? "rotate-180" : ""}`} />
            {t.lang}
          </Link>
          <p className="text-xs text-cream/60">© {new Date().getFullYear()} QR Menu</p>
        </div>
      </footer>
    </main>
  );
}
