"""ویوهای تکمیلی: قیمت‌ها، حساب کاربری، پشتیبان‌گیری/بازیابی، کارهای تکراری، پرداخت v2، اعلان‌ها، مشاوره."""
import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone

from .api import (_hash, api, clear_auth_cookie, client_ip, fail, parse_date, profile_of, throttled, user_from_request)
from .models import (AuthToken, Block, ConsultRequest, Coupon, DayEntry, Habit, HabitCheck, Payment, PushSubscription,
                     RecurringRun, RecurringTask, Todo, week_start)
from .notify import notify
from .push import push_ready, send_push
from .views import _sniff, clean_weekdays, limit_error, me_payload

PLANS = settings.BILLING["plans"]


# ---------- عمومی ----------
@api(("GET",), auth=False)
def plans(request):
    return JsonResponse({
        "plans": [{"id": k, "title": v["title"], "price": v["price"], "days": v["days"]} for k, v in PLANS.items()],
        "limits": settings.FREE_LIMITS,
    })


# ---------- حساب کاربری ----------
@api(("POST",))
def change_password(request):
    u, d = request.api_user, request.data
    cur, new = str(d.get("current", "")), str(d.get("new", ""))
    if throttled(f"pw:{u.id}", 8, 900):
        return fail("throttled", "تلاش‌ها زیاد بود؛ کمی بعد دوباره امتحان کنید.", 429)
    if not u.check_password(cur):
        return fail("bad_credentials", "رمز فعلی اشتباه است.")
    if new == cur:
        return fail("same_password", "رمز جدید باید با رمز فعلی فرق داشته باشد.")
    try:
        validate_password(new, u)
    except ValidationError as e:
        return fail("weak_password", " ".join(e.messages))
    u.set_password(new)
    u.save()
    p = profile_of(u)
    p.must_change_password = False
    p.save(update_fields=["must_change_password"])
    keep = request.COOKIES.get(settings.AUTH_COOKIE)
    AuthToken.objects.filter(user=u).exclude(key_hash=_hash(keep or "")).delete()  # خروج از بقیهٔ دستگاه‌ها
    return JsonResponse(me_payload(u))


@api(("POST",))
def delete_account(request):
    u = request.api_user
    if u.is_staff:
        return fail("staff", "حساب ادمین از اینجا حذف نمی‌شود.", 403)
    if throttled(f"del:{u.id}", 5, 900):
        return fail("throttled", "تلاش‌ها زیاد بود.", 429)
    if not u.check_password(str(request.data.get("password", ""))):
        return fail("bad_credentials", "رمز عبور اشتباه است.")
    for p in u.payments.all():
        if p.receipt:
            p.receipt.delete(save=False)  # فایل رسیدها هم پاک شود
    u.delete()
    resp = JsonResponse({"ok": True})
    clear_auth_cookie(resp)
    return resp


# ---------- پشتیبان‌گیری و بازیابی ----------
def backup_data(u):
    p = profile_of(u)
    days = {}

    def day(k):
        return days.setdefault(k.isoformat(), {"note": "", "bed": "", "wake": "", "q": 0, "water": 0, "todos": [], "blocks": []})
    for e in DayEntry.objects.filter(user=u):
        day(e.date).update(note=e.note, bed=e.sleep_bed, wake=e.sleep_wake, q=e.sleep_quality, water=e.water)
    for t in Todo.objects.filter(user=u):
        day(t.date)["todos"].append({"title": t.title, "done": t.done})
    for b in Block.objects.filter(user=u):
        day(b.date)["blocks"].append({"title": b.title, "start": b.start_min, "end": b.end_min, "color": b.color})
    habits = []
    for h in Habit.objects.filter(user=u):
        habits.append({"name": h.name, "color": h.color, "weekdays": [int(c) for c in h.weekdays], "start": h.start_date.isoformat(),
                       "end": h.end_date.isoformat() if h.end_date else None, "reminder": h.reminder,
                       "checks": sorted(c.date.isoformat() for c in h.checks.all())})
    return {
        "app": "plannuma", "version": 1, "exported": timezone.now().isoformat(),
        "settings": {"water_goal": p.water_goal, "glass_ml": p.glass_ml, "sleep_goal": p.sleep_goal},
        "habits": habits, "days": days,
        "recurring": [{"title": r.title, "weekdays": [int(c) for c in r.weekdays], "start": r.start_date.isoformat(),
                       "end": r.end_date.isoformat() if r.end_date else None} for r in RecurringTask.objects.filter(user=u)],
    }


