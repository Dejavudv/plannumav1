"use client";
import { useEffect, useRef, useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { useRun } from "@/lib/toast";
import { WDN, fd, sched, schedLabel, shift, wstart } from "@/lib/date";
import { hAct, hDone, streak } from "@/lib/stats";
import { Upsell } from "./Upsell";

const COL = ["--c0", "--c1", "--c2", "--c3", "--c4"];
type P = { pl: Planner; me: Me };

/* ------------------------------ کارهای روز ------------------------------ */
export function TodoCard({ pl, me }: P) {
  const run = useRun();
  const [txt, setTxt] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [ev, setEv] = useState("");
  const k = pl.sel, L = pl.day(k).todos, n = L.filter((t) => t.done).length, p = L.length ? (n / L.length) * 100 : 0;
  const lim = me.limits?.todos_per_day, full = !!lim && L.length >= lim;
  const add = () => {
    const v = txt.trim();
    if (!v) return;
    run(async () => { await pl.addTodo(k, v); setTxt(""); });
  };
  const carry = () => run(async () => {
    const prev = pl.day(shift(k, -1)).todos.filter((t) => !t.done && !L.some((x) => x.title === t.title));
    let c = 0;
    for (const t of prev) { if (lim && L.length + c >= lim) break; await pl.addTodo(k, t.title); c++; }
    if (!c) throw new Error("چیزی برای انتقال از روز قبل نبود.");
  });
  return (
    <section className="card">
      <div className="ch"><h3>کارهای روز</h3><span className="badge">{fd(n)} از {fd(L.length)}{lim ? ` · سقف ${fd(lim)}` : ""}</span></div>
      <div className="bar"><i style={{ width: `${p}%` }} /></div>
      {full ? (
        <Upsell text={`در نسخهٔ رایگان حداکثر ${fd(lim!)} کار در هر روز دارید.`} />
      ) : (
        <div className="add">
          <input className="inp" value={txt} placeholder="کار جدید را بنویسید" aria-label="کار جدید" autoComplete="off" maxLength={200}
            onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} />
          <button type="button" className="btn" onClick={add}>افزودن</button>
        </div>
      )}
      <ul className="list">
        {L.map((t) => editId === t.id ? (
          <li key={t.id} className="ed">
            <input className="inp" value={ev} maxLength={200} autoFocus aria-label="ویرایش کار" onChange={(e) => setEv(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditId(null);
                if (e.key === "Enter" && !e.nativeEvent.isComposing && ev.trim()) run(async () => { await pl.editTodo(k, t.id, ev.trim()); setEditId(null); });
              }} />
            <label className="mv">انتقال به روز دیگر
              <input className="inp" type="date" onChange={(e) => { if (e.target.value) run(async () => { await pl.moveTodo(k, t.id, e.target.value); setEditId(null); }); }} />
            </label>
            <button className="btn" onClick={() => ev.trim() && run(async () => { await pl.editTodo(k, t.id, ev.trim()); setEditId(null); })}>ذخیره</button>
            <button className="x" aria-label="لغو" onClick={() => setEditId(null)}>×</button>
          </li>
        ) : (
          <li key={t.id} className={t.done ? "done" : ""}>
            <label>
              <input type="checkbox" checked={t.done} onChange={(e) => run(() => pl.toggleTodo(k, t.id, e.target.checked))} />
              <span className="ck" /><span className="tx">{t.title}</span>
            </label>
            <span className="acts2">
              <button className="x" aria-label="ویرایش" title="ویرایش یا انتقال به روز دیگر" onClick={() => { setEditId(t.id); setEv(t.title); }}>✎</button>
              <button className="x" title="انتقال به فردا" onClick={() => run(() => pl.moveTodo(k, t.id, shift(k, 1)))}>فردا</button>
              <button className="x" aria-label="حذف" onClick={() => run(() => pl.delTodo(k, t.id))}>×</button>
            </span>
          </li>
        ))}
        {!L.length && <li className="empty">هنوز موردی اضافه نشده است.</li>}
      </ul>
      <div className="acts">
        <button className="link" onClick={carry}>انتقال ناتمام‌ها از روز قبل</button>
        {n > 0 && <button className="link" onClick={() => run(() => pl.clearDone(k))}>پاک‌کردن انجام‌شده‌ها</button>}
      </div>
    </section>
  );
}

