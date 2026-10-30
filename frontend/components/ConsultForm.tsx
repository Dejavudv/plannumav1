"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const KINDS = ["پلنر شخصی (عادت و برنامهٔ روزانه)", "اپ برای کسب‌وکار یا تیم", "تحلیل و بهبود روش کاری", "چیز دیگر"];
const BUDGETS = ["هنوز نمی‌دانم", "کمتر از ۵ میلیون تومان", "۵ تا ۲۰ میلیون تومان", "بیشتر از ۲۰ میلیون تومان"];

export function ConsultForm() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ kind: "", goal: "", budget: "", name: "", contact: "" });
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const next = () => {
    setErr("");
    if (step === 0 && !f.kind) return setErr("یکی از گزینه‌ها را انتخاب کنید.");
    if (step === 1 && f.goal.trim().length < 10) return setErr("هدفتان را کمی کامل‌تر بنویسید (حداقل چند کلمه).");
    setStep(step + 1);
  };
  const send = async () => {
    setErr("");
    if (f.name.trim().length < 2 || f.contact.trim().length < 5) return setErr("نام و راه تماس (تلگرام یا موبایل) را وارد کنید.");
    setBusy(true);
    try { await api("/consult", { body: f }); setDone(true); }
    catch (e: any) { setErr(e?.message || "ارسال نشد؛ دوباره تلاش کنید."); }
    setBusy(false);
  };

  if (done) return <div className="card okc"><h2>درخواست شما ثبت شد ✅</h2><p>در اولین فرصت از راهی که نوشتید با شما تماس می‌گیریم.</p></div>;
  return (
    <div className="card consult">
      <div className="steps" aria-label="مرحله">{[0, 1, 2].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
      {step === 0 && (
        <fieldset><legend>چه نیازی دارید؟</legend>
          {KINDS.map((k) => <label key={k} className="opt"><input type="radio" name="kind" checked={f.kind === k} onChange={() => set("kind", k)} />{k}</label>)}
        </fieldset>
      )}
      {step === 1 && (
        <>
          <label className="fl">هدف و وضعیت فعلی‌تان را بنویسید
            <textarea className="inp ta" value={f.goal} maxLength={1500} onChange={(e) => set("goal", e.target.value)} placeholder="مثلاً: می‌خواهم عادت‌های صبحگاهی‌ام را منظم کنم و روزهایم را بهتر مدیریت کنم…" />
          </label>
          <label className="fl">بودجهٔ تقریبی (اختیاری)
            <select className="sel" value={f.budget} onChange={(e) => set("budget", e.target.value)}><option value="">انتخاب کنید</option>{BUDGETS.map((b) => <option key={b}>{b}</option>)}</select>
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <label className="fl">نام<input className="inp" value={f.name} maxLength={100} onChange={(e) => set("name", e.target.value)} autoComplete="name" /></label>
          <label className="fl">راه تماس (آی‌دی تلگرام یا شمارهٔ موبایل)<input className="inp" dir="ltr" value={f.contact} maxLength={120} onChange={(e) => set("contact", e.target.value)} /></label>
        </>
      )}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="dacts">
        {step > 0 && <button className="ib" onClick={() => setStep(step - 1)}>قبلی</button>}
        {step < 2 ? <button className="btn" onClick={next}>بعدی</button> : <button className="btn gold" disabled={busy} onClick={send}>{busy ? "در حال ارسال…" : "ارسال درخواست"}</button>}
      </div>
    </div>
  );
}
