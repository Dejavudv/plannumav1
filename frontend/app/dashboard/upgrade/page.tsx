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
type Pay = { id: number; plan: string; amount: number; base_price: number; discount: number; status: "awaiting" | "pending" | "approved" | "rejected"; created: string; expires: string; admin_note: string };
type Billing = { card: { number: string; holder: string; bank: string }; plans: Plan[]; payments: Pay[]; request: Pay | null; limits: { todos_per_day: number; habits: number; recurring: number } };
const STATUS = { awaiting: "منتظر رسید", pending: "در انتظار بررسی", approved: "تأیید شد", rejected: "رد شد" };
const money = (n: number) => n.toLocaleString("fa-IR");
const group = (s: string) => s.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
const dfmt = (s: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fa-IR", o).format(new Date(s));

export default function UpgradePage() {
  const router = useRouter();
  const toast = useToast();
  const run = useRun();
  const [me, setMe] = useState<Me | null>(null);
  const [b, setB] = useState<Billing | null>(null);
  const [plan, setPlan] = useState("monthly");
  const [coupon, setCoupon] = useState("");
  const [preview, setPreview] = useState<{ discount: number; payable: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [img, setImg] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, bl] = await Promise.all([api<Me>("/me"), api<Billing>("/billing")]);
      setMe(m); setB(bl);
      if (bl.request) setPlan(bl.request.plan);
    } catch (e: any) { if (e?.status === 401) { await logout(); router.replace("/login"); } }
  }, [router]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!file) { setImg(""); return; }
    const u = URL.createObjectURL(file);
    setImg(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  useEffect(() => { setPreview(null); }, [plan]);

  if (!me || !b) return <div className="boot"><Logo size={64} /><p>در حال بارگذاری…</p></div>;

  const cur = b.plans.find((p) => p.id === plan) || b.plans[0];
  const req = b.request;
  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
    toast(msg);
  };
  const checkCoupon = () => run(async () => {
    if (!coupon.trim()) { setPreview(null); return; }
    const r = await api<{ discount: number; payable: number }>("/billing/coupon", { body: { plan: cur.id, code: coupon } });
    setPreview(r);
    toast(`کد تخفیف اعمال شد: ${money(r.discount)} تومان`);
  });
  const makeRequest = () => run(async () => {
    setBusy(true);
    try { await api("/billing/requests", { body: { plan: cur.id, coupon: coupon.trim() } }); await load(); }
    finally { setBusy(false); }
  });
  const cancel = () => run(async () => { if (req) { await api(`/billing/requests/${req.id}`, { method: "DELETE" }); setFile(null); await load(); } });
  const pick = (f?: File | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { toast("فقط عکس JPG، PNG یا WEBP قابل قبول است."); return; }
    if (f.size > 5 * 1024 * 1024) { toast("حجم عکس باید کمتر از ۵ مگابایت باشد."); return; }
    setFile(f);
  };
  const submit = () => run(async () => {
    if (!file || !req) throw new Error("عکس رسید را انتخاب کنید.");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("receipt", file); form.append("note", note);
      await api(`/billing/requests/${req.id}/receipt`, { form });
      setFile(null); setNote("");
      toast("رسید ثبت شد؛ بعد از بررسی، اشتراک شما فعال می‌شود.");
      await load();
    } finally { setBusy(false); }
  });
  const until = me.plan.until ? dfmt(me.plan.until, { dateStyle: "long" }) : null;

  return (
    <div className="wrap pay">
      <header className="top">
        <div className="brand"><Logo /><div><h1>ارتقا به پلنوما پرو</h1><p>پرداخت کارت‌به‌کارت</p></div></div>
        <div className="nav"><Link href="/dashboard" className="ib">← بازگشت به داشبورد</Link></div>
      </header>

      {me.plan.is_pro && <div className="card okc"><b>★ اشتراک پرو شما فعال است{until ? ` تا ${until}` : ""}{me.days_left != null ? ` (${fd(me.days_left)} روز مانده)` : ""}.</b><p className="sub" style={{ justifyContent: "flex-start" }}>برای تمدید دوباره پرداخت کنید؛ مدت جدید به انتهای اشتراک فعلی اضافه می‌شود.</p></div>}

      <div className="pgrid">
        <section className="card">
          <h3>۱) پلن را انتخاب کنید</h3>
          <div className="plans" role="radiogroup" aria-label="پلن">
            {b.plans.map((p) => (
              <button key={p.id} role="radio" aria-checked={p.id === cur.id} disabled={!!req} className={"plan-opt" + (p.id === cur.id ? " on" : "")} onClick={() => setPlan(p.id)}>
                <b>{p.title}</b><span>{money(p.price)} تومان</span><small>{fd(p.days)} روز</small>
              </button>
            ))}
          </div>
          <ul className="perks">
            <li>کار، عادت و کار تکراری نامحدود (رایگان: {fd(b.limits.todos_per_day)} کار در روز، {fd(b.limits.habits)} عادت، {fd(b.limits.recurring)} کار تکراری)</li>
            <li>تحلیل سالانه، مقایسهٔ هفته‌ها، بهترین روز هفته و تم‌های رنگی</li>
            <li>گزارش هفتگی خودکار و اولویت در پشتیبانی</li>
          </ul>

          {!req && (
            <>
              <label className="fl">کد تخفیف (اختیاری)
                <span className="pw"><input className="inp" dir="ltr" value={coupon} onChange={(e) => { setCoupon(e.target.value); setPreview(null); }} placeholder="مثلاً WELCOME" /><button className="ib" onClick={checkCoupon}>اعمال</button></span>
              </label>
              <p className="sub" style={{ justifyContent: "flex-start" }}>مبلغ: <b>&nbsp;{money(preview ? preview.payable : cur.price)} تومان</b>{preview && <span>&nbsp;(با {money(preview.discount)} تومان تخفیف)</span>}</p>
              {me.pending_payment ? <p className="infoc">رسید قبلی شما در حال بررسی است؛ بعد از نتیجه می‌توانید درخواست جدید بدهید.</p>
                : <button className="btn" style={{ width: "100%" }} disabled={busy} onClick={makeRequest}>۲) دریافت مبلغ دقیق برای واریز</button>}
            </>
          )}

          {req && (
            <>
              <h3>۲) این مبلغ دقیق را کارت‌به‌کارت کنید</h3>
              <div className="cardbox">
                <small>{b.card.bank}</small>
                <div className="cn" dir="ltr">{group(b.card.number)}</div>
                <div className="ch2"><span>به نام: {b.card.holder}</span><button className="btn" onClick={() => copy(b.card.number.replace(/\D/g, ""), "شمارهٔ کارت کپی شد")}>کپی شماره کارت</button></div>
              </div>
              <div className="amount">
                <span>مبلغ دقیق قابل واریز</span>
                <b>{money(req.amount)} تومان</b>
                <button className="btn" onClick={() => copy(String(req.amount), "مبلغ کپی شد")}>کپی مبلغ</button>
              </div>
              <p className="sub" style={{ justifyContent: "flex-start" }}>عدد انتهایی مبلغ برای شناسایی پرداخت شماست؛ لطفاً دقیقاً همین مبلغ را واریز کنید. این درخواست تا {dfmt(req.expires, { timeStyle: "short", dateStyle: "medium" })} معتبر است.</p>
              <button className="link" onClick={cancel}>لغو این درخواست</button>
            </>
          )}
        </section>

        <section className="card">
          <h3>۳) عکس رسید را ارسال کنید</h3>
          {!req ? <p className="empty">ابتدا از ستون کناری «دریافت مبلغ دقیق» را بزنید و واریز کنید.</p> : (
            <>
              <label className={"drop" + (file ? " has" : "")}>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
                {img ? <img src={img} alt="پیش‌نمایش رسید" /> : <span>برای انتخاب عکس رسید ضربه بزنید<small>JPG، PNG یا WEBP، حداکثر ۵ مگابایت</small></span>}
              </label>
              <label className="fl">توضیح (اختیاری)<input className="inp" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً ۴ رقم آخر کارت مبدأ" /></label>
              <button className="btn" style={{ width: "100%" }} disabled={busy || !file} onClick={submit}>{busy ? "در حال ارسال…" : "ثبت رسید و درخواست فعال‌سازی"}</button>
              <p className="sub" style={{ justifyContent: "flex-start", marginTop: 8 }}>بعد از بررسی توسط ادمین، اشتراک فعال می‌شود (معمولاً در همان روز) و در گفتگوی پشتیبانی خبرتان می‌کنیم.</p>
            </>
          )}

          <h3 style={{ marginTop: 22 }}>سابقهٔ پرداخت‌ها</h3>
          {b.payments.length ? (
            <ul className="plist">
              {b.payments.map((p) => (
                <li key={p.id}>
                  <div><b>{b.plans.find((x) => x.id === p.plan)?.title || p.plan}</b><small>{dfmt(p.created, { dateStyle: "medium" })} · {money(p.amount)} تومان{p.discount ? ` (تخفیف ${money(p.discount)})` : ""}</small>{p.admin_note && <small>{p.admin_note}</small>}</div>
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
