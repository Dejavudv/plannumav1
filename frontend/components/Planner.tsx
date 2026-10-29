"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Me } from "@/lib/types";
import { usePlanner } from "@/lib/usePlanner";
import { logout } from "@/lib/api";
import { dfm, fromKey, shift, todayKey } from "@/lib/date";
import { dp } from "@/lib/stats";
import { Logo } from "./Logo";
import { Menu } from "./Menu";
import { HabitCard, NotesCard, TodoCard } from "./cards1";
import { SleepCard, TimeCard, WaterCard } from "./cards2";
import { AnalysisCard, SummaryCard } from "./Analysis";
import { ExportDialog } from "./ExportDialog";
import { CopyWeekDialog } from "./CopyWeekDialog";
import { SupportChat } from "./SupportChat";

export function Planner({ me, refresh }: { me: Me; refresh: () => Promise<void> }) {
  const router = useRouter();
  const pl = usePlanner();
  const [xo, setXo] = useState(false), [co, setCo] = useState(false), [chat, setChat] = useState(false);
  const { sel, ws } = pl, today = todayKey();
  const s = fromKey(ws), e = fromKey(shift(ws, 6)), d = fromKey(sel);
  const doLogout = async () => { await logout(); router.replace("/login"); };

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <Logo />
          <div><h1>پلنوما</h1><p>{dfm(s, { day: "numeric", month: "long" })} تا {dfm(e, { day: "numeric", month: "long" })} {dfm(e, { year: "numeric" })}</p></div>
        </div>
        <div className="nav">
          <Link href="/dashboard/upgrade" className={"plan" + (me.plan.is_pro ? " pro" : "")}>{me.plan.is_pro ? "★ پرو" : "رایگان · ارتقا"}</Link>
          <button className="ib" aria-label="هفته قبل" onClick={() => pl.setSel(shift(sel, -7))}>‹</button>
          <button className="ib" onClick={() => pl.setSel(today)}>امروز</button>
          <button className="ib" aria-label="هفته بعد" onClick={() => pl.setSel(shift(sel, 7))}>›</button>
          <Menu me={me} onExport={() => setXo(true)} onCopy={() => setCo(true)} onSupport={() => setChat(true)} onLogout={doLogout} />
        </div>
      </header>

      <nav className="strip" aria-label="روزهای هفته">
        {Array.from({ length: 7 }, (_, i) => {
          const k = shift(ws, i), dd = fromKey(k);
          return (
            <button key={k} className={"dy" + (k === today ? " today" : "")} aria-pressed={k === sel} onClick={() => pl.setSel(k)}>
              <small>{dfm(dd, { weekday: "short" })}</small><b>{dfm(dd, { day: "numeric" })}</b>
              <i><s style={{ width: `${dp(pl.habits, pl.days, k)}%` }} /></i>
            </button>
          );
        })}
      </nav>
      <div className="dtitle"><h2>{dfm(d, { weekday: "long" })}، {dfm(d, { day: "numeric", month: "long" })}</h2>{sel === today && <span className="tag">امروز</span>}{pl.loading && <span className="badge">در حال بارگذاری…</span>}</div>

      <main className="grid">
        <div className="col"><TodoCard pl={pl} me={me} /><HabitCard pl={pl} me={me} /></div>
        <div className="col"><TimeCard pl={pl} /></div>
        <div className="col c3"><NotesCard pl={pl} /><SleepCard pl={pl} me={me} refresh={refresh} /><WaterCard pl={pl} me={me} refresh={refresh} /></div>
      </main>

      <AnalysisCard pl={pl} me={me} />
      <SummaryCard pl={pl} me={me} />

      <aside className="cta">
        <div><b>پلنر اختصاصی خودت را بساز</b><p>پلنوما رایگان است. برای مشاوره، تحلیل و اپی که مخصوص خودت ساخته می‌شود، با پشتیبانی گفتگو کن.</p></div>
        <a href="#" onClick={(ev) => { ev.preventDefault(); setChat(true); }}>گفتگو با پشتیبانی</a>
      </aside>

      <ExportDialog open={xo} onClose={() => setXo(false)} pl={pl} me={me} />
      <CopyWeekDialog open={co} onClose={() => setCo(false)} pl={pl} />
      <SupportChat open={chat} setOpen={setChat} unread={me.unread_support} refresh={refresh} />
    </div>
  );
}
