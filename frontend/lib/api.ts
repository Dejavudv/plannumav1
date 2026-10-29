export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Opts = { method?: string; body?: any; form?: FormData };

/** همهٔ درخواست‌ها هدر X-Requested-With دارند (محافظ CSRF سمت Django). */
export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Requested-With": "plannuma" };
  let body: any = undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch("/api" + path, {
    method: opts.method || (body !== undefined ? "POST" : "GET"),
    headers,
    body,
    credentials: "same-origin",
    cache: "no-store",
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* بدنهٔ خالی */ }
  if (!res.ok) throw new ApiError(res.status, data?.error || "error", data?.message || "خطایی رخ داد؛ دوباره تلاش کنید.");
  return data as T;
}

/** خروج: کوکی را پاک می‌کند (برای جلوگیری از حلقهٔ ریدایرکت وقتی توکن نامعتبر است هم استفاده می‌شود). */
export async function logout() {
  try { await api("/auth/logout", { method: "POST", body: {} }); } catch { /* ignore */ }
}
