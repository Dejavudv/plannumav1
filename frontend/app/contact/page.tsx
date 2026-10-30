import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SiteShell } from "@/components/SiteShell";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "تماس با ما", description: "راه‌های ارتباط با پشتیبانی پلنوما." };

export default function Contact() {
  const logged = cookies().has("pl_token");
  return (
    <SiteShell>
      <article className="prose">
        <h1>تماس با ما</h1>
        <p>سریع‌ترین راه، گفتگوی آنلاین داخل داشبورد است. برای مشاورهٔ اپ اختصاصی هم فرم مشاوره را پر کنید.</p>
        <div className="lp-grid">
          <div className="card"><h3>💬 گفتگوی آنلاین</h3><p>{logged ? "از داشبورد، دکمهٔ «پشتیبانی» را بزنید." : "بعد از ورود، از داشبورد با پشتیبانی گفتگو کنید."}</p><Link className="btn" href={logged ? "/dashboard" : "/login"}>{logged ? "رفتن به داشبورد" : "ورود"}</Link></div>
          <div className="card"><h3>📋 درخواست مشاوره</h3><p>دربارهٔ پلنر شخصی‌سازی‌شده یا اپ اختصاصی برای خودتان یا تیمتان.</p><Link className="btn gold" href="/consult">ثبت درخواست</Link></div>
          {SITE.telegram && <div className="card"><h3>✈ تلگرام</h3><p dir="ltr" style={{ textAlign: "right" }}><a href={`https://t.me/${SITE.telegram.replace("@", "")}`}>@{SITE.telegram.replace("@", "")}</a></p></div>}
          {SITE.instagram && <div className="card"><h3>📷 اینستاگرام</h3><p dir="ltr" style={{ textAlign: "right" }}><a href={`https://instagram.com/${SITE.instagram.replace("@", "")}`}>@{SITE.instagram.replace("@", "")}</a></p></div>}
          {SITE.email && <div className="card"><h3>✉ ایمیل</h3><p dir="ltr" style={{ textAlign: "right" }}><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p></div>}
        </div>
        <h2>رمزتان را فراموش کرده‌اید؟</h2>
        <p>چون ایمیل یا موبایل ثبت نمی‌کنیم، نام کاربری‌تان را از یکی از راه‌های بالا برای ما بفرستید تا رمز موقت بدهیم؛ بعد از ورود باید رمز جدید بگذارید.</p>
      </article>
    </SiteShell>
  );
}
