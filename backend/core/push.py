"""ارسال اعلان وب (Web Push). اگر pywebpush یا کلیدهای VAPID نباشد، بی‌صدا چیزی ارسال نمی‌شود."""
import base64
import json
import logging

from django.conf import settings

log = logging.getLogger(__name__)


def _b64d(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def push_ready():
    return bool(settings.VAPID["private"] and settings.VAPID["public"])


def send_push(user, title, body, url="/dashboard"):
    if not push_ready():
        return 0
    try:
        from py_vapid import Vapid
        from pywebpush import WebPushException, webpush
    except ImportError:
        log.warning("pywebpush نصب نیست")
        return 0
    vapid = Vapid.from_raw(_b64d(settings.VAPID["private"]))
    sent = 0
    for sub in list(user.push_subs.all()):
        try:
            webpush(subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
                    data=json.dumps({"title": title, "body": body, "url": url}),
                    vapid_private_key=vapid, vapid_claims={"sub": settings.VAPID["subject"]})
            sent += 1
        except WebPushException as e:
            code = getattr(getattr(e, "response", None), "status_code", None)
            if code in (404, 410):
                sub.delete()
            else:
                log.warning("push failed: %s", e)
        except Exception as e:  # noqa: BLE001
            log.warning("push error: %s", e)
    return sent
