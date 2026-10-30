import base64

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "ساخت کلید VAPID برای اعلان‌های وب؛ خروجی را در .env بگذارید."

    def handle(self, *args, **opts):
        from cryptography.hazmat.primitives import serialization
        from py_vapid import Vapid

        v = Vapid()
        v.generate_keys()
        b64 = lambda x: base64.urlsafe_b64encode(x).rstrip(b"=").decode()
        priv = b64(v.private_key.private_numbers().private_value.to_bytes(32, "big"))
        pub = b64(v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
        self.stdout.write(f"VAPID_PRIVATE_KEY={priv}\nVAPID_PUBLIC_KEY={pub}\nVAPID_SUBJECT=mailto:you@example.com")
