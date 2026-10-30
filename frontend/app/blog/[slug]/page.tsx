import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { POSTS } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const p = POSTS.find((x) => x.slug === params.slug);
  return p ? { title: p.title, description: p.excerpt, openGraph: { title: p.title, description: p.excerpt, type: "article" } } : {};
}

export default function Post({ params }: { params: { slug: string } }) {
  const p = POSTS.find((x) => x.slug === params.slug);
  if (!p) notFound();
  const ld = { "@context": "https://schema.org", "@type": "Article", headline: p.title, datePublished: p.date, inLanguage: "fa", description: p.excerpt, mainEntityOfPage: `${SITE.url}/blog/${p.slug}` };
  return (
    <SiteShell>
      <article className="prose">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <p className="meta"><Link href="/blog">← همهٔ مقالات</Link></p>
        <h1>{p.title}</h1>
        <p className="meta">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "long" }).format(new Date(p.date))} · {p.read.toLocaleString("fa-IR")} دقیقه مطالعه</p>
        {p.body.map((b, i) => (
          <div key={i}>{b.h && <h2>{b.h}</h2>}{b.p && <p>{b.p}</p>}{b.ul && <ul>{b.ul.map((x) => <li key={x}>{x}</li>)}</ul>}</div>
        ))}
        <div className="card okc"><b>آمادهٔ شروع هستید؟</b><p>پلنوما را رایگان امتحان کنید و اولین عادتتان را همین امروز بسازید.</p><Link className="btn gold" href="/register">ساخت حساب رایگان</Link></div>
      </article>
    </SiteShell>
  );
}
