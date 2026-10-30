// درج پاسخ آماده در اولین کادر پیام خالی گفتگوی پشتیبانی
document.addEventListener("click", function (e) {
  var b = e.target.closest("[data-qr]");
  if (!b) return;
  e.preventDefault();
  var areas = [].slice.call(document.querySelectorAll('textarea[name^="support_messages-"][name$="-text"]'));
  for (var i = areas.length - 1; i >= 0; i--) {
    if (!areas[i].value && areas[i].name.indexOf("__prefix__") < 0) {
      areas[i].value = b.getAttribute("data-qr");
      areas[i].focus();
      return;
    }
  }
});
