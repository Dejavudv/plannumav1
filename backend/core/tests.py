"""تست‌های پایه (اجرا: python manage.py test). توجه: این تست‌ها در محیط ساخت اجرا نشده‌اند."""
import json
from datetime import timedelta
from django.core.cache import cache
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.utils import timezone

from .api import profile_of
from .models import Coupon, Todo

H = {"HTTP_X_REQUESTED_WITH": "plannuma"}
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200
TODAY = timezone.localdate().isoformat()


def post(c, path, data):
    return c.post("/api" + path, data=json.dumps(data), content_type="application/json", **H)


class ApiTests(TestCase):
    def setUp(self):
        cache.clear()
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

    def test_payment_flow_unique_amount(self):
        c = self.user_client()
        r = post(c, "/billing/requests", {"plan": "monthly"})
        self.assertEqual(r.status_code, 201)
        pid, amount = r.json()["id"], r.json()["amount"]
        self.assertGreater(amount, 99000 - 1)
        bad = c.post(f"/api/billing/requests/{pid}/receipt", {"receipt": SimpleUploadedFile("a.txt", b"hello")}, **H)
        self.assertEqual(bad.status_code, 400)
        ok = c.post(f"/api/billing/requests/{pid}/receipt", {"receipt": SimpleUploadedFile("r.png", PNG)}, **H)
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["status"], "pending")
        self.assertEqual(post(c, "/billing/requests", {"plan": "monthly"}).status_code, 409)

    def test_coupon(self):
        Coupon.objects.create(code="OFF10", percent=10)
        c = self.user_client()
        r = post(c, "/billing/coupon", {"plan": "monthly", "code": "off10"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["discount"], 9900)
        self.assertEqual(post(c, "/billing/coupon", {"plan": "monthly", "code": "nope"}).status_code, 400)

    def test_change_password_and_delete(self):
        c = self.user_client()
        self.assertEqual(post(c, "/auth/password", {"current": "wrong", "new": "An0ther!pass99"}).status_code, 400)
        self.assertEqual(post(c, "/auth/password", {"current": "Str0ng!pass42", "new": "An0ther!pass99"}).status_code, 200)
        self.assertEqual(post(c, "/auth/delete", {"password": "An0ther!pass99"}).status_code, 200)
        self.assertFalse(User.objects.filter(username="ali_1").exists())

    def test_backup_restore_respects_free_limit(self):
        c = self.user_client()
        data = {"app": "plannuma", "days": {TODAY: {"todos": [{"title": f"t{i}"} for i in range(5)]}},
                "habits": [{"name": f"h{i}", "checks": [TODAY]} for i in range(5)]}
        r = post(c, "/restore", data)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Todo.objects.count(), 3)
        self.assertEqual(r.json()["habits"], 3)
        self.assertEqual(c.get("/api/backup").status_code, 200)

    def test_recurring_materializes(self):
        c = self.user_client()
        r = post(c, "/recurring", {"title": "ورزش", "weekdays": [0, 1, 2, 3, 4, 5, 6], "start": TODAY})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(post(c, "/recurring", {"title": "x", "weekdays": [0], "start": TODAY}).status_code, 402)
        c.get(f"/api/days?from={TODAY}&to={TODAY}")
        self.assertEqual(Todo.objects.filter(date=TODAY, title="ورزش").count(), 1)

    def test_move_todo_to_full_day_is_blocked(self):
        c = self.user_client()
        other = (timezone.localdate() + timedelta(days=1)).isoformat()
        for i in range(3):
            post(c, "/todos", {"date": other, "title": f"o{i}"})
        tid = post(c, "/todos", {"date": TODAY, "title": "m"}).json()["id"]
        r = c.patch(f"/api/todos/{tid}", data=json.dumps({"date": other}), content_type="application/json", **H)
        self.assertEqual(r.status_code, 402)

