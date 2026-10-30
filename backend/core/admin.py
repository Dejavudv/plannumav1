import secrets
import string
from datetime import timedelta

from django.conf import settings
from django.contrib import admin, messages
from django.contrib.admin.models import CHANGE, LogEntry
from django.contrib.admin.options import get_content_type_for_model
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User
from django.db.models import Max
from django.utils import timezone
from django.utils.html import format_html, format_html_join

from .api import profile_of
from .models import CannedReply, ConsultRequest, Coupon, Payment, Profile, SupportMessage, SupportThread
from .stats import compute_stats


def _notify_user(user, text):
    SupportMessage.objects.create(user=user, from_staff=True, text=text)


def _log(request, obj, msg):
    LogEntry.objects.log_action(user_id=request.user.pk, content_type_id=get_content_type_for_model(obj).pk,
                                object_id=obj.pk, object_repr=str(obj)[:200], action_flag=CHANGE, change_message=msg)


# ---------- صفحهٔ اصلی ادمین: آمار ----------
admin.site.index_template = "admin/plannuma_index.html"
_orig_index = admin.site.index


def _index(request, extra_context=None):
    ctx = dict(extra_context or {})
    ctx["stats"] = compute_stats()
    return _orig_index(request, ctx)


admin.site.index = _index


# ---------- کاربران و اشتراک ----------
class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    fields = ("plan", "pro_until", "must_change_password", "last_seen", "water_goal", "glass_ml", "sleep_goal", "accent")
    readonly_fields = ("last_seen",)


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = [ProfileInline]
    list_display = ("username", "plan", "pro_until", "last_seen", "is_staff", "date_joined")
    actions = ["activate_pro_30", "set_free", "temp_password"]

    @admin.display(description="پلن")
    def plan(self, obj):
        return "پرو" if profile_of(obj).is_pro else "رایگان"

    @admin.display(description="پرو تا")
    def pro_until(self, obj):
        return profile_of(obj).pro_until

    @admin.display(description="آخرین فعالیت")
    def last_seen(self, obj):
        return profile_of(obj).last_seen

    @admin.action(description="فعال‌سازی پرو برای ۳۰ روز")
    def activate_pro_30(self, request, queryset):
        for u in queryset:
            p = profile_of(u)
            base = p.pro_until if p.is_pro and p.pro_until else timezone.now()
            p.plan, p.pro_until = "pro", base + timedelta(days=30)
            p.save()
        self.message_user(request, f"پرو برای {queryset.count()} کاربر فعال شد.")

    @admin.action(description="بازگرداندن به نسخهٔ رایگان")
    def set_free(self, request, queryset):
        for u in queryset:
            p = profile_of(u)
            p.plan, p.pro_until = "free", None
            p.save()

    @admin.action(description="🔑 تنظیم رمز موقت (بازیابی رمز)")
    def temp_password(self, request, queryset):
        alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        out = []
        for u in queryset.filter(is_staff=False):
            pw = "".join(secrets.choice(alphabet) for _ in range(10))
            u.set_password(pw)
            u.save()
            p = profile_of(u)
            p.must_change_password = True
            p.save(update_fields=["must_change_password"])
            u.tokens.all().delete()
            out.append(f"{u.username}  ←  {pw}")
        self.message_user(request, "رمز موقت (فقط همین یک‌بار نمایش داده می‌شود؛ کاربر بعد از ورود باید رمز را عوض کند): " + " | ".join(out), messages.WARNING)


# ---------- پرداخت‌ها ----------
REJECTS = {
    "reject_unreadable": ("رسید ناخوانا", "رسید ارسالی خوانا نیست. لطفاً عکس واضح‌تری بفرستید."),
    "reject_amount": ("مبلغ نادرست", "مبلغ رسید با مبلغ درخواست‌شده یکی نیست. لطفاً دقیقاً همان مبلغ نمایش‌داده‌شده را واریز و رسید را دوباره بفرستید."),
    "reject_notfound": ("واریز پیدا نشد", "واریزی با این مشخصات در حساب ما پیدا نشد. اگر پرداخت کرده‌اید، در گفتگوی پشتیبانی زمان و مبلغ را بنویسید."),
    "reject_invalid": ("رسید نامعتبر", "رسید ارسالی معتبر تشخیص داده نشد."),
}


