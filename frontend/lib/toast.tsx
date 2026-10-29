"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

const Ctx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const t = useRef<any>(null);
  const show = useCallback((m: string) => {
    setMsg(m); setOn(true);
    clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 3200);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={"toast" + (on ? " show" : "")} role="status" aria-live="polite">{msg}</div>
    </Ctx.Provider>
  );
}

/** اجرای امن یک عملیات async: خطا را به‌صورت پیام نشان می‌دهد. */
export function useRun() {
  const toast = useToast();
  return async (f: () => Promise<any>) => {
    try { return await f(); } catch (e: any) { toast(e?.message || "خطایی رخ داد."); }
  };
}
