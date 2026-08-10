"use client";

import { useEffect } from "react";

/**
 * تسجيل Service Worker المتولد من next-pwa.
 * مطلوب صراحةً في App Router — بدونه لا يظهر beforeinstallprompt
 * ولا يُعتبر الموقع PWA قابلًا للتثبيت.
 */
export function RegisterPWA() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // أول زيارة: السيرفر ووركر لا يتحكم بالصفحة الحالية — أعد التحميل لتفعيله
        if (!navigator.serviceWorker.controller && reg.active) {
          // أبلّغ بأن التحميل التالي سيكون تحت سيطرة السيرفر ووركر
        }
      })
      .catch((err) => console.error("[pwa] SW registration failed:", err));
  }, []);

  return null;
}