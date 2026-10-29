"use client";
import { useEffect, useRef, useState } from "react";
import type { Block, Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { api } from "@/lib/api";
import { useRun } from "@/lib/toast";
import { dur, fd, fmt, fn, pad, tmin, todayKey } from "@/lib/date";
import { sleepMinutes } from "@/lib/stats";

const COL = ["--c0", "--c1", "--c2", "--c3", "--c4"];
const HH = 44;
type P = { pl: Planner; me: Me; refresh: () => Promise<void> };

/** چیدمان بلوک‌های هم‌پوشان کنار هم */
type LB = Block & { l: number; n: number };
function layout(bs: Block[]): LB[] {
  const s: LB[] = bs.map((b) => ({ ...b, l: 0, n: 1 })).sort((a, b) => a.start - b.start || b.end - a.end);
  let cl: LB[] = [], ce = 0, ln: number[] = [];
  const out: LB[] = [];
  const fl = () => { cl.forEach((b) => (b.n = ln.length)); out.push(...cl); cl = []; ln = []; };
  for (const b of s) {
    if (cl.length && b.start >= ce) fl();
    let i = ln.findIndex((e) => e <= b.start);
    if (i < 0) { i = ln.length; ln.push(0); }
    ln[i] = b.end; b.l = i; cl.push(b); ce = Math.max(ce, b.end);
  }
  fl();
  return out;
}

/* ------------------------------ تایم‌باکس ------------------------------ */
export function TimeCard({ pl }: { pl: Planner }) {
  const run = useRun();
  const [t, setT] = useState(""), [s, setS] = useState("09:00"), [e, setE] = useState("10:00"), [c, setC] = useState(0);
  const sc = useRef<HTMLDivElement>(null);
  const k = pl.sel, bs = pl.day(k).blocks;
  const used = new Array(1440).fill(0);
  bs.forEach((b) => { for (let i = b.start; i < b.end; i++) used[i] = 1; });
  const u = used.reduce((a: number, b: number) => a + b, 0);
  const isToday = k === todayKey();
  const now = new Date();

  useEffect(() => { if (sc.current) sc.current.scrollTop = 6.5 * HH; }, [k]);

  const add = () => run(async () => {
    const a = tmin(s);
    let b = tmin(e);
    if (b === 0) b = 1440;
    if (!t.trim()) throw new Error("عنوان بلوک را بنویسید.");
    if (a == null || b == null || b <= a) throw new Error("زمان پایان باید بعد از شروع باشد.");
    await pl.addBlock(k, { title: t.trim(), start: a, end: b, color: c });
    setT("");
  });

  return (
    <section className="card">
      <div className="ch"><h3>تایم‌باکس ۲۴ ساعته</h3><span className="badge">برنامه‌ریزی‌شده: {dur(u)} · آزاد: {dur(1440 - u)}</span></div>
      <div className="tform">
        <input className="inp t" value={t} maxLength={120} placeholder="عنوان بلوک، مثلاً کار عمیق" aria-label="عنوان بلوک" autoComplete="off"
          onChange={(ev) => setT(ev.target.value)} onKeyDown={(ev) => { if (ev.key === "Enter" && !ev.nativeEvent.isComposing) add(); }} />
        <label>شروع<input className="inp" type="time" value={s} onChange={(ev) => setS(ev.target.value)} /></label>
        <label>پایان<input className="inp" type="time" value={e} onChange={(ev) => setE(ev.target.value)} /></label>
        <div className="tf-r">
          <div className="sw" role="group" aria-label="رنگ">
            {COL.map((cc, i) => (
              <button key={i} type="button" style={{ "--k": `var(${cc})` } as React.CSSProperties} aria-pressed={i === c} aria-label={`رنگ ${fd(i + 1)}`} onClick={() => setC(i)} />
            ))}
          </div>
          <button type="button" className="btn" onClick={add}>افزودن بلوک</button>
        </div>
      </div>
      <div className="tscroll" ref={sc}>
        <div className="tl">
          {Array.from({ length: 24 }, (_, i) => (
            <div className="hr" key={i} onClick={() => { setS(`${pad(i)}:00`); setE(i === 23 ? "23:59" : `${pad(i + 1)}:00`); }}>
              <span>{fd(pad(i))}:۰۰</span>
            </div>
          ))}
          {layout(bs).map((b) => (
            <div className="blk" key={b.id} style={{
              "--k": `var(${COL[b.color % 5]})`, top: (b.start / 60) * HH, height: Math.max(((b.end - b.start) / 60) * HH - 2, 18),
              insetInlineStart: `calc(54px + (100% - 60px)*${b.l / b.n})`, width: `calc((100% - 60px)/${b.n} - 3px)`,
            } as React.CSSProperties}>
              <div><b>{b.title}</b>{b.end - b.start >= 40 && <em>{fmt(b.start)} تا {fmt(b.end)}</em>}</div>
              <button aria-label="حذف بلوک" onClick={() => run(() => pl.delBlock(k, b.id))}>×</button>
            </div>
          ))}
          {isToday && <div className="now" style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HH }} />}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ خواب ------------------------------ */
export function SleepCard({ pl, me, refresh }: P) {
  const run = useRun();
  const k = pl.sel, d = pl.day(k), goal = me.settings.sleep_goal;
  const m = sleepMinutes(d.bed, d.wake);
  const setGoal = (delta: number) => run(async () => {
    await api("/settings", { method: "PATCH", body: { sleep_goal: Math.min(14, Math.max(4, goal + delta)) } });
    await refresh();
  });
  return (
    <section className="card">
      <div className="ch"><h3>لاگ خواب</h3><span className="badge">هدف: {dur(goal * 60)}</span></div>
      <div className="fld">
        <label>خواب رفتن (شب قبل)<input className="inp" type="time" value={d.bed} onChange={(e) => run(() => pl.saveDay(k, { bed: e.target.value }))} /></label>
        <label>بیدار شدن<input className="inp" type="time" value={d.wake} onChange={(e) => run(() => pl.saveDay(k, { wake: e.target.value }))} /></label>
      </div>
      <div className="big" style={{ color: "var(--sleep)" }}>{m != null ? dur(m) : "—"}</div>
      <div className="bar" style={{ margin: "6px 0 4px" }}><i style={{ width: `${m ? Math.min((m / (goal * 60)) * 100, 100) : 0}%`, background: "var(--sleep)" }} /></div>
      <div className="sub"><span>کیفیت خواب</span></div>
      <div className="stars" role="group" aria-label="کیفیت خواب">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} className={d.q >= i ? "on" : ""} aria-label={`${fd(i)} ستاره`} onClick={() => run(() => pl.saveDay(k, { q: d.q === i ? 0 : i }))}>★</button>
        ))}
      </div>
      <div className="ctl" style={{ marginTop: 14 }}>
        <span className="sub" style={{ margin: 0 }}>هدف خواب</span>
        <button className="rb" style={{ width: 32, height: 32, fontSize: 18 }} aria-label="کم کردن هدف خواب" onClick={() => setGoal(-0.5)}>−</button>
        <b>{dur(goal * 60)}</b>
        <button className="rb" style={{ width: 32, height: 32, fontSize: 18 }} aria-label="زیاد کردن هدف خواب" onClick={() => setGoal(0.5)}>+</button>
      </div>
    </section>
  );
}

