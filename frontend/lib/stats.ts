import type { Day, Habit } from "./types";
import { sched, shift } from "./date";

type Days = Record<string, Day>;

export const hAct = (habits: Habit[], k: string) => habits.filter((h) => h.start <= k && (!h.end || k <= h.end) && sched(h, k));
export const hDone = (days: Days, k: string, h: Habit) => !!days[k]?.checks.includes(h.id);

export function hp(habits: Habit[], days: Days, k: string): number | null {
  const a = hAct(habits, k);
  return a.length ? a.filter((h) => hDone(days, k, h)).length / a.length : null;
}

/** درصد کلی روز (کارها + عادت‌ها) برای نوار پیشرفت بالای صفحه */
export function dp(habits: Habit[], days: Days, k: string): number {
  const x = days[k], a = hAct(habits, k), t = (x ? x.todos.length : 0) + a.length;
  if (!t) return 0;
  return (((x ? x.todos.filter((i) => i.done).length : 0) + a.filter((h) => hDone(days, k, h)).length) / t) * 100;
}

export function streak(h: Habit, days: Days, sel: string): number {
  let k = sel, n = 0;
  if (sched(h, k) && !hDone(days, k, h)) k = shift(k, -1);
  for (let i = 0; i < 4000; i++, k = shift(k, -1)) {
    if (k < h.start) break;
    if (!sched(h, k)) continue;
    if (!hDone(days, k, h)) break;
    n++;
  }
  return n;
}

export function bestStreak(h: Habit, days: Days, last: string): number {
  let m = 0, c = 0, k = h.start;
  for (let i = 0; k <= last && i < 4000; i++, k = shift(k, 1)) {
    if (!sched(h, k)) continue;
    if (hDone(days, k, h)) { c++; m = Math.max(m, c); } else c = 0;
  }
  return m;
}

export const sleepMinutes = (bed?: string, wake?: string): number | null => {
  const f = (v?: string) => { if (!v) return null; const [a, b] = v.split(":").map(Number); return a * 60 + b; };
  const a = f(bed), b = f(wake);
  if (a == null || b == null) return null;
  let d = b - a;
  if (d <= 0) d += 1440;
  return d;
};
