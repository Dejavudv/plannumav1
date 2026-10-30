"use client";
import { useCallback, useEffect, useState } from "react";
import type { Me } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { Upsell } from "./Upsell";
import { api } from "@/lib/api";
import { useRun } from "@/lib/toast";
import { WDN, fd } from "@/lib/date";

type Rec = { id: number; title: string; weekdays: number[]; start: string };

/** کارهای تکراری: هر هفته در روزهای انتخابی خودکار به کارهای روز اضافه می‌شوند */
export function RecurringDialog({ open, onClose, pl, me }: { open: boolean; onClose: () => void; pl: Planner; me: Me }) {
  const run = useRun();
  const [items, setItems] = useState<Rec[]>([]);
  const [t, setT] = useState("");
  const [wd, setWd] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const lim = me.limits?.recurring;
  const full = !!lim && items.length >= lim;

  const load = useCallback(() => run(async () => { setItems((await api<{ items: Rec[] }>("/recurring")).items); }), []); // eslint-disable-line
  useEffect(() => { if (open) load(); }, [open, load]);

  const add = () => run(async () => {
    if (!t.trim()) throw new Error("عنوان کار را بنویسید.");
    if (!wd.length) throw new Error("حداقل یک روز انتخاب کنید.");
    await api("/recurring", { body: { title: t.trim(), weekdays: wd, start: pl.sel } });
    setT(""); await load(); pl.reload();
  });
  const del = (id: number) => run(async () => { await api(`/recurring/${id}`, { method: "DELETE" }); await load(); pl.reload(); });

  return (
    <Modal open={open} onClose={onClose} title="کارهای تکراری" wide>
      <p className="sub" style={{ margin: 0 }}>کاری که هر هفته در روزهای مشخص تکرار می‌شود (مثل «ورزش» یا «مرور هفتگی») یک‌بار اینجا تعریف کنید؛ خودکار در لیست کارهای آن روز می‌آید. حذف یک نمونه از یک روز، تکرار را متوقف نمی‌کند.</p>
      <ul className="list" style={{ margin: "10px 0" }}>
        {items.map((r) => (
          <li key={r.id}><span className="tx">{r.title}<small className="sub" style={{ margin: 0, display: "block" }}>{r.weekdays.length === 7 ? "هر روز" : r.weekdays.map((i) => WDN[i]).join("، ")}</small></span>
            <button className="x" aria-label="حذف" onClick={() => del(r.id)}>×</button></li>
        ))}
        {!items.length && <li className="empty">هنوز کار تکراری‌ای ندارید.</li>}
      </ul>
      {full ? <Upsell text={`در نسخهٔ رایگان حداکثر ${fd(lim!)} کار تکراری دارید.`} /> : (
        <>
          <div className="add"><input className="inp" value={t} maxLength={200} placeholder="عنوان کار تکراری" onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) add(); }} /><button className="btn" onClick={add}>افزودن</button></div>
          <div className="chips" role="group" aria-label="روزها">
            {WDN.map((d, j) => <button key={j} className="chip" aria-pressed={wd.includes(j)} onClick={() => setWd(wd.includes(j) ? wd.filter((x) => x !== j) : [...wd, j])}>{d}</button>)}
          </div>
        </>
      )}
      <div className="dacts"><button className="ib" onClick={onClose}>بستن</button></div>
    </Modal>
  );
}
