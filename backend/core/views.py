import re
from datetime import timedelta

from django.conf import settings
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Min
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import get_object_or_404

from .api import (api, clear_auth_cookie, client_ip, fail, issue_token, parse_date, profile_of,
                  set_auth_cookie, throttled)
from .models import (Block, DayEntry, Habit, HabitCheck, Payment, SupportMessage, Todo, week_start, AuthToken)

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,30}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


# ---------- کمک‌ها ----------
def first_date(user):
    ds = [x for x in (Todo.objects.filter(user=user).aggregate(m=Min("date"))["m"],
                      DayEntry.objects.filter(user=user).aggregate(m=Min("date"))["m"],
                      Block.objects.filter(user=user).aggregate(m=Min("date"))["m"],
                      Habit.objects.filter(user=user).aggregate(m=Min("start_date"))["m"]) if x]
    return min(ds).isoformat() if ds else None


def me_payload(user):
    p = profile_of(user)
    return {
        "user": {"id": user.id, "username": user.username, "is_staff": user.is_staff},
        "plan": {"is_pro": p.is_pro, "until": p.pro_until.isoformat() if p.pro_until else None},
        "limits": None if p.is_pro else settings.FREE_LIMITS,
        "settings": {"water_goal": p.water_goal, "glass_ml": p.glass_ml, "sleep_goal": p.sleep_goal},
        "unread_support": SupportMessage.objects.filter(user=user, from_staff=True, read=False).count(),
        "pending_payment": Payment.objects.filter(user=user, status="pending").exists(),
        "first_date": first_date(user),
    }


def ser_habit(h):
    return {"id": h.id, "name": h.name, "color": h.color, "weekdays": [int(c) for c in h.weekdays],
            "start": h.start_date.isoformat(), "end": h.end_date.isoformat() if h.end_date else None}


def ser_todo(t):
    return {"id": t.id, "title": t.title, "done": t.done}


def ser_block(b):
    return {"id": b.id, "title": b.title, "start": b.start_min, "end": b.end_min, "color": b.color}


def limit_error(kind):
    msgs = {"todos": f"در نسخهٔ رایگان حداکثر {settings.FREE_LIMITS['todos_per_day']} کار در هر روز می‌توانید ثبت کنید.",
            "habits": f"در نسخهٔ رایگان حداکثر {settings.FREE_LIMITS['habits']} عادت می‌توانید داشته باشید."}
    return fail("limit_" + kind, msgs[kind] + " برای حذف محدودیت، پرو را فعال کنید.", 402)


def clean_weekdays(value):
    try:
        days = sorted({int(x) for x in value})
    except (TypeError, ValueError):
        return None
    return "".join(map(str, days)) if days and all(0 <= d <= 6 for d in days) else None


# ---------- احراز هویت ----------
@api(("POST",), auth=False)
def register(request):
    if throttled(f"reg:{client_ip(request)}", 10, 3600):
        return fail("throttled", "تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره امتحان کنید.", 429)
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    if not USERNAME_RE.match(username):
        return fail("bad_username", "نام کاربری باید ۳ تا ۳۰ حرف انگلیسی، عدد، نقطه یا زیرخط باشد.")
    if User.objects.filter(username__iexact=username).exists():
        return fail("username_taken", "این نام کاربری قبلاً گرفته شده است.", 409)
    try:
        validate_password(password, User(username=username))
    except ValidationError as e:
        return fail("weak_password", " ".join(e.messages))
    user = User.objects.create_user(username=username, password=password)
    resp = JsonResponse(me_payload(user), status=201)
    set_auth_cookie(resp, issue_token(user))
    return resp


