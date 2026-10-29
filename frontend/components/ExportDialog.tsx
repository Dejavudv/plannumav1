"use client";
import { useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { useToast } from "@/lib/toast";
import { dfm, fd, fromKey } from "@/lib/date";
import { buildRows, dayList, saveCsv, span, toCsv, type Fmt, type Kind } from "@/lib/csv";

const KINDS: [Kind, string][] = [["week", "این هفته"], ["month", "این ماه"], ["season", "این فصل"], ["all", "کل داده‌ها"]];

export function ExportDialog({ open, onClose, pl, me }: { open: boolean; onClose: () => void; pl: Planner; me: Me }) {
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("week");
  const [fmt, setFmt] = useState<Fmt>("daily");
  const [busy, setBusy] = useState(false);

  const label = (k: Kind) => {
    const [a, b] = span(k, pl.sel, me.first_date);
    const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", ...(k === "all" ? { year: "numeric" as const } : {}) };
    return `${dfm(fromKey(a), o)} تا ${dfm(fromKey(b), o)}، ${fd(dayList(a, b).length)} روز`;
  };

  const download = async () => {
    setBusy(true);
    try {
      const [a, b] = span(kind, pl.sel, me.first_date);
      const data = await pl.fetchRange(a, b);
      const rows = buildRows(kind, fmt, pl.sel, me.first_date, data.habits, data.days, me.settings);
      const ok = await saveCsv(`plannuma-${fmt}-${kind}-${a}_${b}.csv`, toCsv(rows));
      if (ok) { toast(`فایل CSV ذخیره شد (${fd(rows.length - 1)} ردیف)`); onClose(); }
    } catch (e: any) { toast(e?.message || "ساخت فایل ناموفق بود."); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="خروجی CSV برای تحلیل">
      <p className="sub" style={{ margin: 0 }}>دادهٔ خودتان را در Excel، Google Sheets، Power BI یا Python تحلیل کنید. بازه‌ها بر اساس روزی است که الان انتخاب کرده‌اید.</p>
      <div style={{ marginTop: 8 }}>
        {KINDS.map(([k, l]) => (
          <label className="opt" key={k}>
            <input type="radio" name="xr" checked={kind === k} onChange={() => setKind(k)} />
            {l}<small style={{ color: "var(--mut)" }}>&nbsp;({label(k)})</small>
          </label>
        ))}
      </div>
      <div className="sub" style={{ margin: "10px 0 2px" }}>نوع فایل</div>
      <label className="opt"><input type="radio" name="xf" checked={fmt === "daily"} onChange={() => setFmt("daily")} />خلاصهٔ روزانه (هر روز یک ردیف؛ پیشنهادی)</label>
      <label className="opt"><input type="radio" name="xf" checked={fmt === "detail"} onChange={() => setFmt("detail")} />جزئیات (هر عادت، کار و بلوک یک ردیف)</label>
      <p className="sub" style={{ margin: "8px 0 0" }}>فایل UTF-8 است و فارسی در Excel درست نمایش داده می‌شود.</p>
      <div className="dacts">
        <button className="btn" onClick={download} disabled={busy}>{busy ? "در حال ساخت…" : "دانلود CSV"}</button>
        <button className="ib" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
