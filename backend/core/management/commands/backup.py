import os
import shutil
import sqlite3
import subprocess
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "پشتیبان‌گیری از دیتابیس و رسیدها (با cron اجرا شود): 30 3 * * * python manage.py backup --keep 14"

    def add_arguments(self, parser):
        parser.add_argument("--keep", type=int, default=14, help="تعداد نسخهٔ نگه‌داشته‌شده از هر نوع")
        parser.add_argument("--dir", default=str(settings.BACKUP_DIR))

    def handle(self, *args, **o):
        out = Path(o["dir"])
        out.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        db = settings.DATABASES["default"]
        if db["ENGINE"].endswith("sqlite3"):
            src, dst = sqlite3.connect(str(db["NAME"])), sqlite3.connect(str(out / f"db-{stamp}.sqlite3"))
            with dst:
                src.backup(dst)
            src.close(); dst.close()
        elif "postgresql" in db["ENGINE"]:
            env = dict(os.environ, PGPASSWORD=db.get("PASSWORD", ""))
            r = subprocess.run(["pg_dump", "-h", db.get("HOST") or "localhost", "-p", str(db.get("PORT") or 5432), "-U", db["USER"], "-d", db["NAME"], "-f", str(out / f"db-{stamp}.sql")], env=env)
            if r.returncode:
                raise CommandError("pg_dump ناموفق بود.")
        else:
            raise CommandError("موتور دیتابیس پشتیبانی نمی‌شود.")
        media = Path(settings.PRIVATE_MEDIA_ROOT)
        if media.exists():
            shutil.make_archive(str(out / f"receipts-{stamp}"), "zip", str(media))
        for prefix in ("db-", "receipts-"):
            files = sorted(out.glob(prefix + "*"), key=lambda p: p.stat().st_mtime, reverse=True)
            for old in files[o["keep"]:]:
                old.unlink()
        self.stdout.write(self.style.SUCCESS(f"پشتیبان در {out} ذخیره شد."))
