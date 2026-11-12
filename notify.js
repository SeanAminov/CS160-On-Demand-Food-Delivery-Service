// Saves notifications for the bell in the header. db can be the pool or a
// transaction's connection, so a notification only saves if the change it's
// about saves too.

// One notification for one user, like a customer whose order changed
async function notifyUser(db, userId, message, { orderId = null, link = null } = {}) {
  await db.query(
    'INSERT INTO Notifications (user_id, order_id, message, link) VALUES (?, ?, ?, ?)',
    [userId, orderId, message, link]
  );
}

// The same notification for everyone with one of these roles, like every employee
async function notifyRoles(db, roles, message, { orderId = null, link = null } = {}) {
  await db.query(`
    INSERT INTO Notifications (user_id, order_id, message, link)
    SELECT user_id, ?, ?, ? FROM Users WHERE role IN (?)
  `, [orderId, message, link, roles]);
}

// What a customer sees when their order moves to a new status
function statusMessage(orderId, status) {
  const messages = {
    'Preparing': `We're packing Order #${orderId} now.`,
    'Staged': `Order #${orderId} is packed and waiting for a robot.`,
    'Out for Delivery': `Order #${orderId} is out for delivery.`,
    'Delivered': `Order #${orderId} was delivered.`,
    'Failed': `We couldn't deliver Order #${orderId}. An employee will follow up.`,
    'Cancelled': `Order #${orderId} was cancelled and refunded.`,
  };
  return messages[status] || `Order #${orderId} is now ${status}.`;
}

module.exports = { notifyUser, notifyRoles, statusMessage };
