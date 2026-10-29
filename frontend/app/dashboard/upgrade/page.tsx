"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, logout } from "@/lib/api";
import type { Me } from "@/lib/types";
import { useRun, useToast } from "@/lib/toast";
import { fd } from "@/lib/date";
import { Logo } from "@/components/Logo";

type Plan = { id: string; title: string; price: number; days: number };
type Pay = { id: number; plan: string; amount: number; status: "pending" | "approved" | "rejected"; created: string; admin_note: string };
type Billing = { card: { number: string; holder: string; bank: string }; plans: Plan[]; payments: Pay[]; limits: { todos_per_day: number; habits: number } };
const STATUS = { pending: "در انتظار بررسی", approved: "تأیید شد", rejected: "رد شد" };
const money = (n: number) => n.toLocaleString("fa-IR");
const group = (s: string) => s.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();

export default function UpgradePage() {
  const router = useRouter();
  const toast = useToast();
  const run = useRun();
  const [me, setMe] = useState<Me | null>(null);
  const [b, setB] = useState<Billing | null>(null);
  const [plan, setPlan] = useState("monthly");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, bl] = await Promise.all([api<Me>("/me"), api<Billing>("/billing")]);
      setMe(m); setB(bl);
    } catch (e: any) { if (e?.status === 401) { await logout(); router.replace("/login"); } }
  }, [router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  if (!me || !b) return <div className="boot"><Logo size={64} /><p>در حال بارگذاری…</p></div>;

  const cur = b.plans.find((p) => p.id === plan) || b.plans[0];
  const digits = b.card.number.replace(/\D/g, "");
  const copy = async () => {
    try { await navigator.clipboard.writeText(digits); }
    catch { const t = document.createElement("textarea"); t.value = digits; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    toast("شمارهٔ کارت کپی شد");
  };
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast("فقط عکس JPG، PNG یا WEBP قابل قبول است."); return; }
    if (f.size > 5 * 1024 * 1024) { toast("حجم عکس باید کمتر از ۵ مگابایت باشد."); return; }
    setFile(f);
  };
  const submit = () => run(async () => {
    if (!file) throw new Error("عکس رسید را انتخاب کنید.");
    setBusy(true);
    try {
      const fd2 = new FormData();
      fd2.append("plan", cur.id); fd2.append("receipt", file); fd2.append("note", note);
      await api("/billing/payments", { form: fd2 });
      setFile(null); setNote("");
      toast("رسید ثبت شد؛ بعد از بررسی، اشتراک شما فعال می‌شود.");
      await load();
    } finally { setBusy(false); }
  });
  const until = me.plan.until ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(me.plan.until)) : null;

  return (
    <div className="wrap pay">
      <header className="top">
        <div className="brand"><Logo /><div><h1>ارتقا به پلنوما پرو</h1><p>پرداخت کارت‌به‌کارت</p></div></div>
        <div className="nav"><Link href="/dashboard" className="ib">← بازگشت به داشبورد</Link></div>
      </header>

      {me.plan.is_pro && <div className="card okc"><b>★ اشتراک پرو شما فعال است{until ? ` تا ${until}` : ""}.</b><p className="sub">می‌توانید برای تمدید، دوباره پرداخت کنید؛ مدت جدید به انتهای اشتراک فعلی اضافه می‌شود.</p></div>}

      <div className="pgrid">
        <section className="card">
          <h3>۱) پلن را انتخاب کنید</h3>
          <div className="plans" role="radiogroup" aria-label="پلن">
            {b.plans.map((p) => (
              <button key={p.id} role="radio" aria-checked={p.id === cur.id} className={"plan-opt" + (p.id === cur.id ? " on" : "")} onClick={() => setPlan(p.id)}>
                <b>{p.title}</b><span>{money(p.price)} تومان</span><small>{fd(p.days)} روز</small>
              </button>
            ))}
          </div>
          <ul className="perks">
            <li>کار و عادت نامحدود (رایگان: {fd(b.limits.todos_per_day)} کار در روز و {fd(b.limits.habits)} عادت)</li>
            <li>امکانات پیشرفتهٔ بعدی پرو به‌محض آماده‌شدن برای شما فعال می‌شود</li>
            <li>اولویت در پشتیبانی</li>
          </ul>

          <h3>۲) مبلغ را کارت‌به‌کارت کنید</h3>
          <div className="cardbox">
            <small>{b.card.bank}</small>
            <div className="cn" dir="ltr">{group(b.card.number)}</div>
            <div className="ch2"><span>به نام: {b.card.holder}</span>
              <button className="btn" onClick={copy}>کپی شماره کارت</button></div>
          </div>
          <p className="sub" style={{ justifyContent: "flex-start" }}>مبلغ قابل پرداخت: <b>&nbsp;{money(cur.price)} تومان</b></p>
        </section>

        <section className="card">
          <h3>۳) عکس رسید را ارسال کنید</h3>
          {me.pending_payment ? (
            <p className="infoc">رسید قبلی شما در حال بررسی است. بعد از تأیید، پرو به‌صورت خودکار فعال می‌شود و در پشتیبانی خبرتان می‌کنیم.</p>
          ) : (
            <>
              <label className={"drop" + (file ? " has" : "")}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
                {preview ? <img src={preview} alt="پیش‌نمایش رسید" /> : <span>برای انتخاب عکس رسید ضربه بزنید<small>JPG، PNG یا WEBP، حداکثر ۵ مگابایت</small></span>}
              </label>
              <label className="fl">توضیح (اختیاری)
                <input className="inp" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ۴ رقم آخر کارت مبدأ" />
              </label>
              <button className="btn" style={{ width: "100%" }} disabled={busy || !file} onClick={submit}>{busy ? "در حال ارسال…" : "ثبت رسید و درخواست فعال‌سازی"}</button>
              <p className="sub" style={{ justifyContent: "flex-start", marginTop: 8 }}>بعد از بررسی توسط ادمین، اشتراک فعال می‌شود (معمولاً در همان روز).</p>
            </>
          )}

          <h3 style={{ marginTop: 22 }}>سابقهٔ پرداخت‌ها</h3>
          {b.payments.length ? (
            <ul className="plist">
              {b.payments.map((p) => (
                <li key={p.id}>
                  <div><b>{b.plans.find((x) => x.id === p.plan)?.title || p.plan}</b><small>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(p.created))} · {money(p.amount)} تومان</small>{p.admin_note && <small>{p.admin_note}</small>}</div>
                  <span className={"st-" + p.status}>{STATUS[p.status]}</span>
                </li>
              ))}
            </ul>
          ) : <p className="empty">هنوز پرداختی ثبت نشده است.</p>}
        </section>
      </div>
    </div>
  );
}
