export const SITE = {
  name: "پلنوما",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  telegram: process.env.NEXT_PUBLIC_CONTACT_TELEGRAM || "",   // مثلاً plannuma_support
  instagram: process.env.NEXT_PUBLIC_CONTACT_INSTAGRAM || "",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "",
  refundDays: Number(process.env.NEXT_PUBLIC_REFUND_DAYS || 7),
  updated: "۱۴۰۵/۰۸",
};
export const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";
