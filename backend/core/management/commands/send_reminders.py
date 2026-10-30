from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from core.models import Habit, HabitCheck
from core.push import push_ready, send_push


class Command(BaseCommand):
    help = "یادآوری عادت‌ها (هر دقیقه با cron اجرا شود): * * * * * python manage.py send_reminders"

    def handle(self, *args, **opts):
        if not push_ready():
            self.stdout.write("VAPID تنظیم نشده؛ چیزی ارسال نشد.")
            return
        now = timezone.localtime()
        today, hm, wd = now.date(), now.strftime("%H:%M"), str((now.date().weekday() + 2) % 7)
        qs = (Habit.objects.filter(reminder=hm, start_date__lte=today).filter(Q(end_date__isnull=True) | Q(end_date__gte=today))
              .select_related("user"))
        sent = 0
        for h in qs:
            if wd not in h.weekdays or HabitCheck.objects.filter(habit=h, date=today).exists():
                continue
            sent += send_push(h.user, "یادآوری عادت", f"«{h.name}» را امروز انجام دادی؟ ✅")
        self.stdout.write(f"{sent} اعلان ارسال شد.")
