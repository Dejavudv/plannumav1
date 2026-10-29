// همهٔ درخواست‌های /api به Django پروکسی می‌شود تا کوکی ورود هم‌مبدأ (same-origin) بماند.
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

module.exports = {
  reactStrictMode: true,
  // بعد از اولین اجرای موفق `npm run typecheck` این دو خط را حذف کنید تا خطاها بیلد را متوقف کنند.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
};
