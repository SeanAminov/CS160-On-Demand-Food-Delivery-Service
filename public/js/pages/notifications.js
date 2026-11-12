import { escapeHtml } from '../cart-api.js';
import { getUser } from '../user.js';
import { refreshNotificationCount } from '../notification-count.js';

export default {
  title: 'Notifications',

  async show(app) {
    if (!(await getUser())) {
      app.innerHTML = `
        <h1>Notifications</h1>
        <p class="muted">Please log in to see your notifications.</p>
        <a class="button primary" href="#/login">Log In</a>
      `;
      return;
    }

    let notifications;
    try {
      const response = await fetch('/notifications');
      if (!response.ok) throw new Error('Could not load notifications.');
      notifications = await response.json();
    } catch (err) {
      app.innerHTML = `<h1>Notifications</h1><p class="message">${err.message}</p>`;
      return;
    }

    if (notifications.length === 0) {
      app.innerHTML = `
        <h1>Notifications</h1>
        <p class="muted">You don't have any notifications yet.</p>
      `;
      return;
    }

    app.innerHTML = `
      <h1>Notifications</h1>
      <p class="muted">Newest first. Click one to go to that page.</p>
      <div class="notification-list">
        ${notifications.map((notification) => {
          const unread = !notification.is_read;
          const body = `
            ${unread ? '<span class="notification-new">New</span>' : ''}
            <span class="notification-message">${escapeHtml(notification.message)}</span>
            <span class="notification-time">${new Date(notification.created_at).toLocaleString()}</span>
          `;
          const classes = `notification-item${unread ? ' unread' : ''}`;
          return notification.link
            ? `<a class="${classes}" href="${escapeHtml(notification.link)}">${body}</a>`
            : `<div class="${classes}">${body}</div>`;
        }).join('')}
      </div>
    `;

    // Opening this page counts as seeing them, so the new ones get marked read.
    // They keep the New tag until the page is opened again.
    const unread = notifications.filter((notification) => !notification.is_read);
    await Promise.all(unread.map((notification) =>
      fetch(`/notifications/${notification.notification_id}/read`, { method: 'PUT' })
    ));
    refreshNotificationCount();
  },
};
