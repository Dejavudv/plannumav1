import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# بارگذاری ساده‌ی فایل .env (در صورت وجود)
_env_file = BASE_DIR / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())


def env(key, default=None):
    return os.environ.get(key, default)


DEBUG = env("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-change-me")
if not DEBUG and SECRET_KEY.startswith("dev-"):
    raise RuntimeError("در حالت تولید باید DJANGO_SECRET_KEY قوی تنظیم شود.")

ALLOWED_HOSTS = [h.strip() for h in env("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in env("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.humanize",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
APPEND_SLASH = False

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": [
        "django.template.context_processors.request",
        "django.contrib.auth.context_processors.auth",
        "django.contrib.messages.context_processors.messages",
    ]},
}]

if env("DB_ENGINE") == "postgres":
    DATABASES = {"default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("DB_NAME", "plannuma"),
        "USER": env("DB_USER", "plannuma"),
        "PASSWORD": env("DB_PASSWORD", ""),
        "HOST": env("DB_HOST", "localhost"),
        "PORT": env("DB_PORT", "5432"),
    }}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fa"
TIME_ZONE = "Asia/Tehran"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# رسیدهای پرداخت عمومی نیستند؛ فقط از طریق پنل ادمین دیده می‌شوند.
PRIVATE_MEDIA_ROOT = Path(env("PRIVATE_MEDIA_ROOT", str(BASE_DIR / "private_media")))
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024

# ورود ماندگار: توکن در کوکی HttpOnly یک‌ساله
AUTH_COOKIE = "pl_token"
AUTH_COOKIE_AGE = 60 * 60 * 24 * 365

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_CONTENT_TYPE_NOSNIFF = True

# محدودیت نسخهٔ رایگان
FREE_LIMITS = {"todos_per_day": 3, "habits": 3, "recurring": 1}

# پرداخت کارت‌به‌کارت (از متغیرهای محیطی قابل تغییر است)
BILLING = {
    "card_number": env("BILLING_CARD_NUMBER", "6037-0000-0000-0000"),
    "card_holder": env("BILLING_CARD_HOLDER", "نام صاحب کارت"),
    "bank": env("BILLING_BANK", "نام بانک"),
    "request_hours": 24,   # اعتبار درخواست پرداخت (مبلغ یکتا)
    "suffix_max": 199,     # حداکثر عدد یکتای اضافه‌شده به مبلغ (تومان)
    "plans": {
        "monthly": {"title": "اشتراک پرو یک‌ماهه", "price": int(env("PRICE_MONTHLY", "99000")), "days": 30},
        "yearly": {"title": "اشتراک پرو یک‌ساله", "price": int(env("PRICE_YEARLY", "790000")), "days": 365},
    },
}


# ---------- اعلان به ادمین (تلگرام / بله / وب‌هوک) ----------
NOTIFY = {
    "telegram_token": env("TELEGRAM_BOT_TOKEN", ""),
    "telegram_chat": env("TELEGRAM_CHAT_ID", ""),
    # برای بله: https://tapi.bale.ai  (قبل از استفاده مستندات بله را بررسی کنید)
    "telegram_api": env("TELEGRAM_API_BASE", "https://api.telegram.org"),
    "webhook": env("NOTIFY_WEBHOOK_URL", ""),
    "admin_url": env("SITE_ADMIN_URL", "http://127.0.0.1:8000/admin/"),
    "on_signup": env("NOTIFY_ON_SIGNUP", "0") == "1",
}

# ---------- اعلان‌های وب (Web Push) ----------
VAPID = {
    "private": env("VAPID_PRIVATE_KEY", ""),
    "public": env("VAPID_PUBLIC_KEY", ""),
    "subject": env("VAPID_SUBJECT", "mailto:admin@example.com"),
}

BACKUP_DIR = Path(env("BACKUP_DIR", str(BASE_DIR / "backups")))

# ---------- کش (برای محدودیت تلاش؛ با چند worker از Redis استفاده کنید) ----------
if env("REDIS_URL"):
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": env("REDIS_URL")}}

# ---------- لاگ و پایش خطا ----------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}
if env("SENTRY_DSN"):
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=env("SENTRY_DSN"), send_default_pii=False, traces_sample_rate=0.0)
    except ImportError:
        pass