/* ------------------------------ هبیت ترکر ------------------------------ */
const PRESETS = ["ورزش", "مطالعه", "مدیتیشن", "نوشیدن آب", "پیاده‌روی", "خواب زود"];

export function HabitCard({ pl, me, onPacks }: P & { onPacks: () => void }) {
  const run = useRun();
  const [man, setMan] = useState(false);
  const [delId, setDelId] = useState<number | null>(null);
  const [txt, setTxt] = useState("");
  const [sc, setSc] = useState("a");
  const { habits, days, sel } = pl;
  const lim = me.limits?.habits, full = !!lim && habits.filter((h) => !h.end).length >= lim;
  const a = hAct(habits, sel), dn = a.filter((h) => hDone(days, sel, h)).length, p = a.length ? (dn / a.length) * 100 : 0;
  const wk = Array.from({ length: 7 }, (_, i) => shift(wstart(sel), i));
  const H = habits.filter((h) => man || ((!h.end || sel <= h.end) && sched(h, sel)));
  const add = (name: string, w: number[]) => run(async () => { await pl.addHabit(name, w); setTxt(""); });
  const submit = () => {
    const v = txt.trim();
    if (!v) return;
    add(v, sc === "a" ? [0, 1, 2, 3, 4, 5, 6] : [Number(sc)]);
  };
  const pre = PRESETS.filter((n) => !habits.some((h) => h.name === n));

  return (
    <section className="card">
      <div className="ch"><h3>هبیت ترکر</h3><span className="badge">{fd(dn)} از {fd(a.length)} امروز{lim ? ` · سقف ${fd(lim)} عادت` : ""}</span></div>
      <div className="bar"><i style={{ width: `${p}%`, background: "var(--ok)" }} /></div>
      <ul className="list hl">
        {H.map((h, idx) => {
          const st = { "--k": `var(${COL[h.color % 5]})` } as React.CSSProperties;
          if (man) {
            return (
              <li key={h.id} style={st}>
                <div className="hed">
                  <input className="inp" defaultValue={h.name} key={h.name} aria-label="نام عادت" maxLength={100}
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== h.name) run(() => pl.patchHabit(h.id, { name: v })); }} />
                </div>
                <label className="rem">یادآوری
                  <input className="inp" type="time" value={h.reminder || ""} aria-label="ساعت یادآوری"
                    onChange={(e) => run(() => pl.patchHabit(h.id, { reminder: e.target.value }))} />
                  {h.reminder && <button className="x" aria-label="حذف یادآوری" onClick={() => run(() => pl.patchHabit(h.id, { reminder: "" }))}>×</button>}
                </label>
                <div className="chips" style={{ margin: 0 }} role="group" aria-label="روزهای تکرار">
                  {WDN.map((d, j) => (
                    <button key={j} className="chip" aria-pressed={h.weekdays.includes(j)}
                      onClick={() => run(async () => {
                        const w = h.weekdays.includes(j) ? h.weekdays.filter((x) => x !== j) : [...h.weekdays, j];
                        if (!w.length) throw new Error("حداقل یک روز لازم است.");
                        await pl.patchHabit(h.id, { weekdays: w });
                      })}>{d}</button>
                  ))}
                </div>
                <div className="hh">
                  <div className="sw">
                    {COL.map((c, j) => (
                      <button key={j} style={{ "--k": `var(${c})` } as React.CSSProperties} aria-pressed={j === h.color % 5} aria-label={`رنگ ${fd(j + 1)}`}
                        onClick={() => run(() => pl.patchHabit(h.id, { color: j }))} />
                    ))}
                  </div>
                  <div>
                    <button className="x" aria-label="بالا" disabled={idx === 0} onClick={() => run(() => pl.moveHabit(h.id, -1))}>↑</button>
                    <button className="x" aria-label="پایین" disabled={idx === H.length - 1} onClick={() => run(() => pl.moveHabit(h.id, 1))}>↓</button>
                    <button className="link" onClick={() => run(() => pl.patchHabit(h.id, { end: h.end ? null : shift(wstart(sel), 6) }))}>{h.end ? "ادامه" : "توقف"}</button>{" "}
                    <button className="link" style={{ color: "var(--c3)" }}
                      onClick={() => { if (delId === h.id) { setDelId(null); run(() => pl.delHabit(h.id)); } else setDelId(h.id); }}>
                      {delId === h.id ? "حذف شود؟ تأیید" : "حذف"}
                    </button>
                  </div>
                </div>
              </li>
            );
          }
          const cnt = wk.filter((k) => sched(h, k) && hDone(days, k, h)).length, tot = h.weekdays.length, dd = hDone(days, sel, h), s = streak(h, days, sel);
          return (
            <li key={h.id} className={dd ? "done" : ""} style={st}>
              <div className="hh">
                <label>
                  <input type="checkbox" checked={dd} onChange={(e) => run(() => pl.toggleCheck(h.id, sel, e.target.checked))} />
                  <span className="ck" /><span className="tx">{h.name}</span>
                </label>
                <span className="fire">{s ? `🔥 ${fd(s)} روز پیاپی` : "—"}</span>
              </div>
              <div className="sub" style={{ margin: 0 }}>{schedLabel(h)} · {fd(cnt)} از {fd(tot)} این هفته{cnt >= tot ? " ✓" : ""}</div>
            </li>
          );
        })}
        {!H.length && <li className="empty">{habits.length ? "برای این روز عادتی برنامه‌ریزی نشده است." : "هنوز عادتی تعریف نشده؛ یکی بسازید یا از پیشنهادها انتخاب کنید."}</li>}
      </ul>
      {full ? (
        <Upsell text={`در نسخهٔ رایگان حداکثر ${fd(lim!)} عادت فعال دارید.`} />
      ) : (
        <>
          <div className="add">
            <input className="inp" value={txt} placeholder="عادت جدید، مثلاً مطالعه" aria-label="عادت جدید" autoComplete="off" maxLength={100}
              onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(); }} />
            <select className="sel" style={{ height: 40 }} value={sc} onChange={(e) => setSc(e.target.value)} aria-label="تکرار عادت">
              <option value="a">هر روز</option>
              {WDN.map((d, i) => <option key={i} value={i}>{d}‌ها</option>)}
            </select>
            <button type="button" className="btn" onClick={submit}>افزودن</button>
          </div>
          <div className="chips">
            {pre.slice(0, 5).map((n) => <button key={n} className="chip" onClick={() => add(n, [0, 1, 2, 3, 4, 5, 6])}>+ {n}</button>)}
            <button className="chip" onClick={onPacks}>📦 قالب‌های آماده</button>
          </div>
        </>
      )}
      {habits.length > 0 && <div className="acts"><button className="link" onClick={() => { setMan(!man); setDelId(null); }}>{man ? "پایان ویرایش" : "ویرایش، ترتیب و حذف عادت‌ها"}</button></div>}
    </section>
  );
}

