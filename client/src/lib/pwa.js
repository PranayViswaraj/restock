// Installable app (PWA) + approval alerts. Free: no push service, only the
// browser Notification API while a Restock page is open.
import { isOn } from './features.js';

export async function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  try {
    if (isOn('pwa')) {
      await navigator.serviceWorker.register('/sw.js');
    } else {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* the app works fine without it */ }
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notificationsGranted = () => notificationsSupported() && Notification.permission === 'granted';

export async function askNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

/** Alert the owner that a purchase needs approval (only when the tab is in the background). */
export async function notifyApproval(purchase) {
  if (!isOn('pwa') || !notificationsGranted() || document.visibilityState === 'visible') return;
  const title = `Approve ${purchase.flag || ''} $${Number(purchase.total).toFixed(2)}?`;
  const options = {
    body: `${purchase.quantity} × ${purchase.productName} from ${purchase.supplierName}. Guardian is waiting for you.`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `approve-${purchase.id}`,
    data: { url: `/approve/${purchase.id}` },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch { /* ignore */ }
}

/** Short haptic tap on phones that support it (Android Chrome). */
export function haptic(pattern = [12, 40, 18]) {
  if (!isOn('microInteractions')) return;
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}
