import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/posts";
import { SITE } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/blog", "/consult", "/contact", "/terms", "/privacy"].map((p) => ({ url: SITE.url + p, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 }));
  return [...pages, ...POSTS.map((p) => ({ url: `${SITE.url}/blog/${p.slug}`, lastModified: p.date, priority: 0.7 }))];
}
