"use client";
import { useEffect } from "react";

/** ثبت service worker و نگه‌داشتن رویداد نصب برنامه (beforeinstallprompt) برای منو */
export function PWA() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: any) => { e.preventDefault(); (window as any).__plPrompt = e; window.dispatchEvent(new Event("pl-install-ready")); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => { (window as any).__plPrompt = null; window.dispatchEvent(new Event("pl-install-ready")); });
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  return null;
}