@api(("POST",), auth=False)
def login(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    if throttled(f"login:{client_ip(request)}:{username.lower()}", 8, 900):
        return fail("throttled", "تلاش‌های ناموفق زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کنید.", 429)
    user = authenticate(request, username=username, password=password)
    if not user:
        return fail("bad_credentials", "نام کاربری یا رمز عبور اشتباه است.", 401)
    resp = JsonResponse(me_payload(user))
    set_auth_cookie(resp, issue_token(user))
    return resp


@api(("POST",), auth=False)
def logout(request):
    from .api import _hash
    raw = request.COOKIES.get(settings.AUTH_COOKIE)
    if raw:
        AuthToken.objects.filter(key_hash=_hash(raw)).delete()
    resp = JsonResponse({"ok": True})
    clear_auth_cookie(resp)
    return resp


@api(("GET",))
def me(request):
    return JsonResponse(me_payload(request.api_user))


@api(("PATCH",))
def update_settings(request):
    p, d = profile_of(request.api_user), request.data
    try:
        if "water_goal" in d:
            p.water_goal = min(30, max(1, int(d["water_goal"])))
        if "glass_ml" in d and int(d["glass_ml"]) in (150, 200, 250, 300, 500):
            p.glass_ml = int(d["glass_ml"])
        if "sleep_goal" in d:
            p.sleep_goal = min(14.0, max(4.0, float(d["sleep_goal"])))
    except (TypeError, ValueError):
        return fail("bad_value")
    p.save()
    return JsonResponse(me_payload(request.api_user))


# ---------- داده‌ها ----------
@api(("GET",))
def days(request):
    a, b = parse_date(request.GET.get("from")), parse_date(request.GET.get("to"))
    if not a or not b or b < a or (b - a).days > 400:
        return fail("bad_range")
    u, out = request.api_user, {}

    def day(k):
        return out.setdefault(k.isoformat(), {"note": "", "bed": "", "wake": "", "q": 0, "water": 0,
                                              "todos": [], "blocks": [], "checks": []})
    for e in DayEntry.objects.filter(user=u, date__range=(a, b)):
        day(e.date).update(note=e.note, bed=e.sleep_bed, wake=e.sleep_wake, q=e.sleep_quality, water=e.water)
    for t in Todo.objects.filter(user=u, date__range=(a, b)):
        day(t.date)["todos"].append(ser_todo(t))
    for k in Block.objects.filter(user=u, date__range=(a, b)).order_by("start_min"):
        day(k.date)["blocks"].append(ser_block(k))
    for c in HabitCheck.objects.filter(habit__user=u, date__range=(a, b)):
        day(c.date)["checks"].append(c.habit_id)
    return JsonResponse({"habits": [ser_habit(h) for h in Habit.objects.filter(user=u)], "days": out})


@api(("POST",))
def todo_create(request):
    u, d = request.api_user, request.data
    day, title = parse_date(d.get("date")), str(d.get("title", "")).strip()[:200]
    if not day or not title:
        return fail("bad_value", "عنوان کار را بنویسید.")
    limit = settings.FREE_LIMITS["todos_per_day"]
    if not profile_of(u).is_pro and Todo.objects.filter(user=u, date=day).count() >= limit:
        return limit_error("todos")
    t = Todo.objects.create(user=u, date=day, title=title, position=Todo.objects.filter(user=u, date=day).count())
    return JsonResponse(ser_todo(t), status=201)


@api(("PATCH", "DELETE"))
def todo_item(request, pk):
    t = get_object_or_404(Todo, pk=pk, user=request.api_user)
    if request.method == "DELETE":
        t.delete()
        return JsonResponse({"ok": True})
    if "done" in request.data:
        t.done = bool(request.data["done"])
    if "title" in request.data and str(request.data["title"]).strip():
        t.title = str(request.data["title"]).strip()[:200]
    t.save()
    return JsonResponse(ser_todo(t))


@api(("POST",))
def todos_clear_done(request):
    day = parse_date(request.data.get("date"))
    if not day:
        return fail("bad_value")
    Todo.objects.filter(user=request.api_user, date=day, done=True).delete()
    return JsonResponse({"ok": True})


@api(("POST",))
def habit_create(request):
    u, d = request.api_user, request.data
    name, wd = str(d.get("name", "")).strip()[:100], clean_weekdays(d.get("weekdays", [0, 1, 2, 3, 4, 5, 6]))
    start = parse_date(d.get("start"))
    if not name or not wd or not start:
        return fail("bad_value", "نام و روزهای تکرار عادت را بررسی کنید.")
    if not profile_of(u).is_pro and Habit.objects.filter(user=u, end_date__isnull=True).count() >= settings.FREE_LIMITS["habits"]:
        return limit_error("habits")
    h = Habit.objects.create(user=u, name=name, weekdays=wd, start_date=week_start(start),
                             color=int(d.get("color", Habit.objects.filter(user=u).count())) % 5,
                             position=Habit.objects.filter(user=u).count())
    return JsonResponse(ser_habit(h), status=201)


@api(("PATCH", "DELETE"))
def habit_item(request, pk):
    h, d = get_object_or_404(Habit, pk=pk, user=request.api_user), request.data
    if request.method == "DELETE":
        h.delete()
        return JsonResponse({"ok": True})
    if str(d.get("name", "")).strip():
        h.name = str(d["name"]).strip()[:100]
    if "color" in d:
        h.color = int(d["color"]) % 5
    if "weekdays" in d:
        wd = clean_weekdays(d["weekdays"])
        if not wd:
            return fail("bad_value", "حداقل یک روز لازم است.")
        h.weekdays = wd
    if "end" in d:
        end = parse_date(d["end"]) if d["end"] else None
        if end is None and h.end_date is not None and not profile_of(request.api_user).is_pro:
            if Habit.objects.filter(user=request.api_user, end_date__isnull=True).count() >= settings.FREE_LIMITS["habits"]:
                return limit_error("habits")
        h.end_date = end
    if "position" in d:
        h.position = max(0, int(d["position"]))
    h.save()
    return JsonResponse(ser_habit(h))


@api(("POST",))
def habit_check(request, pk):
    h, day = get_object_or_404(Habit, pk=pk, user=request.api_user), parse_date(request.data.get("date"))
    if not day:
        return fail("bad_value")
    if request.data.get("done"):
        HabitCheck.objects.get_or_create(habit=h, date=day)
        if day < h.start_date:
            h.start_date = week_start(day)
            h.save(update_fields=["start_date"])
    else:
        HabitCheck.objects.filter(habit=h, date=day).delete()
    return JsonResponse({"ok": True, "start": h.start_date.isoformat()})


@api(("POST",))
def block_create(request):
    u, d = request.api_user, request.data
    day, title = parse_date(d.get("date")), str(d.get("title", "")).strip()[:120]
    try:
        s, e = int(d.get("start")), int(d.get("end"))
    except (TypeError, ValueError):
        return fail("bad_value")
    if not day or not title or not (0 <= s < e <= 1440):
        return fail("bad_value", "عنوان و بازهٔ زمانی را درست وارد کنید (پایان بعد از شروع).")
    b = Block.objects.create(user=u, date=day, title=title, start_min=s, end_min=e, color=int(d.get("color", 0)) % 5)
    return JsonResponse(ser_block(b), status=201)


@api(("DELETE",))
def block_item(request, pk):
    get_object_or_404(Block, pk=pk, user=request.api_user).delete()
    return JsonResponse({"ok": True})


@api(("PUT",))
def day_entry(request, day):
    day_d, d = parse_date(day), request.data
    if not day_d:
        return fail("bad_value")
    e, _ = DayEntry.objects.get_or_create(user=request.api_user, date=day_d)
    try:
        if "note" in d:
            e.note = str(d["note"])[:5000]
        for key, field in (("bed", "sleep_bed"), ("wake", "sleep_wake")):
            if key in d:
                v = str(d[key] or "")
                if v and not TIME_RE.match(v):
                    return fail("bad_value", "ساعت نامعتبر است.")
                setattr(e, field, v)
        if "q" in d:
            e.sleep_quality = min(5, max(0, int(d["q"])))
        if "water" in d:
            e.water = min(60, max(0, int(d["water"])))
    except (TypeError, ValueError):
        return fail("bad_value")
    e.save()
    return JsonResponse({"ok": True})


@api(("POST",))
def copy_week(request):
    u, d = request.api_user, request.data
    ws = parse_date(d.get("week_start"))
    if not ws:
        return fail("bad_value")
    pro, limit = profile_of(u).is_pro, settings.FREE_LIMITS["todos_per_day"]
    res = {"todos": 0, "blocks": 0, "notes": 0, "skipped_todos": 0}
    with transaction.atomic():
        for i in range(7):
            src, dst = ws - timedelta(days=7 - i), ws + timedelta(days=i)
            if d.get("todos", True):
                have = list(Todo.objects.filter(user=u, date=dst).values_list("title", flat=True))
                for t in Todo.objects.filter(user=u, date=src):
                    if t.title in have:
                        continue
                    if not pro and len(have) >= limit:
                        res["skipped_todos"] += 1
                        continue
                    Todo.objects.create(user=u, date=dst, title=t.title, position=len(have))
                    have.append(t.title)
                    res["todos"] += 1
            if d.get("blocks", True):
                have_b = {(b.title, b.start_min, b.end_min) for b in Block.objects.filter(user=u, date=dst)}
                for b in Block.objects.filter(user=u, date=src):
                    if (b.title, b.start_min, b.end_min) not in have_b:
                        Block.objects.create(user=u, date=dst, title=b.title, start_min=b.start_min,
                                             end_min=b.end_min, color=b.color)
                        res["blocks"] += 1
            if d.get("notes", False):
                s_e = DayEntry.objects.filter(user=u, date=src).first()
                if s_e and s_e.note:
                    de, _ = DayEntry.objects.get_or_create(user=u, date=dst)
                    if not de.note:
                        de.note = s_e.note
                        de.save()
                        res["notes"] += 1
    return JsonResponse(res)


# ---------- پرداخت کارت‌به‌کارت ----------
def _sniff(head):
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return None


def ser_payment(p):
    return {"id": p.id, "plan": p.plan_key, "amount": p.amount, "status": p.status,
            "created": p.created.isoformat(), "admin_note": p.admin_note}


@api(("GET",))
def billing(request):
    b = settings.BILLING
    return JsonResponse({
        "card": {"number": b["card_number"], "holder": b["card_holder"], "bank": b["bank"]},
        "plans": [{"id": k, "title": v["title"], "price": v["price"], "days": v["days"]} for k, v in b["plans"].items()],
        "payments": [ser_payment(p) for p in Payment.objects.filter(user=request.api_user)[:10]],
        "limits": settings.FREE_LIMITS,
    })


@api(("POST",))
def payment_create(request):
    u, d = request.api_user, request.data
    plan = settings.BILLING["plans"].get(str(d.get("plan", "")))
    f = request.FILES.get("receipt")
    if not plan:
        return fail("bad_plan", "پلن نامعتبر است.")
    if not f:
        return fail("no_receipt", "عکس رسید را انتخاب کنید.")
    if f.size > 5 * 1024 * 1024:
        return fail("too_big", "حجم عکس باید کمتر از ۵ مگابایت باشد.")
    head = f.read(16)
    f.seek(0)
    ext = _sniff(head)
    if not ext:
        return fail("bad_image", "فقط عکس JPG، PNG یا WEBP قابل قبول است.")
    if Payment.objects.filter(user=u, status="pending").exists():
        return fail("pending_exists", "یک رسید در انتظار بررسی دارید؛ لطفاً تا تأیید آن صبر کنید.", 409)
    if throttled(f"pay:{u.id}", 5, 86400):
        return fail("throttled", "تعداد ارسال امروز زیاد بود.", 429)
    f.name = f"receipt.{ext}"
    p = Payment.objects.create(user=u, plan_key=str(d.get("plan")), amount=plan["price"], receipt=f,
                               note=str(d.get("note", ""))[:300])
    return JsonResponse(ser_payment(p), status=201)


@staff_member_required
def receipt_file(request, pk):
    """رسید فقط برای ادمین (کاربر staff واردشده) قابل مشاهده است."""
    p = get_object_or_404(Payment, pk=pk)
    try:
        fh = p.receipt.open("rb")
    except FileNotFoundError:
        raise Http404
    ext = p.receipt.name.rsplit(".", 1)[-1].lower()
    resp = FileResponse(fh, content_type={"png": "image/png", "webp": "image/webp"}.get(ext, "image/jpeg"))
    resp["Cache-Control"] = "private, no-store"
    return resp


# ---------- پشتیبانی ----------
def ser_msg(m):
    return {"id": m.id, "from_staff": m.from_staff, "text": m.text, "created": m.created.isoformat()}


@api(("GET", "POST"))
def support_messages(request):
    u = request.api_user
    if request.method == "POST":
        text = str(request.data.get("text", "")).strip()[:2000]
        if not text:
            return fail("bad_value")
        if throttled(f"chat:{u.id}", 20, 600):
            return fail("throttled", "پیام‌ها زیاد بود؛ کمی بعد دوباره بفرستید.", 429)
        return JsonResponse(ser_msg(SupportMessage.objects.create(user=u, text=text)), status=201)
    try:
        after = int(request.GET.get("after", 0))
    except ValueError:
        after = 0
    qs = SupportMessage.objects.filter(user=u, id__gt=after)
    msgs = list(qs.order_by("-id")[:100][::-1]) if after == 0 else list(qs[:200])
    SupportMessage.objects.filter(user=u, from_staff=True, read=False).update(read=True)
    return JsonResponse({"messages": [ser_msg(m) for m in msgs]})
