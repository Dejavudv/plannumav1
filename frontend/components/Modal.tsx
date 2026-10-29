"use client";
import { useEffect, useRef } from "react";

/** پنجرهٔ گفتگو با تگ بومی <dialog> (کلید Esc و کلیک بیرون برای بستن). */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      {open && (<><h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{title}</h3>{children}</>)}
    </dialog>
  );
}
