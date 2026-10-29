from django.contrib import admin
from django.urls import include, path

from core.views import receipt_file

admin.site.site_header = "پنل مدیریت پلنوما"
admin.site.site_title = "پلنوما"
admin.site.index_title = "مدیریت کاربران، پرداخت‌ها و پشتیبانی"

urlpatterns = [
    path("admin-files/receipt/<int:pk>", receipt_file),
    path("admin/", admin.site.urls),
    path("api/", include("core.urls")),
]
