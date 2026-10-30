"use client";
import { useEffect, useState } from "react";
import type { Block } from "@/lib/types";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { useRun } from "@/lib/toast";
import { fd, hm, tmin } from "@/lib/date";

const COL = ["--c0", "--c1", "--c2", "--c3", "--c4"];

export function BlockEditDialog({ block, onClose, pl }: { block: Block | null; onClose: () => void; pl: Planner }) {
  const run = useRun();
  const [t, setT] = useState(""), [s, setS] = useState("09:00"), [e, setE] = useState("10:00"), [c, setC] = useState(0);
  useEffect(() => { if (block) { setT(block.title); setS(hm(block.start)); setE(block.end >= 1440 ? "00:00" : hm(block.end)); setC(block.color % 5); } }, [block]);

  const save = () => run(async () => {
    if (!block) return;
    const a = tmin(s);
    let b = tmin(e);
    if (b === 0) b = 1440;
    if (!t.trim()) throw new Error("عنوان بلوک را بنویسید.");
    if (a == null || b == null || b <= a) throw new Error("زمان پایان باید بعد از شروع باشد.");
    await pl.editBlock(pl.sel, block.id, { title: t.trim(), start: a, end: b, color: c });
    onClose();
  });
  const del = () => run(async () => { if (block) { await pl.delBlock(pl.sel, block.id); onClose(); } });

  return (
    <Modal open={!!block} onClose={onClose} title="ویرایش بلوک">
      <div className="fl"><label>عنوان<input className="inp" value={t} maxLength={120} onChange={(ev) => setT(ev.target.value)} /></label></div>
      <div className="fld">
        <label>شروع<input className="inp" type="time" value={s} onChange={(ev) => setS(ev.target.value)} /></label>
        <label>پایان<input className="inp" type="time" value={e} onChange={(ev) => setE(ev.target.value)} /></label>
      </div>
      <div className="sw" role="group" aria-label="رنگ" style={{ margin: "12px 0" }}>
        {COL.map((cc, i) => <button key={i} type="button" style={{ "--k": `var(${cc})` } as React.CSSProperties} aria-pressed={i === c} aria-label={`رنگ ${fd(i + 1)}`} onClick={() => setC(i)} />)}
      </div>
      <div className="dacts"><button className="btn" onClick={save}>ذخیره</button><button className="ib" onClick={onClose}>انصراف</button><button className="link" style={{ color: "var(--c3)", marginInlineStart: "auto" }} onClick={del}>حذف بلوک</button></div>
    </Modal>
  );
}
