"use client";

/** صوت تنبيه قصير للطلبات الجديدة (Web Audio — بدون ملفات) */
let ctx: AudioContext | null = null;

export function playOrderBeep() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    /* صوت غير مدعوم — تجاهل */
  }
}

/** وميض عنوان التبويب للفت الانتباه ثم العودة للأصلي */
let titleTimer: ReturnType<typeof setTimeout> | null = null;

export function flashTitle(text: string, timeout = 3500) {
  if (typeof document === "undefined") return;
  const original = document.title;
  document.title = text;
  if (titleTimer) clearTimeout(titleTimer);
  titleTimer = setTimeout(() => {
    document.title = original;
  }, timeout);
}
