"""ابزارهای API: احراز هویت با توکن در کوکی HttpOnly، محافظت CSRF با هدر سفارشی، محدودیت تعداد درخواست."""
import hashlib
import json
import secrets
from datetime import date
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from .models import AuthToken, Profile


def fail(code, message="", status=400, **extra):
    return JsonResponse({"error": code, "message": message, **extra}, status=status)


def _hash(raw):
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_token(user):
    raw = secrets.token_urlsafe(32)
    AuthToken.objects.create(key_hash=_hash(raw), user=user)
    return raw


def set_auth_cookie(response, raw):
    response.set_cookie(settings.AUTH_COOKIE, raw, max_age=settings.AUTH_COOKIE_AGE,
                        httponly=True, samesite="Lax", secure=not settings.DEBUG, path="/")


def clear_auth_cookie(response):
    response.delete_cookie(settings.AUTH_COOKIE, path="/")


def user_from_request(request):
    raw = request.COOKIES.get(settings.AUTH_COOKIE)
    if not raw:
        return None
    tok = AuthToken.objects.select_related("user").filter(key_hash=_hash(raw), user__is_active=True).first()
    if not tok:
        return None
    now = timezone.now()
    if (now - tok.last_used).total_seconds() > 3600:
        AuthToken.objects.filter(pk=tok.pk).update(last_used=now)
    return tok.user


def profile_of(user):
    return Profile.objects.get_or_create(user=user)[0]


def client_ip(request):
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return (fwd.split(",")[0].strip() if fwd else "") or request.META.get("REMOTE_ADDR", "?")


def throttled(key, limit, window):
    cache.add(key, 0, window)
    try:
        n = cache.incr(key)
    except ValueError:
        cache.set(key, 1, window)
        n = 1
    return n > limit


def parse_date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def api(methods=("GET",), auth=True):
    """دکوراتور: متد، احراز هویت، هدر ضدّ CSRF (X-Requested-With) و پارس بدنهٔ JSON."""
    def deco(fn):
        @csrf_exempt
        @wraps(fn)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return fail("method_not_allowed", status=405)
            if request.method not in ("GET", "HEAD") and request.headers.get("X-Requested-With") != "plannuma":
                return fail("csrf", "درخواست نامعتبر است.", 403)
            request.api_user = None
            if auth:
                request.api_user = user_from_request(request)
                if not request.api_user:
                    return fail("unauthorized", "وارد حساب خود شوید.", 401)
            request.data = {}
            ctype = request.content_type or ""
            if ctype.startswith("application/json") and request.body:
                try:
                    data = json.loads(request.body)
                    request.data = data if isinstance(data, dict) else {}
                except ValueError:
                    return fail("bad_json", "قالب درخواست نامعتبر است.")
            elif ctype.startswith("multipart/"):
                request.data = request.POST
            return fn(request, *args, **kwargs)
        return wrapper
    return deco