@api(("GET",))
def backup(request):
    resp = JsonResponse(backup_data(request.api_user), json_dumps_params={"ensure_ascii": False, "indent": 1})
    resp["Content-Disposition"] = f'attachment; filename="plannuma-backup-{timezone.localdate()}.json"'
    return resp


@api(("POST",))
def restore(request):
    """بازیابی به‌صورت «ادغام» است: چیزی حذف یا بازنویسی نمی‌شود؛ موارد تکراری رد می‌شوند. سقف نسخهٔ رایگان رعایت می‌شود."""
    u, d = request.api_user, request.data
    if not isinstance(d.get("days", {}), dict) or not isinstance(d.get("habits", []), list):
        return fail("bad_file", "فایل پشتیبان معتبر نیست.")
    if "days" not in d and "habits" not in d:
        return fail("bad_file", "فایل پشتیبان معتبر نیست.")
    pro = profile_of(u).is_pro
    lim_t, lim_h = settings.FREE_LIMITS["todos_per_day"], settings.FREE_LIMITS["habits"]
    st = {"habits": 0, "checks": 0, "todos": 0, "blocks": 0, "entries": 0, "skipped": 0}
    with transaction.atomic():
        idx = {h.name: h for h in Habit.objects.filter(user=u)}
        for hd in (d.get("habits") or [])[:200]:
            if not isinstance(hd, dict):
                continue
            name = str(hd.get("name", "")).strip()[:100]
            if not name:
                continue
            h = idx.get(name)
            if not h:
                if not pro and Habit.objects.filter(user=u, end_date__isnull=True).count() >= lim_h:
                    st["skipped"] += 1
                    continue
                start = parse_date(hd.get("start")) or timezone.localdate()
                end = parse_date(hd.get("end")) if hd.get("end") else None
                h = Habit.objects.create(user=u, name=name, color=int(hd.get("color", 0) or 0) % 5, start_date=week_start(start), end_date=end,
                                         weekdays=clean_weekdays(hd.get("weekdays") or range(7)) or "0123456",
                                         position=Habit.objects.filter(user=u).count())
                idx[name] = h
                st["habits"] += 1
            for ds in (hd.get("checks") or [])[:6000]:
                dd = parse_date(ds)
                if dd and HabitCheck.objects.get_or_create(habit=h, date=dd)[1]:
                    st["checks"] += 1
                    if dd < h.start_date:
                        h.start_date = week_start(dd)
                        h.save(update_fields=["start_date"])
        for ds, day in list((d.get("days") or {}).items())[:4000]:
            dd = parse_date(ds)
            if not dd or not isinstance(day, dict):
                continue
            e, _ = DayEntry.objects.get_or_create(user=u, date=dd)
            ch = False
            if day.get("note") and not e.note:
                e.note, ch = str(day["note"])[:5000], True
            for k, f in (("bed", "sleep_bed"), ("wake", "sleep_wake")):
                v = str(day.get(k) or "")
                if v and len(v) == 5 and not getattr(e, f):
                    setattr(e, f, v)
                    ch = True
            if day.get("q") and not e.sleep_quality:
                e.sleep_quality, ch = min(5, max(0, int(day["q"]))), True
            if day.get("water") and not e.water:
                e.water, ch = min(60, max(0, int(day["water"]))), True
            if ch:
                e.save()
                st["entries"] += 1
            have = set(Todo.objects.filter(user=u, date=dd).values_list("title", flat=True))
            for t in (day.get("todos") or [])[:100]:
                title = str((t or {}).get("title", "")).strip()[:200]
                if not title or title in have:
                    continue
                if not pro and len(have) >= lim_t:
                    st["skipped"] += 1
                    continue
                Todo.objects.create(user=u, date=dd, title=title, done=bool(t.get("done")), position=len(have))
                have.add(title)
                st["todos"] += 1
            have_b = {(b.title, b.start_min, b.end_min) for b in Block.objects.filter(user=u, date=dd)}
            for b in (day.get("blocks") or [])[:100]:
                try:
                    title, s_, e_ = str(b.get("title", "")).strip()[:120], int(b["start"]), int(b["end"])
                except (KeyError, TypeError, ValueError, AttributeError):
                    continue
                if title and 0 <= s_ < e_ <= 1440 and (title, s_, e_) not in have_b:
                    Block.objects.create(user=u, date=dd, title=title, start_min=s_, end_min=e_, color=int(b.get("color", 0) or 0) % 5)
                    have_b.add((title, s_, e_))
                    st["blocks"] += 1
    return JsonResponse(st)


