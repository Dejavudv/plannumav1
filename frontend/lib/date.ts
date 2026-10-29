import type { Habit } from "./types";

export const FA = "۰۱۲۳۴۵۶۷۸۹";
export const fd = (s: string | number) => String(s).replace(/\d/g, (d) => FA[+d]);
export const fn = (n: number) => Number(n).toLocaleString("fa-IR", { maximumFractionDigits: 2, useGrouping: false });
export const pad = (n: number) => String(n).padStart(2, "0");
export const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12); };
export const shift = (k: string, n: number) => { const d = fromKey(k); d.setDate(d.getDate() + n); return key(d); };
export const todayKey = () => key(new Date());
/** شماره روز هفته: شنبه = ۰ ... جمعه = ۶ */
export const di = (k: string) => (fromKey(k).getDay() + 1) % 7;
export const wstart = (k: string) => shift(k, -di(k));
export const dfm = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fa-IR", o).format(d);

export const WD = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const WDN = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
export const JMN = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const SEA = ["بهار", "تابستان", "پاییز", "زمستان"];
const JF = new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric" });
export const jp = (k: string) => {
  const o: Record<string, string> = {};
  JF.formatToParts(fromKey(k)).forEach((q) => { if (q.type !== "literal") o[q.type] = q.value; });
  return { y: +(o.year || o.relatedYear), m: +o.month, d: +o.day };
};

export const tmin = (v?: string | null) => { if (!v) return null; const [a, b] = v.split(":").map(Number); return a * 60 + b; };
export const hm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const fmt = (m: number) => fd(hm(m));
export const dur = (m: number) => {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h && mm ? `${fd(h)} ساعت و ${fd(mm)} دقیقه` : h ? `${fd(h)} ساعت` : `${fd(mm)} دقیقه`;
};
export const sched = (h: Habit, k: string) => h.weekdays.includes(di(k));
export const schedLabel = (h: Habit) =>
  h.weekdays.length === 7 ? "هر روز" : [...h.weekdays].sort().map((i) => WDN[i] + "‌ها").join("، ");
