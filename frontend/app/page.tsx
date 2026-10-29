import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@/components/Logo";

const FEATURES: [string, string, string][] = [
  ["✅", "هبیت ترکر هوشمند", "عادت‌ها را برای روزهای مشخص هفته تنظیم کن، استریک بگیر و پایداری‌ات را روی نقشهٔ ۱۲ هفته‌ای ببین."],
  ["🗓", "تایم‌باکس ۲۴ ساعته", "روزت را بلوک‌بندی کن و ببین چقدر زمان آزاد داری."],
  ["📈", "تحلیل نموداری", "روند عادت‌ها، کارها، خواب و آب در بازهٔ هفته، ۳۰ و ۹۰ روز."],
  ["⬇", "خروجی CSV", "دادهٔ خودت را برای تحلیل در Excel یا Python بگیر: هفته، ماه، فصل یا کل داده‌ها."],
  ["⧉", "کپی هفتهٔ قبل", "برنامهٔ ثابت هر هفته را با یک کلیک بازسازی کن."],
  ["🌙", "حالت تیره و روشن", "طراحی راست‌به‌چپ، سریع و راحت برای چشم، روی موبایل و کامپیوتر."],
];
const FAQ: [string, string][] = [
  ["نسخهٔ رایگان چه محدودیتی دارد؟", "تا ۳ کار در هر روز و ۳ عادت فعال. بقیهٔ امکانات (تایم‌باکس، خواب، آب، تحلیل، CSV و کپی هفته) در همین نسخه هست."],
  ["پرداخت چگونه است؟", "کارت‌به‌کارت؛ شمارهٔ کارت را کپی می‌کنی، عکس رسید را در داشبورد آپلود می‌کنی و بعد از تأیید ادمین، پرو فعال می‌شود."],
  ["هر بار باید وارد شوم؟", "نه. یک‌بار با نام کاربری و رمز وارد شو؛ مرورگرت تا یک سال وارد می‌ماند (مگر خودت خروج بزنی)."],
  ["اپ شخصی‌سازی‌شده یعنی چه؟", "با مشاوره و تحلیل روش کاری‌ات، یک اپ اختصاصی مطابق نیاز خودت می‌سازیم. از داخل داشبورد با پشتیبانی گفتگو کن."],
];

export default function Home() {
  const logged = cookies().has("pl_token");
  return (
    <>
      <header className="lp-nav">
        <Link href="/" className="lp-brand"><Logo size={40} /><b>پلنوما</b></Link>
        <nav>
          {logged ? <Link href="/dashboard" className="btn">ورود به داشبورد</Link> : <><Link href="/login" className="ib">ورود</Link><Link href="/register" className="btn">ثبت‌نام رایگان</Link></>}
        </nav>
      </header>

      <section className="lp-hero">
        <div>
          <span className="lp-pill">رایگان شروع کن</span>
          <h1>برنامه‌ریزی که <em>مخصوص خودت</em> ساخته شده</h1>
          <p>پلنر هفتگی با هبیت ترکر، تایم‌باکس و تحلیل نموداری. اول رایگان استفاده کن؛ بعد اگر خواستی، با مشاوره و تحلیل، اپی بسازیم که دقیقاً مطابق مسیر تو باشد.</p>
          <div className="lp-cta">
            <Link href={logged ? "/dashboard" : "/register"} className="btn gold">{logged ? "ورود به داشبورد" : "ساخت حساب رایگان"}</Link>
            {!logged && <Link href="/login" className="lp-ghost">قبلاً ثبت‌نام کرده‌ام</Link>}
          </div>
        </div>
        <div className="lp-art" aria-hidden="true"><Logo size={220} /></div>
      </section>

      <section className="lp-sec">
        <h2>همه‌چیز برای ساختن عادت‌های ماندگار</h2>
        <div className="lp-grid">
          {FEATURES.map(([i, t, d]) => <article key={t} className="card"><span aria-hidden="true">{i}</span><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>

      <section className="lp-sec" id="pricing">
        <h2>رایگان یا پرو</h2>
        <div className="lp-price">
          <article className="card">
            <h3>رایگان</h3><p className="pr">۰ تومان</p>
            <ul><li>تا ۳ کار در هر روز</li><li>تا ۳ عادت فعال</li><li>تایم‌باکس، خواب، آب و یادداشت</li><li>تحلیل نموداری، خروجی CSV و کپی هفتهٔ قبل</li><li>پشتیبانی از طریق گفتگوی آنلاین</li></ul>
            <Link href="/register" className="btn">شروع رایگان</Link>
          </article>
          <article className="card pro">
            <h3>پرو <small>★</small></h3><p className="pr">ماهانه یا سالانه</p>
            <ul><li>کار و عادت نامحدود</li><li>امکانات پیشرفتهٔ بعدی پرو</li><li>اولویت در پشتیبانی</li><li>پرداخت ساده، کارت‌به‌کارت</li></ul>
            <Link href={logged ? "/dashboard/upgrade" : "/register"} className="btn gold">{logged ? "ارتقا به پرو" : "ثبت‌نام و ارتقا"}</Link>
          </article>
        </div>
      </section>

      <section className="lp-sec">
        <h2>سؤال‌های رایج</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q} className="card"><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>

      <footer className="lp-foot"><Logo size={28} /><span>پلنوما · پلنر شخصی‌سازی‌شده</span></footer>
    </>
  );
}
