from datetime import timedelta

from django.conf import settings
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.models import User
from django.db.models import Max
from django.utils import timezone
from django.utils.html import format_html

from .api import profile_of
from .models import Payment, Profile, SupportMessage, SupportThread


def _notify(user, text):
    SupportMessage.objects.create(user=user, from_staff=True, text=text)


# ---------- کاربران و اشتراک ----------
class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    fields = ("plan", "pro_until", "water_goal", "glass_ml", "sleep_goal")


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    inlines = [ProfileInline]
    list_display = ("username", "plan", "pro_until", "is_staff", "date_joined")
    actions = ["activate_pro_30", "set_free"]

    @admin.display(description="پلن")
    def plan(self, obj):
        return "پرو" if profile_of(obj).is_pro else "رایگان"

    @admin.display(description="پرو تا")
    def pro_until(self, obj):
        return profile_of(obj).pro_until

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


# ---------- پرداخت‌ها ----------
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "plan_key", "amount", "status", "created", "receipt_link")
    list_filter = ("status", "plan_key")
    search_fields = ("user__username", "note")
    readonly_fields = ("user", "plan_key", "amount", "note", "created", "reviewed_at", "reviewed_by", "receipt_preview")
    fields = ("receipt_preview", "user", "plan_key", "amount", "note", "created", "status", "admin_note",
              "reviewed_at", "reviewed_by")
    actions = ["approve", "reject"]

    @admin.display(description="رسید")
    def receipt_link(self, obj):
        return format_html('<a href="/admin-files/receipt/{}" target="_blank">مشاهده</a>', obj.pk)

    @admin.display(description="تصویر رسید")
    def receipt_preview(self, obj):
        if not obj.pk:
            return "-"
        return format_html('<a href="/admin-files/receipt/{0}" target="_blank">'
                           '<img src="/admin-files/receipt/{0}" style="max-height:420px;border-radius:8px"></a>', obj.pk)

    @admin.action(description="✅ تأیید پرداخت و فعال‌سازی پرو")
    def approve(self, request, queryset):
        n = 0
        for p in queryset.filter(status="pending").select_related("user"):
            plan = settings.BILLING["plans"].get(p.plan_key, {"days": 30})
            prof = profile_of(p.user)
            base = prof.pro_until if prof.is_pro and prof.pro_until else timezone.now()
            prof.plan, prof.pro_until = "pro", base + timedelta(days=plan["days"])
            prof.save()
            p.status, p.reviewed_at, p.reviewed_by = "approved", timezone.now(), request.user
            p.admin_note = p.admin_note or "پرداخت شما تأیید و اشتراک پرو فعال شد. ممنون از حمایت شما!"
            p.save()
            _notify(p.user, f"✅ {p.admin_note} (تا {prof.pro_until:%Y/%m/%d})")
            n += 1
        self.message_user(request, f"{n} پرداخت تأیید و اشتراک فعال شد.", messages.SUCCESS)

    @admin.action(description="❌ رد رسید")
    def reject(self, request, queryset):
        n = 0
        for p in queryset.filter(status="pending").select_related("user"):
            p.status, p.reviewed_at, p.reviewed_by = "rejected", timezone.now(), request.user
            p.admin_note = p.admin_note or "رسید ارسالی تأیید نشد. لطفاً رسید واضح‌تر را دوباره بفرستید یا با پشتیبانی گفتگو کنید."
            p.save()
            _notify(p.user, "❌ " + p.admin_note)
            n += 1
        self.message_user(request, f"{n} رسید رد شد.", messages.WARNING)


# ---------- گفتگوی پشتیبانی ----------
class MessageInline(admin.TabularInline):
    model = SupportMessage
    fk_name = "user"
    extra = 1
    fields = ("from_staff", "text", "created")
    readonly_fields = ("created",)


@admin.register(SupportThread)
class SupportThreadAdmin(admin.ModelAdmin):
    list_display = ("username", "unread", "last_message")
    search_fields = ("username",)
    fields = ("username",)
    readonly_fields = ("username",)
    inlines = [MessageInline]

    def get_queryset(self, request):
        return (super().get_queryset(request).filter(support_messages__isnull=False)
                .annotate(last=Max("support_messages__created")).order_by("-last"))

    @admin.display(description="پیام خوانده‌نشده")
    def unread(self, obj):
        n = obj.support_messages.filter(from_staff=False, read=False).count()
        return format_html('<b style="color:#c0392b">{}</b>', n) if n else 0

    @admin.display(description="آخرین پیام")
    def last_message(self, obj):
        m = obj.support_messages.last()
        return (m.text[:60] if m else "-")

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
