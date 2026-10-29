export type Todo = { id: number; title: string; done: boolean };
export type Block = { id: number; title: string; start: number; end: number; color: number };
export type Day = { note: string; bed: string; wake: string; q: number; water: number; todos: Todo[]; blocks: Block[]; checks: number[] };
export type Habit = { id: number; name: string; color: number; weekdays: number[]; start: string; end: string | null };
export type Settings = { water_goal: number; glass_ml: number; sleep_goal: number };
export type Me = {
  user: { id: number; username: string; is_staff: boolean };
  plan: { is_pro: boolean; until: string | null };
  limits: { todos_per_day: number; habits: number } | null;
  settings: Settings;
  unread_support: number;
  pending_payment: boolean;
  first_date: string | null;
};
