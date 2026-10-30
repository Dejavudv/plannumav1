import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { ConsultForm } from "@/components/ConsultForm";

export const metadata: Metadata = { title: "درخواست مشاوره و اپ اختصاصی", description: "با مشاوره و تحلیل روش کاری‌تان، یک پلنر یا اپ شخصی‌سازی‌شده بسازیم." };

export default function Consult() {
  return (
    <SiteShell>
      <section className="prose">
        <h1>مشاوره و اپ شخصی‌سازی‌شده</h1>
        <p>سه سؤال کوتاه جواب بدهید تا بدانیم چه کمکی می‌خواهید. بعد با شما تماس می‌گیریم؛ درخواست ثبت‌کردن هیچ تعهدی ندارد.</p>
        <ConsultForm />
      </section>
    </SiteShell>
  );
}
