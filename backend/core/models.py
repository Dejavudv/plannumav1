import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


def get_private_storage():
    return FileSystemStorage(location=str(settings.PRIVATE_MEDIA_ROOT))


def receipt_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"receipts/{timezone.now():%Y/%m}/{uuid.uuid4().hex}.{ext}"


def week_start(d):
    """شروع هفته (شنبه)."""
    return d - timedelta(days=(d.weekday() + 2) % 7)


class Profile(models.Model):
    PLANS = [("free", "رایگان"), ("pro", "پرو")]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    plan = models.CharField("پلن", max_length=8, choices=PLANS, default="free")
    pro_until = models.DateTimeField("پرو تا", null=True, blank=True)
    water_goal = models.PositiveSmallIntegerField("هدف آب (لیوان)", default=8)
    glass_ml = models.PositiveSmallIntegerField("حجم لیوان (میلی‌لیتر)", default=250)
    sleep_goal = models.FloatField("هدف خواب (ساعت)", default=8)

    class Meta:
        verbose_name = "پروفایل"
        verbose_name_plural = "پروفایل‌ها"

    @property
    def is_pro(self):
        return self.plan == "pro" and (self.pro_until is None or self.pro_until > timezone.now())

    def __str__(self):
        return f"{self.user.username} ({self.plan})"


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(user=instance)


class AuthToken(models.Model):
    key_hash = models.CharField(max_length=64, unique=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens")
    created = models.DateTimeField(default=timezone.now)
    last_used = models.DateTimeField(default=timezone.now)


class Habit(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="habits")
    name = models.CharField("نام", max_length=100)
    color = models.PositiveSmallIntegerField(default=0)
    weekdays = models.CharField(max_length=7, default="0123456")  # 0=شنبه ... 6=جمعه
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "عادت"
        verbose_name_plural = "عادت‌ها"

    def __str__(self):
        return self.name


class HabitCheck(models.Model):
    habit = models.ForeignKey(Habit, on_delete=models.CASCADE, related_name="checks")
    date = models.DateField()

    class Meta:
        unique_together = [("habit", "date")]


class DayEntry(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="entries")
    date = models.DateField()
    note = models.TextField(blank=True, default="")
    sleep_bed = models.CharField(max_length=5, blank=True, default="")
    sleep_wake = models.CharField(max_length=5, blank=True, default="")
    sleep_quality = models.PositiveSmallIntegerField(default=0)
    water = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [("user", "date")]
        verbose_name = "ثبت روزانه"
        verbose_name_plural = "ثبت‌های روزانه"


class Todo(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="todos")
    date = models.DateField(db_index=True)
    title = models.CharField(max_length=200)
    done = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]


class Block(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocks")
    date = models.DateField(db_index=True)
    title = models.CharField(max_length=120)
    start_min = models.PositiveSmallIntegerField()
    end_min = models.PositiveSmallIntegerField()
    color = models.PositiveSmallIntegerField(default=0)


class Payment(models.Model):
    STATUS = [("pending", "در انتظار بررسی"), ("approved", "تأیید و فعال شد"), ("rejected", "رد شد")]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments", verbose_name="کاربر")
    plan_key = models.CharField("پلن", max_length=16)
    amount = models.PositiveIntegerField("مبلغ (تومان)")
    receipt = models.FileField("رسید", upload_to=receipt_path, storage=get_private_storage)
    note = models.CharField("توضیح کاربر", max_length=300, blank=True)
    status = models.CharField("وضعیت", max_length=10, choices=STATUS, default="pending", db_index=True)
    admin_note = models.CharField("پیام ادمین به کاربر", max_length=300, blank=True)
    created = models.DateTimeField("ثبت", auto_now_add=True)
    reviewed_at = models.DateTimeField("بررسی", null=True, blank=True)
    reviewed_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ["-created"]
        verbose_name = "پرداخت"
        verbose_name_plural = "پرداخت‌ها"

    def __str__(self):
        return f"#{self.pk} {self.user.username} - {self.plan_key}"


class SupportMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="support_messages")
    from_staff = models.BooleanField("از طرف پشتیبان", default=False)
    text = models.TextField("متن", max_length=2000)
    created = models.DateTimeField("زمان", default=timezone.now)
    read = models.BooleanField("خوانده‌شده توسط گیرنده", default=False)

    class Meta:
        ordering = ["id"]
        verbose_name = "پیام پشتیبانی"
        verbose_name_plural = "پیام‌های پشتیبانی"


class SupportThread(User):
    """نمای گفتگوی پشتیبانی هر کاربر در پنل ادمین."""

    class Meta:
        proxy = True
        verbose_name = "گفتگوی پشتیبانی"
        verbose_name_plural = "گفتگوهای پشتیبانی"
