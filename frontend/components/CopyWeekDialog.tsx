"use client";
import { useState } from "react";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { useToast } from "@/lib/toast";
import { dfm, fd, fromKey, shift } from "@/lib/date";

export function CopyWeekDialog({ open, onClose, pl }: { open: boolean; onClose: () => void; pl: Planner }) {
  const toast = useToast();
  const [o, setO] = useState({ todos: true, blocks: true, notes: false });
  const [busy, setBusy] = useState(false);
  const r = (k: string) => dfm(fromKey(k), { day: "numeric", month: "long" });
  const prev = shift(pl.ws, -7);

  const go = async () => {
    setBusy(true);
    try {
      const res = await pl.copyWeek(o);
      const total = res.todos + res.blocks + res.notes;
      toast(total ? `${fd(res.todos)} کار، ${fd(res.blocks)} بلوک و ${fd(res.notes)} یادداشت کپی شد` : "موردی برای کپی نبود");
      if (res.skipped_todos) setTimeout(() => toast(`${fd(res.skipped_todos)} کار به‌خاطر سقف نسخهٔ رایگان کپی نشد.`), 3300);
      onClose();
    } catch (e: any) { toast(e?.message || "کپی ناموفق بود."); }
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="کپی برنامهٔ هفتهٔ قبل">
      <p className="sub">از {r(prev)} تا {r(shift(prev, 6))} به {r(pl.ws)} تا {r(shift(pl.ws, 6))}</p>
      <p className="sub" style={{ margin: "0 0 6px" }}>عادت‌ها نیاز به کپی ندارند؛ بدون هیچ کاری هر هفته خودکار ادامه پیدا می‌کنند.</p>
      <label className="opt"><input type="checkbox" checked={o.todos} onChange={(e) => setO({ ...o, todos: e.target.checked })} />کارهای روزانه (به‌صورت انجام‌نشده)</label>
      <label className="opt"><input type="checkbox" checked={o.blocks} onChange={(e) => setO({ ...o, blocks: e.target.checked })} />بلوک‌های تایم‌باکس</label>
      <label className="opt"><input type="checkbox" checked={o.notes} onChange={(e) => setO({ ...o, notes: e.target.checked })} />یادداشت‌ها (فقط روزهای بدون یادداشت)</label>
      <p className="sub" style={{ margin: "8px 0 0" }}>موارد تکراری نادیده گرفته می‌شوند.</p>
      <div className="dacts">
        <button className="btn" onClick={go} disabled={busy || !(o.todos || o.blocks || o.notes)}>{busy ? "…" : "کپی کن"}</button>
        <button className="ib" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}
