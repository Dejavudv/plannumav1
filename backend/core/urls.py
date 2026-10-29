from django.urls import path

from . import views as v

urlpatterns = [
    path("auth/register", v.register),
    path("auth/login", v.login),
    path("auth/logout", v.logout),
    path("me", v.me),
    path("settings", v.update_settings),
    path("days", v.days),
    path("todos", v.todo_create),
    path("todos/clear-done", v.todos_clear_done),
    path("todos/<int:pk>", v.todo_item),
    path("habits", v.habit_create),
    path("habits/<int:pk>", v.habit_item),
    path("habits/<int:pk>/check", v.habit_check),
    path("blocks", v.block_create),
    path("blocks/<int:pk>", v.block_item),
    path("day/<str:day>", v.day_entry),
    path("copy-week", v.copy_week),
    path("billing", v.billing),
    path("billing/payments", v.payment_create),
    path("support/messages", v.support_messages),
]
