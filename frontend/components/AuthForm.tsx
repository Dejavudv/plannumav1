"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Logo } from "./Logo";

/** فرم ورود/ثبت‌نام با نام کاربری و رمز؛ بعد از ورود، کوکی یک‌ساله ماندگار است. */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const reg = mode === "register";
  const [u, setU] = useState(""), [p, setP] = useState(""), [p2, setP2] = useState("");
  const [show, setShow] = useState(false), [err, setErr] = useState(""), [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (reg && p !== p2) { setErr("تکرار رمز عبور با رمز عبور یکی نیست."); return; }
    setBusy(true);
    try {
      await api(reg ? "/auth/register" : "/auth/login", { body: { username: u.trim(), password: p } });
      router.replace("/dashboard");
      router.refresh();
    } catch (ex: any) { setErr(ex?.message || "خطایی رخ داد."); setBusy(false); }
  };

  return (
    <main className="auth">
      <Link href="/" className="authlogo" aria-label="صفحهٔ اصلی"><Logo size={56} /></Link>
      <form className="card" onSubmit={submit} noValidate>
        <h1>{reg ? "ساخت حساب رایگان" : "ورود به پلنوما"}</h1>
        <p className="sub" style={{ justifyContent: "flex-start" }}>{reg ? "فقط نام کاربری و رمز عبور؛ بدون ایمیل و شماره موبایل." : "بعد از ورود، دیگر لازم نیست هر بار وارد شوید."}</p>
        <label>نام کاربری
          <input className="inp" dir="ltr" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
        </label>
        {reg && <small className="hint">۳ تا ۳۰ حرف انگلیسی، عدد، نقطه یا زیرخط</small>}
        <label>رمز عبور
          <span className="pw">
            <input className="inp" dir="ltr" type={show ? "text" : "password"} value={p} onChange={(e) => setP(e.target.value)} autoComplete={reg ? "new-password" : "current-password"} required />
            <button type="button" className="ib" onClick={() => setShow(!show)} aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}>{show ? "🙈" : "👁"}</button>
          </span>
        </label>
        {reg && <small className="hint">حداقل ۸ نویسه؛ رمز ساده یا فقط عدد پذیرفته نمی‌شود.</small>}
        {reg && <label>تکرار رمز عبور<input className="inp" dir="ltr" type={show ? "text" : "password"} value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" required /></label>}
        {err && <div className="err" role="alert">{err}</div>}
        <button className="btn" disabled={busy || !u || !p}>{busy ? "کمی صبر کنید…" : reg ? "ساخت حساب" : "ورود"}</button>
        <p className="alt">{reg ? <>قبلاً ثبت‌نام کرده‌اید؟ <Link href="/login">ورود</Link></> : <>حساب ندارید؟ <Link href="/register">ثبت‌نام رایگان</Link></>}</p>
      </form>
    </main>
  );
}
