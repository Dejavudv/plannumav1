"use client";
import { useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { useToast } from "@/lib/toast";
import { QUICK_HABITS } from "@/lib/packs";
import { fd } from "@/lib/date";

export const ONB_KEY = "pl_onboarded";

/** راهنمای اولین ورود در ۳ قدم: انتخاب عادت، اولین کار، آشنایی با ابزارها */
export function Onboarding({ open, onClose, pl, me }: { open: boolean; onClose: () => void; pl: Planner; me: Me }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [todo, setTodo] = useState("");
  const [busy, setBusy] = useState(false);
  const lim = me.limits?.habits ?? 99;

  const finish = async () => {
    setBusy(true);
    try {
      for (const n of sel) await pl.addHabit(n, [0, 1, 2, 3, 4, 5, 6]);
      if (todo.trim()) await pl.addTodo(pl.sel, todo.trim());
    } catch (e: any) { toast(e?.message || "بعضی موارد اضافه نشد."); }
    try { localStorage.setItem(ONB_KEY, "1"); } catch { /* ignore */ }
    setBusy(false);
    onClose();
  };
  const skip = () => { try { localStorage.setItem(ONB_KEY, "1"); } catch { /* ignore */ } onClose(); };
  const toggle = (n: string) => setSel((p) => p.includes(n) ? p.filter((x) => x !== n) : p.length >= lim ? (toast(`در نسخهٔ رایگان تا ${fd(lim)} عادت می‌توانید داشته باشید.`), p) : [...p, n]);

  return (
    <Modal open={open} onClose={skip} title="خوش آمدی به پلنوما 👋" wide>
      <div className="steps" aria-label="مرحله">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {step === 0 && (
        <>
          <p>اول چند عادتی که می‌خواهی بسازی را انتخاب کن{lim < 99 ? ` (تا ${fd(lim)} تا)` : ""}. بعداً هر وقت خواستی عوضشان کن.</p>
          <div className="chips">{QUICK_HABITS.map((n) => <button key={n} className="chip" aria-pressed={sel.includes(n)} onClick={() => toggle(n)}>{n}</button>)}</div>
        </>
      )}
      {step === 1 && (
        <>
          <p>مهم‌ترین کار امروزت چیست؟ (اختیاری){me.limits ? ` در نسخهٔ رایگان تا ${fd(me.limits.todos_per_day)} کار در روز داری؛ همین تمرکز را می‌سازد.` : ""}</p>
          <input className="inp" value={todo} maxLength={200} placeholder="مثلاً: نوشتن گزارش" onChange={(e) => setTodo(e.target.value)} />
        </>
      )}
      {step === 2 && (
        <ul className="tips">
          <li>🗓 <b>تایم‌باکس:</b> برای هر کار یک بازهٔ زمانی بگذار.</li>
          <li>📈 <b>تحلیل:</b> پایین صفحه، روند عادت‌هایت را ببین.</li>
          <li>☰ <b>منو:</b> خروجی CSV، کپی هفتهٔ قبل، کارهای تکراری و حساب کاربری.</li>
          <li>💬 <b>پشتیبانی:</b> هر سؤالی داشتی همین‌جا بپرس.</li>
        </ul>
      )}
      <div className="dacts">
        {step > 0 && <button className="ib" onClick={() => setStep(step - 1)}>قبلی</button>}
        {step < 2 ? <button className="btn" onClick={() => setStep(step + 1)}>بعدی</button> : <button className="btn gold" disabled={busy} onClick={finish}>{busy ? "…" : "شروع کنیم"}</button>}
        <button className="link" style={{ marginInlineStart: "auto" }} onClick={skip}>رد کردن</button>
      </div>
    </Modal>
  );
}