def _reject_action(key, label, msg):
    @admin.action(description=f"❌ رد: {label}")
    def action(modeladmin, request, queryset):
        modeladmin._reject(request, queryset, msg)
    action.__name__ = key
    return action


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "plan_key", "amount", "discount", "status", "created", "reviewed_by", "reviewed_at", "receipt_link")
    list_filter = ("status", "plan_key")
    search_fields = ("user__username", "note")
    readonly_fields = ("user", "plan_key", "amount", "base_price", "discount", "coupon", "note", "created", "reviewed_at", "reviewed_by", "receipt_preview")
    fields = ("receipt_preview", "user", "plan_key", "base_price", "discount", "coupon", "amount", "note", "created", "status", "admin_note", "reviewed_at", "reviewed_by")
    actions = ["approve", "reject_custom"] + [_reject_action(k, *v) for k, v in REJECTS.items()]

    @admin.display(description="رسید")
    def receipt_link(self, obj):
        return format_html('<a href="/admin-files/receipt/{}" target="_blank">مشاهده</a>', obj.pk) if obj.receipt else "-"

    @admin.display(description="تصویر رسید")
    def receipt_preview(self, obj):
        if not obj.pk or not obj.receipt:
            return "-"
        return format_html('<a href="/admin-files/receipt/{0}" target="_blank"><img src="/admin-files/receipt/{0}" style="max-height:420px;border-radius:8px"></a>', obj.pk)

    @admin.action(description="✅ تأیید پرداخت و فعال‌سازی پرو")
    def approve(self, request, queryset):
        n = 0
        for p in queryset.filter(status="pending").select_related("user", "coupon"):
            plan = settings.BILLING["plans"].get(p.plan_key, {"days": 30})
            prof = profile_of(p.user)
            base = prof.pro_until if prof.is_pro and prof.pro_until else timezone.now()
            prof.plan, prof.pro_until = "pro", base + timedelta(days=plan["days"])
            prof.save()
            p.status, p.reviewed_at, p.reviewed_by = "approved", timezone.now(), request.user
            p.admin_note = p.admin_note or "پرداخت شما تأیید و اشتراک پرو فعال شد. ممنون از حمایت شما!"
            p.save()
            if p.coupon:
                Coupon.objects.filter(pk=p.coupon_id).update(used=p.coupon.used + 1)
            _notify_user(p.user, f"✅ {p.admin_note} (تا {prof.pro_until:%Y/%m/%d})")
            _log(request, p, "تأیید پرداخت و فعال‌سازی پرو")
            n += 1
        self.message_user(request, f"{n} پرداخت تأیید و اشتراک فعال شد.", messages.SUCCESS)

    def _reject(self, request, queryset, msg=None):
        n = 0
        for p in queryset.filter(status="pending").select_related("user"):
            p.status, p.reviewed_at, p.reviewed_by = "rejected", timezone.now(), request.user
            p.admin_note = msg or p.admin_note or "رسید ارسالی تأیید نشد. لطفاً با پشتیبانی گفتگو کنید."
            p.save()
            _notify_user(p.user, "❌ " + p.admin_note)
            _log(request, p, "رد رسید: " + p.admin_note)
            n += 1
        self.message_user(request, f"{n} رسید رد شد.", messages.WARNING)

    @admin.action(description="❌ رد با پیام دلخواه (از فیلد «پیام ادمین» همان رسید)")
    def reject_custom(self, request, queryset):
        self._reject(request, queryset)


# ---------- کد تخفیف ----------
@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ("code", "percent", "amount", "plan_key", "used", "max_uses", "valid_until", "active")
    list_filter = ("active",)
    search_fields = ("code",)
    readonly_fields = ("used",)


# ---------- درخواست مشاوره ----------
@admin.register(ConsultRequest)
class ConsultRequestAdmin(admin.ModelAdmin):
    list_display = ("name", "contact", "kind", "budget", "status", "created")
    list_filter = ("status", "kind")
    search_fields = ("name", "contact", "goal")
    readonly_fields = ("user", "name", "contact", "kind", "budget", "goal", "created")


# ---------- پاسخ‌های آماده ----------
@admin.register(CannedReply)
class CannedReplyAdmin(admin.ModelAdmin):
    list_display = ("title", "text")


# ---------- گفتگوی پشتیبانی ----------
class MessageInline(admin.TabularInline):
    model = SupportMessage
    fk_name = "user"
    extra = 1
    fields = ("from_staff", "text", "created")
    readonly_fields = ("created",)


@admin.register(SupportThread)
class SupportThreadAdmin(admin.ModelAdmin):
    list_display = ("username", "plan", "unread", "last_message")
    search_fields = ("username",)
    fields = ("username", "info", "quick")
    readonly_fields = ("username", "info", "quick")
    inlines = [MessageInline]

    class Media:
        js = ("core/support.js",)

    def get_queryset(self, request):
        return (super().get_queryset(request).filter(support_messages__isnull=False)
                .annotate(last=Max("support_messages__created")).order_by("-last"))

    @admin.display(description="پلن")
    def plan(self, obj):
        return "پرو" if profile_of(obj).is_pro else "رایگان"

    @admin.display(description="اطلاعات کاربر")
    def info(self, obj):
        p = profile_of(obj)
        pend = obj.payments.filter(status="pending").count()
        return format_html("عضویت: {} · آخرین فعالیت: {} · پلن: {}{} · رسید منتظر بررسی: {}", f"{obj.date_joined:%Y/%m/%d}", f"{p.last_seen:%Y/%m/%d %H:%M}" if p.last_seen else "—",
                           "پرو" if p.is_pro else "رایگان", f" (تا {p.pro_until:%Y/%m/%d})" if p.pro_until else "", pend)

    @admin.display(description="پاسخ‌های آماده (کلیک = درج در کادر پیام جدید)")
    def quick(self, obj):
        items = [(r.text, r.title) for r in CannedReply.objects.all()]
        return format_html_join(" ", '<button type="button" data-qr="{}" style="margin:2px;padding:4px 10px;cursor:pointer">{}</button>', items) if items else "پاسخ آماده‌ای تعریف نشده (بخش «پاسخ‌های آماده»)."

    @admin.display(description="پیام خوانده‌نشده")
    def unread(self, obj):
        n = obj.support_messages.filter(from_staff=False, read=False).count()
        return format_html('<b style="color:#c0392b">{}</b>', n) if n else 0

    @admin.display(description="آخرین پیام")
    def last_message(self, obj):
        m = obj.support_messages.last()
        return m.text[:60] if m else "-"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def change_view(self, request, object_id, form_url="", extra_context=None):
        SupportMessage.objects.filter(user_id=object_id, from_staff=False, read=False).update(read=True)
        return super().change_view(request, object_id, form_url, extra_context)

    def save_formset(self, request, form, formset, change):
        for obj in formset.save(commit=False):
            if obj.pk is None:
                obj.from_staff = True  # هر پیام جدید در این صفحه از طرف پشتیبان است
            obj.save()
        for obj in formset.deleted_objects:
            obj.delete()
        formset.save_m2m()
