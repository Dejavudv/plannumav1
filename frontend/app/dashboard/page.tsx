"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, logout } from "@/lib/api";
import type { Me } from "@/lib/types";
import { Planner } from "@/components/Planner";
import { Logo } from "@/components/Logo";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    try { setMe(await api<Me>("/me")); }
    catch (e: any) {
      if (e?.status === 401) { await logout(); router.replace("/login"); } // کوکی نامعتبر پاک می‌شود
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t); }, [refresh]);

  if (!me) return <div className="boot"><Logo size={64} /><p>در حال بارگذاری…</p></div>;
  return <Planner me={me} refresh={refresh} />;
}
