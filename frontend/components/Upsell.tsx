import Link from "next/link";

export function Upsell({ text }: { text: string }) {
  return (
    <div className="up">
      <span>{text}</span>
      <Link href="/dashboard/upgrade" className="uplink">فعال‌سازی پرو</Link>
    </div>
  );
}
