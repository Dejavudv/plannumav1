"use client";
import { useState } from "react";
import type { Planner } from "@/lib/usePlanner";
import { Modal } from "./Modal";
import { useToast } from "@/lib/toast";
import { PACKS } from "@/lib/packs";
import { fd } from "@/lib/date";

export function PacksDialog({ open, onClose, pl }: { open: boolean; onClose: () => void; pl: Planner }) {
  const toast = useToast();
  const [busy, setBusy] = useState("");
  const addPack = async (id: string) => {
    const pack = PACKS.find((p) => p.id === id)!;
    setBusy(id);
    let n = 0, msg = "";
    for (const name of pack.habits) {
      if (pl.habits.some((h) => h.name === name)) continue;
      try { await pl.addHabit(name, [0, 1, 2, 3, 4, 5, 6]); n++; } catch (e: any) { msg = e?.message || ""; break; }
    }
    setBusy("");
    toast(n ? `${fd(n)} عادت اضافه شد${msg ? ". بقیه به‌خاطر سقف نسخهٔ رایگان اضافه نشد." : ""}` : msg || "همهٔ عادت‌های این قالب را از قبل دارید.");
    if (n) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="قالب‌های آمادهٔ عادت" wide>
      <p className="sub" style={{ margin: "0 0 8px" }}>یک مجموعه انتخاب کنید؛ عادت‌ها «هر روز» اضافه می‌شوند و بعداً می‌توانید ویرایششان کنید.</p>
      <div className="packs">
        {PACKS.map((p) => (
          <div key={p.id} className="card">
            <h4>{p.icon} {p.title}</h4>
            <ul>{p.habits.map((h) => <li key={h}>{h}</li>)}</ul>
            <button className="btn" disabled={!!busy} onClick={() => addPack(p.id)}>{busy === p.id ? "…" : "افزودن"}</button>
          </div>
        ))}
      </div>
      <div className="dacts"><button className="ib" onClick={onClose}>بستن</button></div>
    </Modal>
  );
}
