from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import F, Q, Sum
from django.utils import timezone

from .models import ConsultRequest, Payment, Profile, SupportMessage


def _retention(days):
    now = timezone.now()
    cohort = Profile.objects.filter(user__is_staff=False, user__date_joined__lte=now - timedelta(days=days))
    total = cohort.count()
    back = cohort.filter(last_seen__gte=F("user__date_joined") + timedelta(days=days)).count()
    return {"days": days, "total": total, "back": back, "pct": round(back * 100 / total) if total else None}


def compute_stats():
    now, today = timezone.now(), timezone.localdate()
    users = User.objects.filter(is_staff=False)
    prof = Profile.objects.filter(user__is_staff=False)
    pro = prof.filter(plan="pro").filter(Q(pro_until__isnull=True) | Q(pro_until__gt=now))
    approved = Payment.objects.filter(status="approved")
    return {
        "users_total": users.count(),
        "new_today": users.filter(date_joined__date=today).count(),
        "new_7": users.filter(date_joined__gte=now - timedelta(days=7)).count(),
        "active_7": prof.filter(last_seen__gte=now - timedelta(days=7)).count(),
        "active_30": prof.filter(last_seen__gte=now - timedelta(days=30)).count(),
        "pro": pro.count(),
        "expiring": pro.filter(pro_until__lte=now + timedelta(days=7)).count(),
        "pending": Payment.objects.filter(status="pending").count(),
        "revenue_30": approved.filter(reviewed_at__gte=now - timedelta(days=30)).aggregate(s=Sum("amount"))["s"] or 0,
        "revenue_all": approved.aggregate(s=Sum("amount"))["s"] or 0,
        "unread_chats": SupportMessage.objects.filter(from_staff=False, read=False).values("user").distinct().count(),
        "consult_new": ConsultRequest.objects.filter(status="new").count(),
        "retention": [_retention(7), _retention(30)],
    }
