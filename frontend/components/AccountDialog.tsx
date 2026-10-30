"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { api } from "@/lib/api";
import { useRun, useToast } from "@/lib/toast";
import { disablePush, enablePush, pushSupported } from "@/lib/push";
import { detailCsvToBackup } from "@/lib/csvImport";
import { fd } from "@/lib/date";

const ACCENTS: [string, string][] = [["پیش‌فرض", "#4A2A7A"], ["سبزآبی", "#0B7F72"], ["نارنجی", "#C2410C"], ["آبی", "#1D4ED8"], ["صورتی", "#BE185D"]];
type Props = { open: boolean; onClose: () => void; me: Me; refresh: () => Promise<void>; pl: Planner };

/** حساب کاربری: تغییر رمز (الزامی بعد از رمز موقت)، اعلان‌ها، تم رنگی، پشتیبان‌گیری/بازیابی، حذف حساب */
export function AccountDialog({ open, onClose, me, refresh, pl }: Props) {
  const run = useRun();
  const toast = useToast();
  const router = useRouter();
  const forced = me.must_change_password;
  const [cur, setCur] = useState(""), [nw, setNw] = useState(""), [nw2, setNw2] = useState("");
  const [dpw, setDpw] = useState(""), [dok, setDok] = useState(false);

  const changePw = () => run(async () => {
    if (nw !== nw2) throw new Error("تکرار رمز جدید یکی نیست.");
    await api("/auth/password", { body: { current: cur, new: nw } });
    setCur(""); setNw(""); setNw2("");
    toast("رمز عبور تغییر کرد. دستگاه‌های دیگر خارج شدند.");
    await refresh();
  });
  const togglePush = () => run(async () => {
    if (me.push_enabled) { await disablePush(); toast("اعلان‌ها خاموش شد."); }
    else { await enablePush(me.vapid_public_key); toast("اعلان‌ها روشن شد."); }
    await refresh();
  });
  const testPush = () => run(async () => {
    const r = await api<{ sent: number; ready: boolean }>("/push/test", { body: {} });
    toast(!r.ready ? "اعلان در سرور فعال نشده است." : r.sent ? "اعلان آزمایشی ارسال شد." : "اعلانی ارسال نشد؛ اعلان‌ها را دوباره روشن کنید.");
  });
  const pickAccent = (i: number) => run(async () => {
    await api("/settings", { method: "PATCH", body: { accent: i } });
    try { localStorage.setItem("pl_accent", String(i)); } catch { /* ignore */ }
    await refresh();
  });
  const restore = (f?: File) => run(async () => {
    if (!f) return;
    const text = await f.text();
    const data = f.name.toLowerCase().endsWith(".csv") ? detailCsvToBackup(text) : JSON.parse(text);
    const r = await api<Record<string, number>>("/restore", { body: data });
    toast(`وارد شد: ${fd(r.habits)} عادت، ${fd(r.todos)} کار، ${fd(r.blocks)} بلوک، ${fd(r.checks)} تیک${r.skipped ? ` (${fd(r.skipped)} مورد به‌خاطر سقف رایگان رد شد)` : ""}`);
    pl.reload();
  });
  const del = () => run(async () => {
    await api("/auth/delete", { body: { password: dpw } });
    router.replace("/");
    router.refresh();
  });

  return (
    <Modal open={open} onClose={onClose} title={forced ? "رمز جدید بگذارید" : "حساب کاربری و تنظیمات"} wide locked={forced}>
      {forced && <p className="infoc">رمز شما توسط پشتیبانی به‌صورت موقت تنظیم شده است. برای ادامه، رمز جدید انتخاب کنید.</p>}
      <section className="acc">
        <h4>🔑 تغییر رمز عبور</h4>
        <div className="fl"><label>رمز فعلی{forced ? " (رمز موقت)" : ""}<input className="inp" dir="ltr" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label></div>
        <div className="fld">
          <label>رمز جدید<input className="inp" dir="ltr" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} /></label>
          <label>تکرار رمز جدید<input className="inp" dir="ltr" type="password" autoComplete="new-password" value={nw2} onChange={(e) => setNw2(e.target.value)} /></label>
        </div>
        <small className="hint">حداقل ۸ نویسه؛ رمز ساده یا فقط عدد پذیرفته نمی‌شود.</small>
        <div className="dacts"><button className="btn" disabled={!cur || !nw} onClick={changePw}>تغییر رمز</button></div>
      </section>

      {!forced && (
        <>
          <section className="acc">
            <h4>🔔 اعلان یادآوری عادت‌ها</h4>
            {!me.vapid_public_key ? <p className="sub" style={{ justifyContent: "flex-start" }}>اعلان‌ها هنوز در سرور فعال نشده‌اند (مدیر باید کلید VAPID را تنظیم کند).</p>
              : !pushSupported() ? <p className="sub" style={{ justifyContent: "flex-start" }}>این مرورگر اعلان را پشتیبانی نمی‌کند. روی آیفون ابتدا برنامه را به صفحهٔ اصلی اضافه کنید (منو ← نصب برنامه).</p>
              : <div className="dacts" style={{ marginTop: 0 }}><button className="btn" onClick={togglePush}>{me.push_enabled ? "خاموش کردن اعلان‌ها" : "روشن کردن اعلان‌ها"}</button>{me.push_enabled && <button className="ib" onClick={testPush}>ارسال اعلان آزمایشی</button>}</div>}
            <small className="hint">ساعت یادآوری هر عادت را از «ویرایش عادت‌ها» تعیین کنید.</small>
          </section>

          <section className="acc">
            <h4>🎨 تم رنگی {me.plan.is_pro ? "" : "(مخصوص پرو)"}</h4>
            <div className="sw" role="group" aria-label="تم رنگی">
              {ACCENTS.map(([n, c], i) => <button key={i} style={{ "--k": c } as React.CSSProperties} aria-pressed={me.accent === i} aria-label={n} title={n + (i && !me.plan.is_pro ? " (پرو)" : "")} onClick={() => pickAccent(i)} />)}
            </div>
          </section>

          <section className="acc">
            <h4>💾 پشتیبان‌گیری و انتقال داده</h4>
            <p className="sub" style={{ justifyContent: "flex-start", margin: "0 0 8px" }}>فایل JSON همهٔ داده‌های شماست. بازیابی به‌صورت «ادغام» است و چیزی را پاک یا بازنویسی نمی‌کند (سقف رایگان رعایت می‌شود). فایل CSV «جزئیات» هم قابل ورود است.</p>
            <div className="dacts" style={{ marginTop: 0 }}>
              <a className="btn" href="/api/backup" download>دانلود پشتیبان (JSON)</a>
              <label className="ib" style={{ cursor: "pointer" }}>وارد کردن فایل…<input type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </div>
          </section>

          <section className="acc danger">
            <h4>⚠ حذف حساب</h4>
            <p className="sub" style={{ justifyContent: "flex-start", margin: "0 0 8px" }}>همهٔ داده‌ها و رسیدهای شما برای همیشه پاک می‌شود. قبلش پشتیبان بگیرید.</p>
            <div className="fl"><label>رمز عبور<input className="inp" dir="ltr" type="password" autoComplete="current-password" value={dpw} onChange={(e) => setDpw(e.target.value)} /></label></div>
            <label className="opt"><input type="checkbox" checked={dok} onChange={(e) => setDok(e.target.checked)} />متوجه هستم و می‌خواهم حسابم حذف شود</label>
            <div className="dacts"><button className="btn dng" disabled={!dpw || !dok} onClick={del}>حذف دائمی حساب</button><button className="ib" onClick={onClose}>بستن</button></div>
          </section>
        </>
      )}
    </Modal>
  );
}
