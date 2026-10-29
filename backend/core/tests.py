"""تست‌های پایه (اجرا: python manage.py test). توجه: این تست‌ها در محیط ساخت اجرا نشده‌اند."""
import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.utils import timezone

from .api import profile_of

H = {"HTTP_X_REQUESTED_WITH": "plannuma"}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200
TODAY = timezone.localdate().isoformat()


def post(c, path, data):
    return c.post("/api" + path, data=json.dumps(data), content_type="application/json", **H)


class ApiTests(TestCase):
    def user_client(self, name="ali_1"):
        c = Client()
        r = post(c, "/auth/register", {"username": name, "password": "Str0ng!pass42"})
        self.assertEqual(r.status_code, 201)
        return c

    def test_login_persists_and_requires_cookie(self):
        c = self.user_client()
        self.assertEqual(c.get("/api/me").status_code, 200)
        self.assertEqual(Client().get("/api/me").status_code, 401)

    def test_csrf_header_required(self):
        r = Client().post("/api/auth/login", data="{}", content_type="application/json")
        self.assertEqual(r.status_code, 403)

    def test_duplicate_username_case_insensitive(self):
        self.user_client("Sara")
        r = post(Client(), "/auth/register", {"username": "sara", "password": "Str0ng!pass42"})
        self.assertEqual(r.status_code, 409)

    def test_free_limits(self):
        c = self.user_client()
        for i in range(3):
            self.assertEqual(post(c, "/todos", {"date": TODAY, "title": f"t{i}"}).status_code, 201)
            self.assertEqual(post(c, "/habits", {"name": f"h{i}", "start": TODAY}).status_code, 201)
        self.assertEqual(post(c, "/todos", {"date": TODAY, "title": "x"}).status_code, 402)
        self.assertEqual(post(c, "/habits", {"name": "x", "start": TODAY}).status_code, 402)

    def test_pro_removes_limits(self):
        c = self.user_client()
        p = profile_of(User.objects.get(username="ali_1"))
        p.plan, p.pro_until = "pro", timezone.now() + timedelta(days=30)
        p.save()
        for i in range(5):
            self.assertEqual(post(c, "/todos", {"date": TODAY, "title": f"t{i}"}).status_code, 201)

    def test_payment_flow(self):
        c = self.user_client()
        bad = c.post("/api/billing/payments", {"plan": "monthly", "receipt": SimpleUploadedFile("a.txt", b"hello")}, **H)
        self.assertEqual(bad.status_code, 400)
        ok = c.post("/api/billing/payments", {"plan": "monthly", "receipt": SimpleUploadedFile("r.png", PNG)}, **H)
        self.assertEqual(ok.status_code, 201)
        again = c.post("/api/billing/payments", {"plan": "monthly", "receipt": SimpleUploadedFile("r.png", PNG)}, **H)
        self.assertEqual(again.status_code, 409)
