// فونت وزیرمتن را از بستهٔ npm (vazirmatn) به public/fonts کپی می‌کند و app/fonts.css می‌سازد.
// بدون وابستگی به گوگل؛ اگر بسته پیدا نشود، از فونت سیستم استفاده می‌شود.
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "node_modules", "vazirmatn");
const out = path.join(root, "public", "fonts");
const cssFile = path.join(root, "app", "fonts.css");

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o;
  for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p, o) : o.push(p); }
  return o;
};
const files = walk(src).filter((f) => f.endsWith(".woff2"));
if (!files.length) { console.warn("[fonts] بستهٔ vazirmatn پیدا نشد؛ فعلاً از فونت سیستم استفاده می‌شود."); process.exit(0); }

fs.mkdirSync(out, { recursive: true });
const variable = files.find((f) => /^Vazirmatn(\[wght\]|-Variable)\.woff2$/i.test(path.basename(f)));
let rules = "";
if (variable) {
  fs.copyFileSync(variable, path.join(out, "Vazirmatn-Variable.woff2"));
  rules = `@font-face{font-family:"Vazirmatn";src:url("/fonts/Vazirmatn-Variable.woff2") format("woff2");font-weight:100 900;font-display:swap}\n`;
} else {
  const W = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
  for (const f of files) {
    const m = path.basename(f, ".woff2").match(/^Vazirmatn-(Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|Black)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), name = `Vazirmatn-${k}.woff2`;
    fs.copyFileSync(f, path.join(out, name));
    rules += `@font-face{font-family:"Vazirmatn";src:url("/fonts/${name}") format("woff2");font-weight:${W[k]};font-display:swap}\n`;
  }
}
fs.writeFileSync(cssFile, "/* تولیدشده توسط scripts/setup-fonts.mjs */\n" + rules);
console.log("[fonts] وزیرمتن آماده شد.");
