"""اعلان به ادمین (تلگرام/بله/وب‌هوک). ارسال در پس‌زمینه است و هیچ‌وقت خطا به کاربر نمی‌دهد."""
import json
import logging
import threading
import urllib.request

from django.conf import settings
from django.core.cache import cache

log = logging.getLogger(__name__)


def _post(url, payload):
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=8).read()


def _send(text):
    n = settings.NOTIFY
    try:
        if n["telegram_token"] and n["telegram_chat"]:
            _post(f"{n['telegram_api'].rstrip('/')}/bot{n['telegram_token']}/sendMessage",
                  {"chat_id": n["telegram_chat"], "text": text, "disable_web_page_preview": True})
        if n["webhook"]:
            _post(n["webhook"], {"text": text})
    except Exception as e:  # noqa: BLE001
        log.warning("notify failed: %s", e)


def notify(text, key=None, cooldown=0):
    """key+cooldown: جلوگیری از ارسال پیاپی برای یک موضوع (ثانیه)."""
    n = settings.NOTIFY
    if not (n["telegram_token"] and n["telegram_chat"]) and not n["webhook"]:
        return
    if key and cooldown and not cache.add(f"notify:{key}", 1, cooldown):
        return
    threading.Thread(target=_send, args=(text,), daemon=True).start()
