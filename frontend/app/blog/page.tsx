import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/SiteShell";
import { POSTS } from "@/lib/posts";

export const metadata: Metadata = { title: "مقالات", description: "مقاله‌های کوتاه دربارهٔ ساختن عادت، مدیریت زمان و برنامه‌ریزی روزانه." };

export default function Blog() {
  const fmt = new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" });
  return (
    <SiteShell>
      <section className="prose">
        <h1>مقالات</h1>
        <div className="lp-grid">
          {POSTS.map((p) => (
            <article key={p.slug} className="card">
              <h3><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3>
              <p>{p.excerpt}</p>
              <small className="meta">{fmt.format(new Date(p.date))} · {p.read.toLocaleString("fa-IR")} دقیقه مطالعه</small>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
