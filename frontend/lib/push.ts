import { api } from "./api";

const toBytes = (s: string) => {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function enablePush(vapidKey: string) {
  if (!pushSupported()) throw new Error("این مرورگر از اعلان پشتیبانی نمی‌کند. روی آیفون ابتدا برنامه را به صفحهٔ اصلی اضافه کنید.");
  if ((await Notification.requestPermission()) !== "granted") throw new Error("اجازهٔ اعلان داده نشد.");
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(vapidKey) as any });
  const j = sub.toJSON();
  await api("/push/subscribe", { body: { endpoint: j.endpoint, keys: j.keys } });
}

export async function disablePush() {
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api("/push/unsubscribe", { body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); return; }
  }
  await api("/push/unsubscribe", { body: {} });
}
