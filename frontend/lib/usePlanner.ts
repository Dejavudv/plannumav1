"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { shift, todayKey, wstart } from "./date";
import type { Block, Day, Habit, Todo } from "./types";

export const emptyDay = (): Day => ({ note: "", bed: "", wake: "", q: 0, water: 0, todos: [], blocks: [], checks: [] });

/** وضعیت برنامه‌ریز: روز انتخاب‌شده، عادت‌ها، داده‌های روزها و همهٔ عملیات (با به‌روزرسانی خوش‌بینانه). */
export function usePlanner() {
  const [sel, setSel] = useState(todayKey());
  const [habits, setHabits] = useState<Habit[]>([]);
  const [days, setDays] = useState<Record<string, Day>>({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const cover = useRef<[string, string] | null>(null);
  const ws = wstart(sel);

  // دادهٔ ۱۷ هفتهٔ اخیر + چند هفتهٔ بعد را یک‌بار می‌گیریم (برای نمودارها و نقشهٔ پایداری)
  useEffect(() => {
    const need: [string, string] = [shift(ws, -119), shift(ws, 6)];
    const c = cover.current;
    if (c && c[0] <= need[0] && c[1] >= need[1]) return;
    const win: [string, string] = [need[0], shift(ws, 34)];
    let alive = true;
    setLoading(true);
    api(`/days?from=${win[0]}&to=${win[1]}`).then((r: any) => {
      if (!alive) return;
      setHabits(r.habits);
      setDays((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (k >= win[0] && k <= win[1]) delete next[k];
        return { ...next, ...r.days };
      });
      cover.current = win;
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { alive = false; };
  }, [ws, tick]);

  const reload = useCallback(() => { cover.current = null; setTick((t) => t + 1); }, []);
  const day = useCallback((k: string) => days[k] || emptyDay(), [days]);
  const patch = (k: string, f: (d: Day) => Day) => setDays((p) => ({ ...p, [k]: f(p[k] || emptyDay()) }));

  // ---- کارها
  const addTodo = async (k: string, title: string) => {
    const t: Todo = await api("/todos", { body: { date: k, title } });
    patch(k, (d) => ({ ...d, todos: [...d.todos, t] }));
  };
  const toggleTodo = async (k: string, id: number, done: boolean) => {
    patch(k, (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, done } : t)) }));
    try { await api(`/todos/${id}`, { method: "PATCH", body: { done } }); }
    catch (e) { patch(k, (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, done: !done } : t)) })); throw e; }
  };
  const delTodo = async (k: string, id: number) => {
    await api(`/todos/${id}`, { method: "DELETE" });
    patch(k, (d) => ({ ...d, todos: d.todos.filter((t) => t.id !== id) }));
  };
  const clearDone = async (k: string) => {
    await api("/todos/clear-done", { body: { date: k } });
    patch(k, (d) => ({ ...d, todos: d.todos.filter((t) => !t.done) }));
  };

  const editTodo = async (k: string, id: number, title: string) => {
    await api(`/todos/${id}`, { method: "PATCH", body: { title } });
    patch(k, (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, title } : t)) }));
  };
  const moveTodo = async (k: string, id: number, to: string) => {
    const t = (days[k]?.todos || []).find((x) => x.id === id);
    await api(`/todos/${id}`, { method: "PATCH", body: { date: to } });
    patch(k, (d) => ({ ...d, todos: d.todos.filter((x) => x.id !== id) }));
    if (t) patch(to, (d) => ({ ...d, todos: [...d.todos, t] }));
  };

  // ---- عادت‌ها
  const addHabit = async (name: string, weekdays: number[]) => {
    const h: Habit = await api("/habits", { body: { name, weekdays, start: sel, color: habits.length % 5 } });
    setHabits((p) => [...p, h]);
  };
  const patchHabit = async (id: number, body: any) => {
    const h: Habit = await api(`/habits/${id}`, { method: "PATCH", body });
    setHabits((p) => p.map((x) => (x.id === id ? h : x)));
  };
  const delHabit = async (id: number) => {
    await api(`/habits/${id}`, { method: "DELETE" });
    setHabits((p) => p.filter((x) => x.id !== id));
    setDays((p) => Object.fromEntries(Object.entries(p).map(([k, d]) => [k, { ...d, checks: d.checks.filter((c) => c !== id) }])));
  };
  const moveHabit = async (id: number, dir: -1 | 1) => {
    const i = habits.findIndex((h) => h.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= habits.length) return;
    const arr = [...habits];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setHabits(arr);
    await Promise.all(arr.map((h, pos) => api(`/habits/${h.id}`, { method: "PATCH", body: { position: pos } })));
  };
  const toggleCheck = async (id: number, k: string, done: boolean) => {
    patch(k, (d) => ({ ...d, checks: done ? [...d.checks, id] : d.checks.filter((c) => c !== id) }));
    try {
      const r = await api(`/habits/${id}/check`, { body: { date: k, done } });
      if (r.start) setHabits((p) => p.map((x) => (x.id === id ? { ...x, start: r.start } : x)));
    } catch (e) {
      patch(k, (d) => ({ ...d, checks: done ? d.checks.filter((c) => c !== id) : [...d.checks, id] }));
      throw e;
    }
  };

  // ---- بلوک‌های تایم‌باکس
  const addBlock = async (k: string, b: { title: string; start: number; end: number; color: number }) => {
    const r: Block = await api("/blocks", { body: { date: k, ...b } });
    patch(k, (d) => ({ ...d, blocks: [...d.blocks, r] }));
  };
  const delBlock = async (k: string, id: number) => {
    await api(`/blocks/${id}`, { method: "DELETE" });
    patch(k, (d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
  };

  const editBlock = async (k: string, id: number, b: { title: string; start: number; end: number; color: number }) => {
    const r: Block = await api(`/blocks/${id}`, { method: "PATCH", body: b });
    patch(k, (d) => ({ ...d, blocks: d.blocks.map((x) => (x.id === id ? r : x)) }));
  };

  // ---- یادداشت، خواب، آب
  const saveDay = async (k: string, part: Partial<Pick<Day, "note" | "bed" | "wake" | "q" | "water">>) => {
    patch(k, (d) => ({ ...d, ...part }));
    await api(`/day/${k}`, { method: "PUT", body: part });
  };

  // ---- کپی هفتهٔ قبل (سمت سرور؛ محدودیت رایگان را رعایت می‌کند)
  const copyWeek = async (opts: { todos: boolean; blocks: boolean; notes: boolean }) => {
    const r = await api("/copy-week", { body: { week_start: ws, ...opts } });
    reload();
    return r as { todos: number; blocks: number; notes: number; skipped_todos: number };
  };

  // ---- دریافت بازه (برای خروجی CSV)
  const fetchRange = async (a: string, b: string) => {
    let hs: Habit[] = habits;
    const out: Record<string, Day> = {};
    let cur = a;
    while (cur <= b) {
      const end = shift(cur, 399) < b ? shift(cur, 399) : b;
      const r: any = await api(`/days?from=${cur}&to=${end}`);
      hs = r.habits;
      Object.assign(out, r.days);
      cur = shift(end, 1);
    }
    return { habits: hs, days: out };
  };

  /** دادهٔ قدیمی‌تر را (مثلاً برای نمای سالانه) در صورت نیاز می‌گیرد */
  const ensure = async (from: string) => {
    const c = cover.current;
    if (c && c[0] <= from) return;
    const to = c ? shift(c[0], -1) : shift(ws, 6);
    const r = await fetchRange(from, to);
    setHabits(r.habits);
    setDays((p) => ({ ...p, ...r.days }));
    cover.current = [from, c ? c[1] : to];
  };

  return { sel, setSel, ws, habits, days, day, loading, reload, addTodo, toggleTodo, delTodo, clearDone, editTodo, moveTodo, addHabit, patchHabit, delHabit,
    moveHabit, toggleCheck, addBlock, delBlock, editBlock, saveDay, copyWeek, fetchRange, ensure };
}
export type Planner = ReturnType<typeof usePlanner>;
