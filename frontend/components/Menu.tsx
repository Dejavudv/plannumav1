"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/types";
import { fd } from "@/lib/date";

type Theme = "system" | "light" | "dark";
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://127.0.0.1:8000/admin/";

function applyTheme(t: Theme) {
  const r = document.documentElement;
  if (t === "system") { r.removeAttribute("data-theme"); try { localStorage.removeItem("pl_theme"); } catch { /* ignore */ } }
  else { r.setAttribute("data-theme", t); try { localStorage.setItem("pl_theme", t); } catch { /* ignore */ } }
}

type Props = { me: Me; onExport: () => void; onCopy: () => void; onSupport: () => void; onLogout: () => void };

/** منوی بالای داشبورد: خروجی CSV، کپی هفته قبل، پشتیبانی، پرو، تم و خروج */
export function Menu({ me, onExport, onCopy, onSupport, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const t = localStorage.getItem("pl_theme"); if (t === "light" || t === "dark") setTheme(t); } catch { /* ignore */ }
  }, []);
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
          <button role="menuitem" onClick={go(onSupport)}>💬 پشتیبانی{me.unread_support > 0 && <b className="dot">{fd(me.unread_support)}</b>}</button>
          <Link role="menuitem" href="/dashboard/upgrade" onClick={() => setOpen(false)}>{me.plan.is_pro ? "★ مدیریت اشتراک پرو" : "★ ارتقا به پرو"}{me.pending_payment && <small> (در حال بررسی)</small>}</Link>
          {me.user.is_staff && <a role="menuitem" href={ADMIN_URL} target="_blank" rel="noopener noreferrer">⚙ پنل ادمین</a>}
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
