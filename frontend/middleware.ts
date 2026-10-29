import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// فقط وجود کوکی را بررسی می‌کند؛ اعتبار واقعی توکن را Django در /api/me تأیید می‌کند.
export function middleware(req: NextRequest) {
  const has = req.cookies.has("pl_token");
  const p = req.nextUrl.pathname;
  if (p.startsWith("/dashboard") && !has) return NextResponse.redirect(new URL("/login", req.url));
  if ((p === "/login" || p === "/register") && has) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/login", "/register"] };