# ---------- کارهای تکراری ----------
def ser_rec(r):
    return {"id": r.id, "title": r.title, "weekdays": [int(c) for c in r.weekdays], "start": r.start_date.isoformat(),
            "end": r.end_date.isoformat() if r.end_date else None}


@api(("GET", "POST"))
def recurring(request):
    u = request.api_user
    if request.method == "GET":
        return JsonResponse({"items": [ser_rec(r) for r in RecurringTask.objects.filter(user=u, end_date__isnull=True)]})
    d = request.data
    title, wd, start = str(d.get("title", "")).strip()[:200], clean_weekdays(d.get("weekdays")), parse_date(d.get("start"))
    if not title or not wd or not start:
        return fail("bad_value", "عنوان و روزهای تکرار را وارد کنید.")
    if not profile_of(u).is_pro and RecurringTask.objects.filter(user=u, end_date__isnull=True).count() >= settings.FREE_LIMITS["recurring"]:
        return limit_error("recurring")
    r = RecurringTask.objects.create(user=u, title=title, weekdays=wd, start_date=start)
    return JsonResponse(ser_rec(r), status=201)


@api(("DELETE",))
def recurring_item(request, pk):
    r = get_object_or_404(RecurringTask, pk=pk, user=request.api_user)
    Todo.objects.filter(recurring=r, date__gte=timezone.localdate(), done=False).delete()  # نمونه‌های آینده و انجام‌نشده
    r.delete()
    return JsonResponse({"ok": True})


# ---------- پرداخت کارت‌به‌کارت (مبلغ یکتا + کد تخفیف) ----------
def ser_payment(p):
    exp = p.created + timedelta(hours=settings.BILLING["request_hours"])
    return {"id": p.id, "plan": p.plan_key, "amount": p.amount, "base_price": p.base_price, "discount": p.discount, "status": p.status,
            "created": p.created.isoformat(), "expires": exp.isoformat(), "admin_note": p.admin_note, "has_receipt": bool(p.receipt)}


@api(("GET",))
def billing(request):
    u, b, now = request.api_user, settings.BILLING, timezone.now()
    Payment.objects.filter(user=u, status="awaiting", created__lt=now - timedelta(hours=b["request_hours"])).delete()
    open_req = Payment.objects.filter(user=u, status="awaiting").first()
    return JsonResponse({
        "card": {"number": b["card_number"], "holder": b["card_holder"], "bank": b["bank"]},
        "plans": [{"id": k, "title": v["title"], "price": v["price"], "days": v["days"]} for k, v in PLANS.items()],
        "payments": [ser_payment(p) for p in Payment.objects.filter(user=u).exclude(status="awaiting")[:10]],
        "request": ser_payment(open_req) if open_req else None,
        "limits": settings.FREE_LIMITS,
    })



def _coupon(code, plan_id, price):
    code = str(code or "").strip()
    if not code:
        return None, 0, ""

    c = Coupon.objects.filter(code__iexact=code).first()
    if not c:
        return None, 0, "کد تخفیف معتبر نیست."

    discount, error = c.validate_coupon(plan_id, price)

    return (c, discount, "") if not error else (None, 0, error)


@api(("POST",))
def coupon_check(request):
    plan = PLANS.get(str(request.data.get("plan", "")))
    if not plan:
        return fail("bad_plan", "پلن نامعتبر است.")
    c, d, err = _coupon(request.data.get("code"), request.data.get("plan"), plan["price"])
    if err:
        return fail("bad_coupon", err)
    return JsonResponse({"discount": d, "payable": plan["price"] - d})