/* ------------------------------ آب ------------------------------ */
export function WaterCard({ pl, me, refresh }: P) {
  const run = useRun();
  const k = pl.sel, w = pl.day(k).water, g = me.settings.water_goal, gl = me.settings.glass_ml, n = Math.max(g, w);
  const setSetting = (body: any) => run(async () => { await api("/settings", { method: "PATCH", body }); await refresh(); });
  return (
    <section className="card">
      <div className="ch"><h3>لاگ آب</h3><span className="badge">{fd(Math.round(Math.min(w / g, 1) * 100))}٪ هدف</span></div>
      <div className="big" style={{ color: "var(--water)" }}>{fn((w * gl) / 1000)} <small>لیتر · {fd(w)} از {fd(g)} لیوان</small></div>
      <div className="gl">{Array.from({ length: n }, (_, i) => <i key={i} className={i < w ? "on" : ""} />)}</div>
      <div className="ctl">
        <button className="rb" aria-label="کم کردن یک لیوان" onClick={() => run(() => pl.saveDay(k, { water: Math.max(0, w - 1) }))}>−</button>
        <button className="rb p" aria-label="اضافه کردن یک لیوان" onClick={() => run(() => pl.saveDay(k, { water: Math.min(60, w + 1) }))}>+</button>
        <span style={{ flex: 1 }} />
        <label className="sub" style={{ margin: 0, alignItems: "center" }}>لیوان{" "}
          <select className="sel" value={gl} onChange={(e) => setSetting({ glass_ml: Number(e.target.value) })}>
            {[150, 200, 250, 300, 500].map((v) => <option key={v} value={v}>{fd(v)} میلی‌لیتر</option>)}
          </select>
        </label>
      </div>
      <div className="ctl" style={{ marginTop: 10 }}>
        <span className="sub" style={{ margin: 0 }}>هدف روزانه</span>
        <button className="rb" style={{ width: 32, height: 32, fontSize: 18 }} aria-label="کم کردن هدف" onClick={() => setSetting({ water_goal: Math.max(1, g - 1) })}>−</button>
        <b>{fd(g)}</b>
        <button className="rb" style={{ width: 32, height: 32, fontSize: 18 }} aria-label="زیاد کردن هدف" onClick={() => setSetting({ water_goal: Math.min(30, g + 1) })}>+</button>
      </div>
    </section>
  );
}
