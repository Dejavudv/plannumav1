"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/types";
import { fd } from "@/lib/date";
import { useToast } from "@/lib/toast";

type Theme = "system" | "light" | "dark";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://127.0.0.1:8000/admin/";

function applyTheme(t: Theme) {
  const r = document.documentElement;
  if (t === "system") { r.removeAttribute("data-theme"); try { localStorage.removeItem("pl_theme"); } catch { /* ignore */ } }
  else { r.setAttribute("data-theme", t); try { localStorage.setItem("pl_theme", t); } catch { /* ignore */ } }
}

type Props = { me: Me; onExport: () => void; onCopy: () => void; onSupport: () => void; onLogout: () => void; onRecurring: () => void; onAccount: () => void };

/** منوی بالای داشبورد: خروجی CSV، کپی هفته قبل، پشتیبانی، پرو، تم و خروج */
export function Menu({ me, onExport, onCopy, onSupport, onLogout, onRecurring, onAccount }: Props) {
  const toast = useToast();
  const [canInstall, setCanInstall] = useState(false);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const t = localStorage.getItem("pl_theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    const check = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      setCanInstall(!standalone && (!!(window as any).__plPrompt || ios));
    };
    check();
    window.addEventListener("pl-install-ready", check);
    return () => window.removeEventListener("pl-install-ready", check);
  }, []);
  const install = async () => {
    const p = (window as any).__plPrompt;
    if (p) { p.prompt(); try { await p.userChoice; } catch { /* ignore */ } (window as any).__plPrompt = null; setCanInstall(false); }
    else toast("در سافاری دکمهٔ اشتراک‌گذاری را بزنید و «Add to Home Screen» را انتخاب کنید.");
  };
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const go = (f: () => void) => () => { setOpen(false); f(); };
  const pickTheme = (t: Theme) => { setTheme(t); applyTheme(t); };
  const until = me.plan.until ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(me.plan.until)) : null;

  return (
    <div className="menu" ref={ref}>
      <button className="ib" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        ☰ منو{me.unread_support > 0 && <b className="dot">{fd(me.unread_support)}</b>}
      </button>
      {open && (
        <div className="mpanel" role="menu">
          <div className="muser">{me.user.username}<small>{me.plan.is_pro ? `پرو${until ? " تا " + until : ""}` : "نسخهٔ رایگان"}</small></div>
          <button role="menuitem" onClick={go(onExport)}>⬇ خروجی CSV برای تحلیل</button>
          <button role="menuitem" onClick={go(onCopy)}>⧉ کپی برنامهٔ هفتهٔ قبل</button>
          <button role="menuitem" onClick={go(onRecurring)}>🔁 کارهای تکراری</button>
          <button role="menuitem" onClick={go(onSupport)}>💬 پشتیبانی{me.unread_support > 0 && <b className="dot">{fd(me.unread_support)}</b>}</button>
          <Link role="menuitem" href="/dashboard/upgrade" onClick={() => setOpen(false)}>{me.plan.is_pro ? "★ مدیریت اشتراک پرو" : "★ ارتقا به پرو"}{me.pending_payment && <small> (در حال بررسی)</small>}</Link>
          <button role="menuitem" onClick={go(onAccount)}>⚙ حساب کاربری و تنظیمات</button>
          {canInstall && <button role="menuitem" onClick={go(install)}>📲 نصب برنامه روی گوشی</button>}
          {me.user.is_staff && <a role="menuitem" href={ADMIN_URL} target="_blank" rel="noopener noreferrer">🛠 پنل ادمین</a>}
          <div className="mtheme" role="group" aria-label="تم">
            {([["system", "سیستم"], ["light", "روشن"], ["dark", "تیره"]] as [Theme, string][]).map(([t, l]) => (
              <button key={t} aria-pressed={theme === t} onClick={() => pickTheme(t)}>{l}</button>
            ))}
          </div>
          <button role="menuitem" className="mout" onClick={go(onLogout)}>خروج از حساب</button>
        </div>
      )}
    </div>
  );
}