@api(("POST",))
def billing_request(request):
    """ساخت درخواست پرداخت با مبلغ یکتا (برای تطبیق آسان رسید)."""
    u, d, b = request.api_user, request.data, settings.BILLING
    pid = str(d.get("plan", ""))
    plan = PLANS.get(pid)
    if not plan:
        return fail("bad_plan", "پلن نامعتبر است.")
    if Payment.objects.filter(user=u, status="pending").exists():
        return fail("pending_exists", "یک رسید در انتظار بررسی دارید؛ لطفاً تا تأیید آن صبر کنید.", 409)
    if throttled(f"payreq:{u.id}", 20, 86400):
        return fail("throttled", "تعداد درخواست‌ها زیاد بود.", 429)
    c, disc, err = _coupon(d.get("coupon"), pid, plan["price"])
    if err:
        return fail("bad_coupon", err)
    payable = plan["price"] - disc
    taken = set(Payment.objects.filter(status__in=["awaiting", "pending"], created__gte=timezone.now() - timedelta(hours=48)).values_list("amount", flat=True))
    suffix = random.randint(1, b["suffix_max"])
    for _ in range(60):
        if payable + suffix not in taken:
            break
        suffix = random.randint(1, b["suffix_max"])
    Payment.objects.filter(user=u, status="awaiting").delete()
    p = Payment.objects.create(user=u, plan_key=pid, amount=payable + suffix, base_price=plan["price"], discount=disc, coupon=c, status="awaiting")
    return JsonResponse(ser_payment(p), status=201)


@api(("POST", "DELETE"))
def billing_request_item(request, pk, action=""):
    u = request.api_user
    p = get_object_or_404(Payment, pk=pk, user=u, status="awaiting")
    if request.method == "DELETE":
        p.delete()
        return JsonResponse({"ok": True})
    if p.created < timezone.now() - timedelta(hours=settings.BILLING["request_hours"]):
        p.delete()
        return fail("expired", "مهلت این درخواست تمام شده؛ دوباره درخواست بسازید.", 410)
    f = request.FILES.get("receipt")
    if not f:
        return fail("no_receipt", "عکس رسید را انتخاب کنید.")
    if f.size > 5 * 1024 * 1024:
        return fail("too_big", "حجم عکس باید کمتر از ۵ مگابایت باشد.")
    head = f.read(16)
    f.seek(0)
    ext = _sniff(head)
    if not ext:
        return fail("bad_image", "فقط عکس JPG، PNG یا WEBP قابل قبول است.")
    f.name = f"receipt.{ext}"
    p.receipt, p.status, p.note = f, "pending", str(request.data.get("note", ""))[:300]
    p.save()
    notify(f"🧾 رسید جدید از {u.username}\nپلن: {PLANS[p.plan_key]['title']}\nمبلغ: {p.amount:,} تومان\n{settings.NOTIFY['admin_url']}core/payment/{p.id}/change/", key=f"pay:{p.id}")
    return JsonResponse(ser_payment(p))


# ---------- اعلان‌ها ----------
@api(("POST",))
def push_subscribe(request):
    d, u = request.data, request.api_user
    keys = d.get("keys") or {}
    if not d.get("endpoint") or not keys.get("p256dh") or not keys.get("auth"):
        return fail("bad_value")
    PushSubscription.objects.update_or_create(endpoint=str(d["endpoint"]), defaults={"user": u, "p256dh": keys["p256dh"], "auth": keys["auth"]})
    return JsonResponse({"ok": True, "ready": push_ready()})


@api(("POST",))
def push_unsubscribe(request):
    ep = request.data.get("endpoint")
    qs = PushSubscription.objects.filter(user=request.api_user)
    (qs.filter(endpoint=ep) if ep else qs).delete()
    return JsonResponse({"ok": True})


@api(("POST",))
def push_test(request):
    n = send_push(request.api_user, "پلنوما", "اعلان آزمایشی با موفقیت رسید ✅")
    return JsonResponse({"sent": n, "ready": push_ready()})


# ---------- فرم مشاوره (عمومی) ----------
@api(("POST",), auth=False)
def consult(request):
    d = request.data
    if throttled(f"consult:{client_ip(request)}", 5, 86400):
        return fail("throttled", "تعداد درخواست‌های امروز زیاد بود.", 429)
    name, contact, goal = str(d.get("name", "")).strip()[:100], str(d.get("contact", "")).strip()[:120], str(d.get("goal", "")).strip()[:1500]
    if len(name) < 2 or len(contact) < 5 or len(goal) < 10:
        return fail("bad_value", "نام، راه تماس و توضیح هدف را کامل‌تر بنویسید.")
    u = user_from_request(request)
    r = ConsultRequest.objects.create(user=u, name=name, contact=contact, goal=goal, kind=str(d.get("kind", ""))[:60], budget=str(d.get("budget", ""))[:60])
    notify(f"📋 درخواست مشاوره از {name}\nتماس: {contact}\nنوع: {r.kind}\nبودجه: {r.budget}\n{goal[:300]}\n{settings.NOTIFY['admin_url']}core/consultrequest/{r.id}/change/")
    return JsonResponse({"ok": True}, status=201)
