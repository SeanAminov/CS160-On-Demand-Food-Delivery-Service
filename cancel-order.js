const Stripe = require('stripe');
const pool = require('./db');
const { notifyUser, statusMessage } = require('./notify');

// Stripe test mode, the same as checkout. Without the keys, payments are practice ones.
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Gives the money for an order back through Stripe and returns the refund ID.
// Practice payments and orders from before Stripe was hooked up have made up
// payment IDs, so there's nothing to send back to Stripe for those.
async function refundOrder(conn, orderId) {
  const [payments] = await conn.query(
    "SELECT stripe_transaction_id FROM Transactions WHERE order_id = ? AND payment_status = 'succeeded'",
    [orderId]
  );
  if (payments.length > 0 && payments[0].stripe_transaction_id.startsWith('pi_')) {
    if (!stripe) {
      throw new Error('Stripe keys are missing from .env, so the refund could not be sent.');
    }
    const refund = await stripe.refunds.create({ payment_intent: payments[0].stripe_transaction_id });
    return refund.id;
  }
  return 're_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Cancels an order: puts its items back in stock, refunds it, saves the refund, and
// lets the customer know. It only cancels the order if its status is still one of
// cancellableStatuses, and gives back false if it isn't, like when a robot just took it.
// Managers cancelling an order and deleting an account both use this.
async function cancelOrder(orderId, cancellableStatuses) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE keeps anyone else from changing the order until this is done
    const [orders] = await conn.query(
      'SELECT user_id, status, total_price FROM Orders WHERE order_id = ? FOR UPDATE',
      [orderId]
    );
    if (orders.length === 0 || !cancellableStatuses.includes(orders[0].status)) {
      await conn.rollback();
      return false;
    }
    const order = orders[0];

    const [items] = await conn.query('SELECT product_id, quantity FROM OrderItems WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await conn.query('UPDATE Inventory SET quantity = quantity + ? WHERE product_id = ?', [
        item.quantity, item.product_id
      ]);
    }

    await conn.query("UPDATE Orders SET status = 'Cancelled' WHERE order_id = ?", [orderId]);

    const refundId = await refundOrder(conn, orderId);
    await conn.query(`
      INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status)
      VALUES (?, ?, ?, 'refunded')
    `, [orderId, refundId, order.total_price]);

    await notifyUser(conn, order.user_id, statusMessage(orderId, 'Cancelled'), { orderId, link: '#/orders' });

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { cancelOrder };
