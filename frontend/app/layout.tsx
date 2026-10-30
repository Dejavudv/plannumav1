import "./planner.css";
import "./fonts.css";
import "./site.css";
import type { Metadata, Viewport } from "next";
import { PWA } from "@/components/PWA";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "پلنوما | پلنر شخصی‌سازی‌شده", template: "%s | پلنوما" },
  description: "پلنر هفتگی رایگان با هبیت ترکر، تایم‌باکس و تحلیل نموداری؛ و اپ اختصاصی برای هر فرد.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-64.png", apple: "/apple-touch-icon.png" },
  openGraph: { type: "website", locale: "fa_IR", siteName: "پلنوما", title: "پلنوما | پلنر شخصی‌سازی‌شده", description: "هبیت ترکر، تایم‌باکس و تحلیل نموداری؛ رایگان شروع کن.", images: [{ url: "/og-image.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "پلنوما", description: "پلنر شخصی‌سازی‌شده برای مسیر موفقیت تو", images: ["/og-image.png"] },
};
export const viewport: Viewport = { themeColor: "#4A2A7A", width: "device-width", initialScale: 1 };

// تم و رنگ ذخیره‌شده را قبل از رندر اعمال می‌کند تا پرش رنگ نداشته باشیم
const INIT = `try{var t=localStorage.getItem('pl_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);var a=localStorage.getItem('pl_accent');if(a)document.documentElement.setAttribute('data-accent',a)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: INIT }} /></head>
      <body>{children}<PWA /></body>
    </html>
  );
}
