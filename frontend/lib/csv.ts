import type { Day, Habit, Settings } from "./types";
import { JMN, SEA, WDN, di, hm, jp, pad, sched, shift, todayKey, wstart } from "./date";
import { hDone } from "./stats";

export type Kind = "week" | "month" | "season" | "all";
export type Fmt = "daily" | "detail";
const r1 = (v: number) => Math.round(v * 10) / 10;

/** بازهٔ هفته/ماه شمسی/فصل شمسی/کل داده‌ها بر اساس روز انتخاب‌شده */
export function span(kind: Kind, sel: string, first: string | null): [string, string] {
  if (kind === "week") { const a = wstart(sel); return [a, shift(a, 6)]; }
  if (kind === "all") { const t = todayKey(); return [first && first < sel ? first : sel, sel > t ? sel : t]; }
  const c = jp(sel);
  const f = kind === "month" ? (q: { m: number }) => q.m : (q: { m: number }) => Math.floor((q.m - 1) / 3);
  const v = f(c);
  let a = sel, b = sel;
  for (let i = 0; i < 100; i++) { const q = shift(a, -1), j = jp(q); if (f(j) === v && j.y === c.y) a = q; else break; }
  for (let i = 0; i < 100; i++) { const q = shift(b, 1), j = jp(q); if (f(j) === v && j.y === c.y) b = q; else break; }
  return [a, b];
}

export function dayList(a: string, b: string) {
  const r: string[] = [];
  for (let k = a, i = 0; k <= b && i < 4000; k = shift(k, 1), i++) r.push(k);
  return r;
}

const csvEsc = (v: any) => {
  if (v == null) return "";
  let t = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(t)) t = "'" + t; // جلوگیری از اجرای فرمول در Excel
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
};
export const toCsv = (rows: any[][]) => "\ufeff" + rows.map((r) => r.map(csvEsc).join(",")).join("\r\n");

const empty = (): Day => ({ note: "", bed: "", wake: "", q: 0, water: 0, todos: [], blocks: [], checks: [] });

export function buildRows(kind: Kind, fmt: Fmt, sel: string, first: string | null, habits: Habit[], days: Record<string, Day>, s: Settings): any[][] {
  const [a, b] = span(kind, sel, first), ds = dayList(a, b);
  const act = (h: Habit, k: string) => h.start <= k && (!h.end || k <= h.end) && sched(h, k);
  const jd = (k: string) => { const j = jp(k); return `${j.y}-${pad(j.m)}-${pad(j.d)}`; };
  if (fmt === "detail") {
    const R: any[][] = [["date", "jalali_date", "weekday", "type", "title", "done", "start", "end", "minutes"]];
    ds.forEach((k) => {
      const x = days[k] || empty(), w = WDN[di(k)];
      habits.filter((h) => act(h, k)).forEach((h) => R.push([k, jd(k), w, "habit", h.name, hDone(days, k, h) ? 1 : 0, "", "", ""]));
      x.todos.forEach((t) => R.push([k, jd(k), w, "todo", t.title, t.done ? 1 : 0, "", "", ""]));
      x.blocks.forEach((t) => R.push([k, jd(k), w, "timeblock", t.title, "", hm(t.start), hm(t.end), t.end - t.start]));
    });
    return R;
  }
  const R: any[][] = [["date", "jalali_date", "jalali_year", "jalali_month", "jalali_month_name", "season", "weekday", "weekday_index", "week_start", "has_data",
    "todos_total", "todos_done", "todos_done_pct", "habits_scheduled", "habits_done", "habits_done_pct", "sleep_bed", "sleep_wake", "sleep_hours",
    "sleep_goal_pct", "sleep_quality", "water_glasses", "water_liters", "water_goal_pct", "timeblocks_count", "timeblocks_hours", "note"]
    .concat(habits.map((h) => "habit_" + h.name))];
  ds.forEach((k) => {
    const x = days[k] || empty(), j = jp(k), A = habits.filter((h) => act(h, k));
    const hd = A.filter((h) => hDone(days, k, h)).length, tt = x.todos.length, td = x.todos.filter((t) => t.done).length;
    let sh: number | "" = "";
    if (x.bed && x.wake) {
      const [b1, b2] = x.bed.split(":").map(Number), [w1, w2] = x.wake.split(":").map(Number);
      let d = w1 * 60 + w2 - (b1 * 60 + b2);
      if (d <= 0) d += 1440;
      sh = r1(d / 60);
    }
    const bm = x.blocks.reduce((p, t) => p + (t.end - t.start), 0);
    const has = tt || x.blocks.length || sh !== "" || x.water || x.note || x.checks.length ? 1 : 0;
    R.push([k, jd(k), j.y, j.m, JMN[j.m - 1], SEA[Math.floor((j.m - 1) / 3)], WDN[di(k)], di(k), wstart(k), has,
      tt, td, tt ? r1((td / tt) * 100) : "", A.length, hd, A.length ? r1((hd / A.length) * 100) : "",
      x.bed || "", x.wake || "", sh, sh !== "" ? r1((sh as number) / s.sleep_goal * 100) : "", x.q || "",
      x.water || "", x.water ? r1((x.water * s.glass_ml) / 1000) : "", x.water ? r1((x.water / s.water_goal) * 100) : "",
      x.blocks.length, x.blocks.length ? r1(bm / 60) : "", x.note || "",
      ...habits.map((h) => (act(h, k) ? (hDone(days, k, h) ? 1 : 0) : ""))]);
  });
  return R;
}

/** دانلود فایل؛ روی iOS اگر ممکن باشد از برگهٔ اشتراک‌گذاری استفاده می‌شود. */
export async function saveCsv(name: string, text: string): Promise<boolean> {
  const file = new File([text], name, { type: "text/csv" });
  const nav: any = navigator;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && nav.canShare && nav.canShare({ files: [file] })) {
    try { await nav.share({ files: [file] }); return true; } catch (e: any) { if (e?.name === "AbortError") return false; }
  }
  const u = URL.createObjectURL(file), l = document.createElement("a");
  l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
  return true;
}