/* ------------------------------ یادداشت روز ------------------------------ */
export function NotesCard({ pl }: { pl: Planner }) {
  return <NotesInner key={pl.sel} pl={pl} k={pl.sel} />;
}
function NotesInner({ pl, k }: { pl: Planner; k: string }) {
  const run = useRun();
  const server = pl.day(k).note;
  const [v, setV] = useState(server);
  const dirty = useRef(false), timer = useRef<any>(null), vRef = useRef(server), saver = useRef(pl.saveDay);
  saver.current = pl.saveDay;
  useEffect(() => { if (!dirty.current) { setV(server); vRef.current = server; } }, [server]);
  // اگر روز عوض شد و تغییر ذخیره‌نشده داشتیم، همان لحظه ذخیره شود
  useEffect(() => () => { if (dirty.current) { clearTimeout(timer.current); saver.current(k, { note: vRef.current }).catch(() => {}); } }, [k]);
  const save = (val: string) => { clearTimeout(timer.current); run(async () => { await pl.saveDay(k, { note: val }); dirty.current = false; }); };
  return (
    <section className="card">
      <div className="ch"><h3>یادداشت روز</h3><span className="badge">{fd(v.length)} کاراکتر</span></div>
      <textarea className="inp ta" value={v} maxLength={5000} aria-label="یادداشت روز" placeholder="امروز چه گذشت؟ ایده، حس، چیزی که نباید فراموش شود…"
        onChange={(e) => {
          const val = e.target.value;
          dirty.current = true; vRef.current = val; setV(val);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => save(val), 800);
        }}
        onBlur={() => { if (dirty.current) save(v); }} />
      <div className="sub" style={{ margin: "6px 0 0" }}>ذخیره خودکار</div>
    </section>
  );
}
