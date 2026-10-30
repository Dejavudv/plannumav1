from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from core.models import HabitCheck, Habit, Profile, SupportMessage, Todo, week_start
from core.push import send_push

PREFIX = "📊 گزارش هفتگی"


class Command(BaseCommand):
    help = "گزارش هفتگی برای کاربران پرو (هر شنبه با cron اجرا شود): 0 8 * * 6 python manage.py weekly_report"

    def handle(self, *args, **opts):
        now = timezone.now()
        ws = week_start(timezone.localdate()) - timedelta(days=7)
        we = ws + timedelta(days=6)
        profiles = Profile.objects.filter(plan="pro").filter(Q(pro_until__isnull=True) | Q(pro_until__gt=now)).select_related("user")
        n = 0
        for p in profiles:
            u = p.user
            if SupportMessage.objects.filter(user=u, from_staff=True, text__startswith=PREFIX, created__gte=now - timedelta(days=6)).exists():
                continue
            sched = done = 0
            best = None
            for h in Habit.objects.filter(user=u, start_date__lte=we).filter(Q(end_date__isnull=True) | Q(end_date__gte=ws)):
                checks = set(HabitCheck.objects.filter(habit=h, date__range=(ws, we)).values_list("date", flat=True))
                hs = hd = 0
                for i in range(7):
                    d = ws + timedelta(days=i)
                    if d >= h.start_date and (not h.end_date or d <= h.end_date) and str((d.weekday() + 2) % 7) in h.weekdays:
                        hs += 1
                        hd += d in checks
                sched, done = sched + hs, done + hd
                if hs and (best is None or hd / hs > best[1]):
                    best = (h.name, hd / hs)
            tt = Todo.objects.filter(user=u, date__range=(ws, we)).count()
            td = Todo.objects.filter(user=u, date__range=(ws, we), done=True).count()
            if not sched and not tt:
                continue
            lines = [f"{PREFIX} ({ws:%m/%d} تا {we:%m/%d})"]
            if sched:
                lines.append(f"• عادت‌ها: {round(done * 100 / sched)}٪ ({done} از {sched})")
            if tt:
                lines.append(f"• کارها: {td} از {tt}")
            if best:
                lines.append(f"• پایدارترین عادت: {best[0]} ({round(best[1] * 100)}٪)")
            lines.append("هفتهٔ جدید را با یک هدف کوچک شروع کن 💪")
            SupportMessage.objects.create(user=u, from_staff=True, text="\n".join(lines))
            send_push(u, "گزارش هفتگی پلنوما", "گزارش هفتهٔ گذشته‌ات آماده است 📊")
            n += 1
        self.stdout.write(f"{n} گزارش ارسال شد.")
