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
    accent = models.PositiveSmallIntegerField("تم رنگی (پرو)", default=0)
    last_seen = models.DateTimeField("آخرین فعالیت", null=True, blank=True)
    must_change_password = models.BooleanField("باید رمز را عوض کند", default=False)

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
    reminder = models.CharField(max_length=5, blank=True, default="")  # "HH:MM" یا خالی
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
    recurring = models.ForeignKey("RecurringTask", null=True, blank=True, on_delete=models.SET_NULL, related_name="todos")

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
    STATUS = [("awaiting", "منتظر رسید"), ("pending", "در انتظار بررسی"), ("approved", "تأیید و فعال شد"), ("rejected", "رد شد")]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments", verbose_name="کاربر")
    plan_key = models.CharField("پلن", max_length=16)
    amount = models.PositiveIntegerField("مبلغ (تومان)")
    receipt = models.FileField("رسید", upload_to=receipt_path, storage=get_private_storage, blank=True)
    base_price = models.PositiveIntegerField("قیمت پایه", default=0)
    discount = models.PositiveIntegerField("تخفیف", default=0)
    coupon = models.ForeignKey("Coupon", null=True, blank=True, on_delete=models.SET_NULL, related_name="payments", verbose_name="کد تخفیف")
    note = models.CharField("توضیح کاربر", max_length=300, blank=True)
    status = models.CharField("وضعیت", max_length=10, choices=STATUS, default="awaiting", db_index=True)
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


class RecurringTask(models.Model):
    """کار تکراری: هر هفته در روزهای مشخص خودکار به لیست کارها اضافه می‌شود."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="recurring_tasks")
    title = models.CharField(max_length=200)
    weekdays = models.CharField(max_length=7, default="0123456")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created = models.DateTimeField(auto_now_add=True)


class RecurringRun(models.Model):
    """ثبت اینکه کار تکراری برای یک روز ساخته شده (تا بعد از حذف دستی دوباره ساخته نشود)."""
    task = models.ForeignKey(RecurringTask, on_delete=models.CASCADE, related_name="runs")
    date = models.DateField()

    class Meta:
        unique_together = [("task", "date")]


class Coupon(models.Model):
    code = models.CharField("کد", max_length=30, unique=True)
    percent = models.PositiveSmallIntegerField("درصد تخفیف", default=0)
    amount = models.PositiveIntegerField("تخفیف ثابت (تومان)", default=0, help_text="اگر درصد صفر باشد استفاده می‌شود")
    plan_key = models.CharField("فقط برای پلن", max_length=16, blank=True, help_text="خالی = همهٔ پلن‌ها (monthly / yearly)")
    max_uses = models.PositiveIntegerField("حداکثر استفاده", default=0, help_text="۰ = نامحدود")
    used = models.PositiveIntegerField("تعداد استفاده", default=0)
    valid_until = models.DateTimeField("اعتبار تا", null=True, blank=True)
    active = models.BooleanField("فعال", default=True)

    class Meta:
        verbose_name = "کد تخفیف"
        verbose_name_plural = "کدهای تخفیف"

    def __str__(self):
        return self.code


    def validate_coupon(self, plan_key, price):
        """(مبلغ تخفیف, پیام خطا)"""
        if not self.active:
            return 0, "این کد فعال نیست."
        if self.valid_until and self.valid_until < timezone.now():
            return 0, "مهلت این کد تمام شده است."
        if self.max_uses and self.used >= self.max_uses:
            return 0, "ظرفیت این کد تمام شده است."
        if self.plan_key and self.plan_key != plan_key:
            return 0, "این کد برای این پلن معتبر نیست."
        d = price * self.percent // 100 if self.percent else self.amount
        d = min(d, max(price - 1000, 0))
        return (d, "") if d > 0 else (0, "این کد تخفیفی ندارد.")



class PushSubscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="push_subs")
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created = models.DateTimeField(auto_now_add=True)


class ConsultRequest(models.Model):
    STATUS = [("new", "جدید"), ("contacted", "تماس گرفته شد"), ("done", "انجام شد"), ("closed", "بسته")]
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="consults", verbose_name="کاربر")
    name = models.CharField("نام", max_length=100)
    contact = models.CharField("راه تماس", max_length=120)
    goal = models.TextField("هدف و توضیح", max_length=1500)
    kind = models.CharField("نوع نیاز", max_length=60, blank=True)
    budget = models.CharField("بودجه", max_length=60, blank=True)
    status = models.CharField("وضعیت", max_length=10, choices=STATUS, default="new", db_index=True)
    note = models.TextField("یادداشت داخلی", blank=True)
    created = models.DateTimeField("ثبت", auto_now_add=True)

    class Meta:
        ordering = ["-created"]
        verbose_name = "درخواست مشاوره"
        verbose_name_plural = "درخواست‌های مشاوره"

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class CannedReply(models.Model):
    title = models.CharField("عنوان", max_length=80)
    text = models.TextField("متن پاسخ", max_length=1000)

    class Meta:
        ordering = ["title"]
        verbose_name = "پاسخ آماده"
        verbose_name_plural = "پاسخ‌های آماده"

    def __str__(self):
        return self.title
