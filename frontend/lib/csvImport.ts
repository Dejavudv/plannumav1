import { tmin } from "./date";

/** تجزیهٔ CSV مطابق RFC4180 (کوتیشن، ویرگول و خط جدید داخل فیلد) */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

const unsafe = (t: string) => t.replace(/^'(?=[=+\-@\t\r])/, ""); // برعکسِ امن‌سازی خروجی

/** فایل CSV «جزئیات» (که خود پلنوما می‌سازد) را به قالب پشتیبان JSON تبدیل می‌کند */
export function detailCsvToBackup(text: string) {
  const rows = parseCsv(text);
  const h = rows[0] || [];
  const ix = (n: string) => h.indexOf(n);
  if (ix("date") < 0 || ix("type") < 0 || ix("title") < 0) throw new Error("این فایل CSV از نوع «جزئیات» پلنوما نیست. برای وارد کردن از فایل «جزئیات» یا پشتیبان JSON استفاده کنید.");
  const days: Record<string, any> = {};
  const habits: Record<string, { name: string; start: string; checks: string[] }> = {};
  for (const r of rows.slice(1)) {
    const date = r[ix("date")], type = r[ix("type")], title = unsafe((r[ix("title")] || "").trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) continue;
    const day = (days[date] ||= { todos: [], blocks: [] });
    if (type === "todo") day.todos.push({ title, done: r[ix("done")] === "1" });
    else if (type === "timeblock") {
      const s = tmin(r[ix("start")]), e0 = tmin(r[ix("end")]);
      const e = e0 === 0 ? 1440 : e0;
      if (s != null && e != null && e > s) day.blocks.push({ title, start: s, end: e, color: 0 });
    } else if (type === "habit") {
      const hb = (habits[title] ||= { name: title, start: date, checks: [] });
      if (date < hb.start) hb.start = date;
      if (r[ix("done")] === "1") hb.checks.push(date);
    }
  }
  return { app: "plannuma", version: 1, habits: Object.values(habits), days };
}
