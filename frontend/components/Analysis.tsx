"use client";
import { useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { WD, WDN, dfm, fd, fn, fromKey, sched, shift, todayKey, wstart } from "@/lib/date";
import { bestStreak, hAct, hDone, hp, sleepMinutes } from "@/lib/stats";

const COL = ["--c0", "--c1", "--c2", "--c3", "--c4"];
type P = { pl: Planner; me: Me };

/* ------------------------------ تحلیل نموداری ------------------------------ */
export function AnalysisCard({ pl, me }: P) {
  const [rng, setRng] = useState<7 | 30 | 90>(7);
  const { habits, days, ws } = pl, today = todayKey(), s = me.settings;
  const end = shift(ws, 6), n = rng;
  const ds = Array.from({ length: n }, (_, i) => shift(end, -(n - 1 - i)));
  const hs = ds.map((k) => { const p = k > today ? null : hp(habits, days, k); return p == null ? null : p * 100; });
  const ts = ds.map((k) => { const t = days[k]?.todos || []; return k > today || !t.length ? null : (t.filter((i) => i.done).length / t.length) * 100; });
  const sg = ds.map((k) => { const m = sleepMinutes(days[k]?.bed, days[k]?.wake); return m == null ? null : Math.min((m / (s.sleep_goal * 60)) * 100, 100); });
  const wa = ds.map((k) => { const w = days[k]?.water || 0; return w ? Math.min((w / s.water_goal) * 100, 100) : null; });
  const v = hs.filter((x): x is number => x != null), av = v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, perf = v.filter((x) => x >= 99.9).length;
  const rt = habits.map((h) => {
    let p = 0, d = 0;
    ds.forEach((k) => { if (k <= today && k >= h.start && (!h.end || k <= h.end) && sched(h, k)) { p++; if (hDone(days, k, h)) d++; } });
    return { h, p, d, r: p ? (d / p) * 100 : 0 };
  }).sort((a, b) => b.r - a.r);
  const bs = habits.reduce((m, h) => Math.max(m, bestStreak(h, days, today > pl.sel ? today : pl.sel)), 0);

  const W = 600, H = 150, L = 6, T = 8, B = 22, st = (W - 2 * L) / n;
  const xc = (i: number) => L + (n - 1 - i) * st + st / 2;
  const y = (q: number) => T + (H - T - B) * (1 - q / 100);
  const bw = Math.max(st * 0.7, 2), tr = H - T - B;
  const axis = (
    <>
      <line x1={L} x2={W - L} y1={y(50)} y2={y(50)} stroke="var(--ln)" strokeDasharray="4 4" />
      {ds.map((k, i) => {
        const lab = n === 7 ? WD[i] : i % (n > 30 ? 15 : 5) === 0 ? dfm(fromKey(k), { day: "numeric" }) : "";
        return lab ? <text key={k} x={xc(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--mut)">{lab}</text> : null;
      })}
    </>
  );
  const line = (arr: (number | null)[], c: string) => {
    let d = "", pen = false;
    arr.forEach((q, i) => { if (q == null) { pen = false; return; } d += (pen ? "L" : "M") + xc(i).toFixed(1) + " " + y(q).toFixed(1); pen = true; });
    return (
      <g key={c}>
        <path d={d} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {n <= 31 && arr.map((q, i) => (q == null ? null : <circle key={i} cx={xc(i)} cy={y(q)} r="2.6" fill={c} />))}
      </g>
    );
  };
  const S: [string, (number | null)[], string][] = [["عادت‌ها", hs, "var(--ok)"], ["کارها", ts, "var(--ac)"], ["خواب", sg, "var(--sleep)"], ["آب", wa, "var(--water)"]];

  const h0 = shift(ws, -77), cells: React.ReactNode[] = [];
  for (let w = 0; w < 12; w++) for (let r = 0; r < 7; r++) {
    const k = shift(h0, w * 7 + r), q = k > today ? null : hp(habits, days, k), pc = q == null ? null : Math.round(q * 100);
    const lbl = dfm(fromKey(k), { day: "numeric", month: "long" }) + (pc == null ? "" : ": " + fd(pc) + "٪");
    cells.push(
      <button key={k} aria-pressed={k === pl.sel} title={lbl} aria-label={lbl} onClick={() => pl.setSel(k)}
        style={{ background: pc == null ? "var(--ln)" : `color-mix(in srgb, var(--ok) ${Math.max(pc, pc ? 12 : 0)}%, var(--ln))`, opacity: q == null ? 0.35 : 1 }} />
    );
  }

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="ch">
        <h3>تحلیل نموداری</h3>
        <div className="rg" role="group" aria-label="بازه">
          {([[7, "هفته"], [30, "۳۰ روز"], [90, "۹۰ روز"]] as const).map(([r, l]) => (
            <button key={r} aria-pressed={rng === r} onClick={() => setRng(r)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="kp">
        <div><b>{fd(Math.round(av))}٪</b><span>میانگین انجام عادت‌ها</span></div>
        <div><b>{fd(perf)}</b><span>روز با ۱۰۰٪ تکمیل</span></div>
        <div><b>{fd(bs)} روز</b><span>بهترین رکورد پیاپی</span></div>
        <div><b className="tx">{rt.length && rt[0].p ? rt[0].h.name : "—"}</b><span>پایدارترین عادت</span></div>
      </div>
      <div className="ag">
        <div className="ap">
          <h4>درصد تکمیل عادت‌ها در هر روز</h4>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="درصد تکمیل عادت‌ها در هر روز">
            {axis}
            {hs.map((q, i) => (
              <g key={i}>
                <rect x={xc(i) - bw / 2} y={T} width={bw} height={tr} rx="3" fill="var(--sf)" />
                {q != null && (
                  <rect x={xc(i) - bw / 2} y={y(q)} width={bw} height={Math.max((tr * q) / 100, q > 0 ? 2 : 0)} rx="3" fill="var(--ok)">
                    <title>{dfm(fromKey(ds[i]), { day: "numeric", month: "long" })}: {fd(Math.round(q))}٪</title>
                  </rect>
                )}
              </g>
            ))}
          </svg>
        </div>
        <div className="ap">
          <h4>روند کلی (٪ از هدف)</h4>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="روند عادت‌ها، کارها، خواب و آب">{axis}{S.map((x) => line(x[1], x[2]))}</svg>
          <div className="lg">{S.map((x) => <span key={x[0]}><i style={{ ["--k" as any]: x[2] }} />{x[0]}</span>)}</div>
        </div>
        <div className="ap">
          <h4>نرخ انجام هر عادت</h4>
          {rt.length ? rt.map((o) => (
            <div className="hbr" key={o.h.id}>
              <span className="tx">{o.h.name}</span>
              <div className="bar"><i style={{ width: `${o.r}%`, background: `var(${COL[o.h.color % 5]})` }} /></div>
              <b>{fd(Math.round(o.r))}٪ <small>{fd(o.d)}/{fd(o.p)}</small></b>
            </div>
          )) : <div className="empty">برای دیدن تحلیل، چند عادت اضافه کنید.</div>}
        </div>
        <div className="ap">
          <h4>نقشهٔ پایداری</h4>
          <div className="hmw"><div className="hml">{WD.map((d) => <span key={d}>{d}</span>)}</div><div className="hmg">{cells}</div></div>
          <div className="lg">۱۲ هفتهٔ اخیر؛ هرچه پررنگ‌تر، عادت‌های بیشتری انجام شده</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ خلاصهٔ هفته ------------------------------ */
export function SummaryCard({ pl, me }: P) {
  const { habits, days, ws } = pl, s = me.settings;
  const ks = Array.from({ length: 7 }, (_, i) => shift(ws, i));
  const X = ks.map((k) => days[k]);
  const fr = (a: number, b: number) => (b ? `${fd(a)}/${fd(b)}` : "—");
  const tot = (a: number[][]) => fr(a.reduce((p, c) => p + c[0], 0), a.reduce((p, c) => p + c[1], 0));
  const td = X.map((x) => [x ? x.todos.filter((i) => i.done).length : 0, x ? x.todos.length : 0]);
  const hb = ks.map((k) => { const a = hAct(habits, k); return [a.filter((h) => hDone(days, k, h)).length, a.length]; });
  const sl = X.map((x) => (x ? sleepMinutes(x.bed, x.wake) : null)), sv = sl.filter((m): m is number => m != null);
  const hv = (m: number) => fn(Math.round(m / 6) / 10) + " س";
  const wv = X.filter((x) => x && x.water > 0) as NonNullable<(typeof X)[number]>[];
  const R: [string, string[], string][] = [
    ["عادت‌ها", hb.map((v) => fr(v[0], v[1])), tot(hb)],
    ["کارهای روز", td.map((v) => fr(v[0], v[1])), tot(td)],
    ["خواب", sl.map((v) => (v == null ? "—" : hv(v))), sv.length ? "میانگین " + hv(sv.reduce((a, b) => a + b, 0) / sv.length) : "—"],
    ["آب", X.map((x) => (x && x.water ? fn((x.water * s.glass_ml) / 1000) + " ل" : "—")), wv.length ? "میانگین " + fn(Math.round((wv.reduce((a, x) => a + x.water, 0) / wv.length) * s.glass_ml / 100) / 10) + " ل" : "—"],
    ["یادداشت", X.map((x) => (x && x.note ? "✓" : "—")), fd(X.filter((x) => x && x.note).length) + " روز"],
  ];
  const f = (k: string, o: Intl.DateTimeFormatOptions) => dfm(fromKey(k), o);
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div className="ch"><h3>خلاصه هفته</h3><span className="badge">{f(ks[0], { day: "numeric", month: "long" })} تا {f(ks[6], { day: "numeric", month: "long" })}</span></div>
      <div className="tw">
        <table className="st">
          <thead>
            <tr>
              <th />
              {ks.map((k) => <th key={k} className={k === pl.sel ? "cs" : ""}><button onClick={() => pl.setSel(k)}>{f(k, { weekday: "short" })} {f(k, { day: "numeric" })}</button></th>)}
              <th>هفته</th>
            </tr>
          </thead>
          <tbody>
            {R.map((r) => <tr key={r[0]}><td>{r[0]}</td>{r[1].map((c, i) => <td key={i}>{c}</td>)}<td>{r[2]}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
