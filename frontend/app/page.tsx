import Link from "next/link";
import { cookies } from "next/headers";
import { Logo } from "@/components/Logo";
import { SiteShell } from "@/components/SiteShell";
import { BACKEND } from "@/lib/site";

const FEATURES: [string, string, string][] = [
  ["✅", "هبیت ترکر هوشمند", "عادت‌ها را برای روزهای مشخص هفته تنظیم کن، استریک بگیر و پایداری‌ات را روی نقشهٔ ۱۲ هفته‌ای ببین."],
  ["🗓", "تایم‌باکس ۲۴ ساعته", "روزت را بلوک‌بندی کن و ببین چقدر زمان آزاد داری."],
  ["📈", "تحلیل نموداری", "روند عادت‌ها، کارها، خواب و آب در بازهٔ هفته، ۳۰ و ۹۰ روز."],
  ["🔔", "یادآوری عادت‌ها", "اعلان در ساعتی که خودت تعیین می‌کنی؛ روی موبایل نصب کن و فراموش نکن."],
  ["⬇", "خروجی و پشتیبان", "داده‌ات مال خودت است: CSV برای تحلیل و JSON برای پشتیبان‌گیری و انتقال."],
  ["🌙", "حالت تیره و روشن", "طراحی راست‌به‌چپ، سریع و راحت برای چشم، روی موبایل و کامپیوتر."],
];
const FAQ: [string, string][] = [
  ["نسخهٔ رایگان چه محدودیتی دارد؟", "تا ۳ کار در هر روز، ۳ عادت فعال و ۱ کار تکراری. بقیهٔ امکانات (تایم‌باکس، خواب، آب، تحلیل، CSV، کپی هفته، یادآوری) در همین نسخه هست."],
  ["پرداخت چگونه است؟", "کارت‌به‌کارت؛ مبلغ دقیق را می‌بینی، شمارهٔ کارت را کپی می‌کنی، عکس رسید را آپلود می‌کنی و بعد از تأیید ادمین، پرو فعال می‌شود."],
  ["هر بار باید وارد شوم؟", "نه. یک‌بار با نام کاربری و رمز وارد شو؛ مرورگرت تا یک سال وارد می‌ماند (مگر خودت خروج بزنی)."],
  ["اگر رمزم را فراموش کنم؟", "ایمیل یا موبایل نمی‌گیریم، پس از گفتگوی پشتیبانی یا صفحهٔ تماس درخواست بده تا رمز موقت بگیری."],
  ["اپ شخصی‌سازی‌شده یعنی چه؟", "با مشاوره و تحلیل روش کاری‌ات، یک اپ اختصاصی مطابق نیاز خودت می‌سازیم. از صفحهٔ مشاوره درخواست بده."],
];

async function getPlans(): Promise<{ plans: { id: string; title: string; price: number; days: number }[] } | null> {
  try {
    const r = await fetch(`${BACKEND}/api/plans`, { next: { revalidate: 300 } });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export default async function Home() {
  const logged = cookies().has("pl_token");
  const data = await getPlans();
  const m = data?.plans.find((p) => p.id === "monthly"), y = data?.plans.find((p) => p.id === "yearly");
  const save = m && y ? Math.round(100 - (y.price / (m.price * 12)) * 100) : 0;
  const money = (n: number) => n.toLocaleString("fa-IR");
  return (
    <SiteShell>
      <section className="lp-hero">
        <div>
          <span className="lp-pill">رایگان شروع کن</span>
          <h1>برنامه‌ریزی که <em>مخصوص خودت</em> ساخته شده</h1>
          <p>پلنر هفتگی با هبیت ترکر، تایم‌باکس و تحلیل نموداری. اول رایگان استفاده کن؛ بعد اگر خواستی، با مشاوره و تحلیل، اپی بسازیم که دقیقاً مطابق مسیر تو باشد.</p>
          <div className="lp-cta">
            <Link href={logged ? "/dashboard" : "/register"} className="btn gold">{logged ? "ورود به داشبورد" : "ساخت حساب رایگان"}</Link>
            <Link href="/consult" className="lp-ghost">درخواست اپ اختصاصی ←</Link>
          </div>
        </div>
        <div className="lp-art" aria-hidden="true"><Logo size={220} /></div>
      </section>

      <section className="lp-sec">
        <h2>همه‌چیز برای ساختن عادت‌های ماندگار</h2>
        <div className="lp-grid">{FEATURES.map(([i, t, d]) => <article key={t} className="card"><span aria-hidden="true">{i}</span><h3>{t}</h3><p>{d}</p></article>)}</div>
      </section>

      <section className="lp-sec" id="pricing">
        <h2>رایگان یا پرو</h2>
        <div className="lp-price">
          <article className="card">
            <h3>رایگان</h3><p className="pr">۰ تومان</p>
            <ul><li>تا ۳ کار در هر روز و ۳ عادت فعال</li><li>تایم‌باکس، خواب، آب و یادداشت</li><li>تحلیل ۷، ۳۰ و ۹۰ روزه</li><li>خروجی CSV، پشتیبان JSON و کپی هفتهٔ قبل</li><li>یادآوری عادت‌ها و پشتیبانی آنلاین</li></ul>
            <Link href="/register" className="btn">شروع رایگان</Link>
          </article>
          <article className="card pro">
            <h3>پرو <small>★</small></h3>
            <p className="pr">{m ? `${money(m.price)} تومان / ماه` : "ماهانه یا سالانه"}</p>
            {y && <p className="sub" style={{ justifyContent: "flex-start", margin: 0 }}>سالانه {money(y.price)} تومان{save > 0 ? ` (حدود ${money(save)}٪ ارزان‌تر)` : ""}</p>}
            <ul><li>کار، عادت و کار تکراری نامحدود</li><li>تحلیل سالانه، مقایسهٔ هفته‌ها و بهترین روز هفته</li><li>گزارش هفتگی خودکار</li><li>تم‌های رنگی و اولویت در پشتیبانی</li></ul>
            <Link href={logged ? "/dashboard/upgrade" : "/register"} className="btn gold">{logged ? "ارتقا به پرو" : "ثبت‌نام و ارتقا"}</Link>
          </article>
        </div>
      </section>

      <section className="lp-sec">
        <h2>سؤال‌های رایج</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q} className="card"><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>
    </SiteShell>
  );
}
