const express = require('express');
const pool = require('../db');
const { loginVerification, roleVerification } = require('../auth');
const { cancelOrder } = require('../cancel-order');
const router = express.Router();

// Deleting an account turns it off instead of removing it, so its past orders and
// payments stay in the records. Orders that haven't shipped are cancelled and refunded.
// An order that's out for delivery can't be called back, so it has to arrive first.
async function deleteAccount(userId) {
  const [openOrders] = await pool.query(`
    SELECT order_id, status
    FROM Orders
    WHERE user_id = ? AND status IN ('Pending', 'Preparing', 'Staged', 'Out for Delivery')
    ORDER BY order_id
  `, [userId]);

  const onTheWay = openOrders.find((order) => order.status === 'Out for Delivery');
  if (onTheWay) {
    return {
      status: 409,
      error: `Order #${onTheWay.order_id} is out for delivery right now. The account can be deleted after it arrives.`
    };
  }

  // Each order is cancelled on its own, so a refund that goes through is always saved with it
  const cancelled = [];
  for (const order of openOrders) {
    if (!(await cancelOrder(order.order_id, ['Pending', 'Preparing', 'Staged']))) {
      // It changed since we looked, most likely because a robot just took it
      return {
        status: 409,
        error: `Order #${order.order_id} just changed, so the account wasn't deleted. Please try again.`
      };
    }
    cancelled.push(order.order_id);
  }

  await pool.query('UPDATE Users SET active = FALSE WHERE user_id = ?', [userId]);
  return { cancelled };
}

// Logs someone out everywhere they're logged in, so a deleted account can't keep
// using a page it already had open
function endSessions(store, userId) {
  store.all((err, sessions) => {
    if (err || !sessions) return;
    for (const [sessionId, session] of Object.entries(sessions)) {
      if (session.user && session.user.user_id === userId) {
        store.destroy(sessionId, () => {});
      }
    }
  });
}

// DELETE /profile (Role: Customer, Employee, Manager)
// Deletes the account that's logged in
router.delete('/profile', loginVerification, async (req, res) => {
  const { user_id: userId, role } = req.session.user;
  try {
    // Someone has to be left to run the store
    if (role === 'manager') {
      const [managers] = await pool.query(
        "SELECT COUNT(*) AS count FROM Users WHERE role = 'manager' AND active = TRUE"
      );
      if (managers[0].count <= 1) {
        return res.status(409).json({ error: "You're the only manager, so this account can't be deleted." });
      }
    }

    const result = await deleteAccount(userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    endSessions(req.sessionStore, userId);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Your account was deleted.', cancelled_orders: result.cancelled });
    });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Could not delete the account. Please try again.' });
  }
});

// GET /users (Role: Manager)
// Every account for the Accounts page, with how many of its orders haven't shipped
// yet, so the manager knows what deleting it would cancel
router.get('/users', loginVerification, roleVerification('manager'), async (req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT
        u.user_id, u.name, u.email, u.role, u.active, u.created_at,
        (SELECT COUNT(*) FROM Orders AS o
          WHERE o.user_id = u.user_id AND o.status IN ('Pending', 'Preparing', 'Staged')) AS unshipped_orders,
        (SELECT COUNT(*) FROM Orders AS o
          WHERE o.user_id = u.user_id AND o.status = 'Out for Delivery') AS orders_on_the_way
      FROM Users AS u
      ORDER BY u.active DESC, u.name
    `);
    res.json(users.map((user) => ({ ...user, active: Boolean(user.active) })));
  } catch (err) {
    console.error('Accounts error:', err);
    res.status(500).json({ error: 'Could not load the accounts.' });
  }
});

// DELETE /users/:id (Role: Manager)
// Managers can delete customer and employee accounts here. A manager deletes their
// own account from My Account, and nobody can delete another manager's account.
router.delete('/users/:id', loginVerification, roleVerification('manager'), async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const [users] = await pool.query('SELECT name, role, active FROM Users WHERE user_id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    const user = users[0];
    if (user.role === 'manager') {
      return res.status(403).json({ error: 'Manager accounts can only be deleted by that manager, from My Account.' });
    }
    if (!user.active) {
      return res.status(409).json({ error: 'This account is already deleted.' });
    }

    const result = await deleteAccount(userId);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    endSessions(req.sessionStore, userId);
    res.json({ message: `${user.name}'s account was deleted.`, cancelled_orders: result.cancelled });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Could not delete the account. Please try again.' });
  }
});

module.exports = router;
