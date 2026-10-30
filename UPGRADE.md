# ارتقا از نسخهٔ قبلی (که الان روی سیستم شما کار می‌کند)

> فایل‌های این بسته را **روی** پروژهٔ فعلی کپی کنید (Overwrite). این‌ها را حذف یا جایگزین نکنید:
> `backend/.env`، `backend/db.sqlite3`، `backend/private_media/`، `backend/core/migrations/0001_*.py`، `frontend/.env.local`، `node_modules`.
> (در zip هیچ‌کدام از این‌ها نیست، پس با کپی معمولی از بین نمی‌روند.)

## ۱) بک‌اند
```bash
cd backend
source .venv/bin/activate            # ویندوز: .venv\Scripts\Activate.ps1
pip install -r requirements.txt      # pywebpush اضافه شده
```
به `backend/.env` موارد جدید `.env.example` را اضافه کنید (حداقل: `TELEGRAM_BOT_TOKEN` و `TELEGRAM_CHAT_ID`).
```bash
python manage.py makemigrations core
python manage.py migrate
python manage.py generate_vapid      # خروجی را در .env بگذارید (برای یادآوری عادت‌ها)
python manage.py test                # اختیاری ولی توصیه می‌شود
python manage.py runserver
```

## ۲) فرانت
```bash
cd frontend
# موارد جدید .env.example را به .env.local اضافه کنید
npm install                          # فونت وزیرمتن همین‌جا از بستهٔ npm کپی می‌شود (postinstall)
npm run dev
```
> اگر `npm install` برای بستهٔ `vazirmatn` خطا داد، متن خطا را بفرستید؛ سایت بدون آن هم کار می‌کند و از فونت سیستم استفاده می‌کند.

## ۳) کارهای زمان‌بندی‌شده (cron) در سرور
```cron
* * * * *  cd /path/backend && .venv/bin/python manage.py send_reminders      # یادآوری عادت‌ها
0 8 * * 6  cd /path/backend && .venv/bin/python manage.py weekly_report      # گزارش هفتگی پرو (شنبه‌ها)
30 3 * * * cd /path/backend && .venv/bin/python manage.py backup --keep 14    # پشتیبان‌گیری شبانه
```

## ۴) راه‌اندازی اعلان به ادمین (تلگرام)
1. در تلگرام به @BotFather پیام بدهید، `/newbot` را بزنید و توکن بگیرید.
2. به ربات خودتان یک پیام بدهید، سپس `https://api.telegram.org/bot<TOKEN>/getUpdates` را باز کنید و `chat.id` را بردارید.
3. هر دو را در `backend/.env` بگذارید. اگر سرور به تلگرام دسترسی ندارد، `NOTIFY_WEBHOOK_URL` یا `TELEGRAM_API_BASE` (مثلاً سرویس سازگار مثل بله) را تنظیم کنید و حتماً مستندات همان سرویس را بررسی کنید.
