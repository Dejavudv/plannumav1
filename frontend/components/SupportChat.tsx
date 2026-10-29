"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useRun } from "@/lib/toast";
import { fd } from "@/lib/date";

type Msg = { id: number; from_staff: boolean; text: string; created: string };

/** گفتگوی آنلاین با پشتیبانی (polling هر ۴ ثانیه وقتی پنجره باز است) */
export function SupportChat({ open, setOpen, unread, refresh }: { open: boolean; setOpen: (v: boolean) => void; unread: number; refresh: () => Promise<void> }) {
  const run = useRun();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [txt, setTxt] = useState("");
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const r = await api<{ messages: Msg[] }>(`/support/messages?after=${last.current}`);
    if (r.messages.length) {
      last.current = r.messages[r.messages.length - 1].id;
      setMsgs((p) => { const ids = new Set(p.map((m) => m.id)); return [...p, ...r.messages.filter((m) => !ids.has(m.id))]; });
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    poll().catch(() => {});
    const t = setInterval(() => poll().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [open, poll]);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [msgs, open]);

  const send = () => {
    const v = txt.trim();
    if (!v) return;
    run(async () => {
      const m = await api<Msg>("/support/messages", { body: { text: v } });
      last.current = Math.max(last.current, m.id);
      setMsgs((p) => [...p, m]);
      setTxt("");
    });
  };
  const time = (s: string) => new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(s));

  return (
    <>
      {!open && (
        <button className="chatfab" onClick={() => setOpen(true)} aria-label="گفتگو با پشتیبانی">
          💬 پشتیبانی{unread > 0 && <b className="dot">{fd(unread)}</b>}
        </button>
      )}
      {open && (
        <section className="chat" role="dialog" aria-label="گفتگو با پشتیبانی">
          <header><b>پشتیبانی پلنوما</b><button className="x" onClick={() => setOpen(false)} aria-label="بستن">×</button></header>
          <div className="msgs" ref={box}>
            {!msgs.length && <p className="empty">سلام! سؤال یا مشکلی دارید؟ همین‌جا بنویسید؛ در اولین فرصت پاسخ می‌دهیم.</p>}
            {msgs.map((m) => (
              <div key={m.id} className={"msg " + (m.from_staff ? "staff" : "me")}>
                <p>{m.text}</p><small>{time(m.created)}</small>
              </div>
            ))}
          </div>
          <div className="add" style={{ margin: 0 }}>
            <input className="inp" value={txt} placeholder="پیام شما…" maxLength={2000} aria-label="پیام"
              onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }} />
            <button className="btn" onClick={send}>ارسال</button>
          </div>
        </section>
      )}
    </>
  );
}
