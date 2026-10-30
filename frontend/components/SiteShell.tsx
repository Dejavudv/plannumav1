import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "./Logo";

/** قاب مشترک صفحات عمومی (معرفی، مقالات، قوانین، تماس…) */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const logged = cookies().has("pl_token");
  return (
    <>
      <header className="lp-nav">
        <Link href="/" className="lp-brand"><Logo size={40} /><b>پلنوما</b></Link>
        <nav aria-label="منوی اصلی">
          <Link href="/blog" className="lp-link">مقالات</Link>
          <Link href="/consult" className="lp-link">مشاوره</Link>
          {logged ? <Link href="/dashboard" className="btn">ورود به داشبورد</Link> : <><Link href="/login" className="ib">ورود</Link><Link href="/register" className="btn">ثبت‌نام رایگان</Link></>}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="lp-foot2">
        <div className="lp-fbrand"><Logo size={28} /><span>پلنوما · پلنر شخصی‌سازی‌شده</span></div>
        <nav aria-label="پیوندهای پایین صفحه">
          <Link href="/blog">مقالات</Link><Link href="/consult">درخواست مشاوره</Link><Link href="/contact">تماس با ما</Link>
          <Link href="/terms">قوانین و شرایط</Link><Link href="/privacy">حریم خصوصی</Link>
        </nav>
      </footer>
    </>
  );
}
