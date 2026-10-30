"use client";
import { useEffect, useRef } from "react";

type Props = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean; locked?: boolean };

/** پنجرهٔ گفتگو با تگ بومی <dialog>. locked = بسته‌نشدنی (مثلاً الزام تغییر رمز) */
export function Modal({ open, onClose, title, children, wide, locked }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={wide ? "wide" : ""} aria-label={title}
      onCancel={(e) => { if (locked) e.preventDefault(); }}
      onClose={() => { if (!locked) onClose(); }}
      onClick={(e) => { if (!locked && e.target === ref.current) onClose(); }}>
      {open && (<><h3 style={{ margin: "0 0 8px", fontSize: 17 }}>{title}</h3>{children}</>)}
    </dialog>
  );
}
