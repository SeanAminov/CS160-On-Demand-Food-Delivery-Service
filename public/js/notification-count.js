// Keeps the unread number next to Notifications in the header up to date.
// The header and the Notifications page both use this.

export async function refreshNotificationCount() {
  const badge = document.getElementById('notification-count');
  if (!badge) return;

  try {
    const response = await fetch('/notifications');
    if (!response.ok) {
      badge.hidden = true;
      return;
    }
    const notifications = await response.json();
    const unread = notifications.filter((notification) => !notification.is_read).length;
    badge.textContent = String(unread);
    badge.hidden = unread === 0;
  } catch {
    badge.hidden = true;
  }
}
