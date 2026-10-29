import "./planner.css";
import "./site.css";
import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";

const vazir = Vazirmatn({ subsets: ["arabic", "latin"], weight: ["400", "600", "800"], variable: "--font-vazir", display: "swap" });

export const metadata: Metadata = {
  title: "پلنوما | پلنر شخصی‌سازی‌شده",
  description: "پلنر هفتگی رایگان با هبیت ترکر، تایم‌باکس و تحلیل نموداری؛ و اپ اختصاصی برای هر فرد.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon-64.png", apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#4A2A7A", width: "device-width", initialScale: 1 };

// تم ذخیره‌شده را قبل از رندر اعمال می‌کند تا پرش رنگ نداشته باشیم
const THEME = `try{var t=localStorage.getItem('pl_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body>{children}</body>
    </html>
  );
}
