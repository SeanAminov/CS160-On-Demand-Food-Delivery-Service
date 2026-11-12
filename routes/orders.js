const express = require('express');
const pool = require('../db');
const { loginVerification, roleVerification } = require('../auth');
const { checkAddress } = require('../address');
const { notifyUser, notifyRoles, statusMessage } = require('../notify');
const Stripe = require('stripe');
const router = express.Router();

const TAX_RATE = process.env.TAX_RATE ? Number(process.env.TAX_RATE) : 0.09375;
const FREE_DELIVERY_LIMIT = 20;
const DELIVERY_FEE = 10;
// One robot carries up to 200 lbs, so one order can't weigh more than that
const MAX_CART_WEIGHT = 200;

// Stripe test mode. The secret key stays on the server in .env. If someone hasn't
// added it yet, the site still runs and checkout says what's missing.
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Gives the money for an order back through Stripe and returns the refund ID.
// Orders from before Stripe was hooked up have made up payment IDs, so there's
// nothing to send back to Stripe for those.
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

// Allowed state transitions per Section 5 of Part 2 specification
const ALLOWED_TRANSITIONS = {
  'Pending': ['Preparing', 'Cancelled'],
  'Preparing': ['Staged', 'Cancelled'],
  'Staged': ['Out for Delivery', 'Cancelled'],
  'Out for Delivery': ['Delivered', 'Failed'],
  'Delivered': [],
  'Failed': ['Cancelled'],
  'Cancelled': [],
  // A declined card was never charged, so there's nothing left to do with it
  'Declined': []
};

// GET /stripe-key
// The checkout page needs the publishable key to show Stripe's card box.
// It's fine for the browser to see this one. The secret key never leaves the server.
router.get('/stripe-key', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

// POST /checkout (Role: Customer)
// The browser sends a Stripe payment method ID (pm_...) instead of a card number.
// Stripe's card box turns the card into that ID, so card numbers never reach our server.
router.post('/checkout', loginVerification, async (req, res) => {
  const userId = req.session.user.user_id;
  // delivery_address has the address boxes from the page: street, unit, city, state, and zip
  const { delivery_address, payment_method_id, expected_total } = req.body || {};

  // Validate the address and the Downtown San Jose service area
  const location = await checkAddress(delivery_address);
  if (location.error) {
    return res.status(location.status).json({ error: location.error });
  }

  if (typeof payment_method_id !== 'string' || !payment_method_id.startsWith('pm_')) {
    return res.status(400).json({ error: 'Please enter your card details.' });
  }
  if (!stripe) {
    return res.status(500).json({ error: 'Payments are not set up on this server yet. Add the Stripe keys to .env.' });
  }

  // Retrieve user's cart
  const [cartRows] = await pool.query('SELECT cart_id FROM Carts WHERE user_id = ?', [userId]);
  if (cartRows.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }
  const cartId = cartRows[0].cart_id;

  const [items] = await pool.query(`
    SELECT ci.cart_item_id, ci.product_id, ci.quantity,
           p.name, p.price, p.weight, i.quantity AS stock
    FROM CartItems AS ci
    JOIN Products AS p ON ci.product_id = p.product_id
    JOIN Inventory AS i ON p.product_id = i.product_id
    WHERE ci.cart_id = ?
    ORDER BY ci.cart_item_id
  `, [cartId]);

  if (items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Calculate pricing & weights
  let subtotal = 0;
  let totalWeight = 0;
  for (const item of items) {
    item.price = Number(item.price);
    item.weight = Number(item.weight);
    subtotal += item.price * item.quantity;
    totalWeight += item.weight * item.quantity;
  }

  const deliveryFee = (items.length > 0 && totalWeight >= FREE_DELIVERY_LIMIT) ? DELIVERY_FEE : 0;
  const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
  const totalPrice = Number((subtotal + deliveryFee + taxAmount).toFixed(2));
  totalWeight = Number(totalWeight.toFixed(2));
  subtotal = Number(subtotal.toFixed(2));

  // The cart pages stop this, but a manager may have made something heavier since it was added
  if (totalWeight > MAX_CART_WEIGHT) {
    return res.status(409).json({
      error: `Your cart weighs ${totalWeight} lb, and one order can't go over ${MAX_CART_WEIGHT} lb since that's all one robot can carry. Please remove some items from your cart.`
    });
  }

  // A manager may have changed a price or weight since the customer opened checkout.
  // Never charge a different amount than the page showed them.
  if (expected_total !== undefined && Number(expected_total) !== totalPrice) {
    return res.status(409).json({
      error: 'The total changed since you opened this page. Please check the new total and enter your card again.'
    });
  }

  const conn = await pool.getConnection();
  let payment = null;
  try {
    await conn.beginTransaction();

    // Verify stock availability with row-level locks.
    // This happens before the charge, so nobody pays for something we're out of.
    const stockBefore = {};
    for (const item of items) {
      const [inv] = await conn.query(
        'SELECT quantity, reorder_level FROM Inventory WHERE product_id = ? FOR UPDATE',
        [item.product_id]
      );
      if (inv.length === 0 || inv[0].quantity < item.quantity) {
        await conn.rollback();
        return res.status(409).json({
          error: `Insufficient stock for "${item.name}". Only ${inv.length > 0 ? inv[0].quantity : 0} available.`
        });
      }
      stockBefore[item.product_id] = inv[0];
    }

    // Charge the card through Stripe. The amount comes from our database, not the browser.
    try {
      payment = await stripe.paymentIntents.create({
        amount: Math.round(totalPrice * 100),
        currency: 'usd',
        payment_method: payment_method_id,
        confirm: true,
        // Card payments only, so nobody gets sent to another website to pay
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        description: `OFS order for user #${userId}`
      });
    } catch (err) {
      await conn.rollback();
      if (err.type !== 'StripeCardError') {
        console.error('Stripe error:', err.message);
        return res.status(502).json({ error: 'The payment could not go through. Please try again.' });
      }
      // Save the order as Declined with its items, so managers can see who tried and
      // what was in the cart. Nothing was charged, so stock and the cart stay the same.
      const failedTxId = err.payment_intent ? err.payment_intent.id : 'declined_' + Date.now().toString(36);
      await conn.beginTransaction();
      const [declinedRes] = await conn.query(`
        INSERT INTO Orders (
          user_id, subtotal, total_weight, delivery_fee, tax_amount, total_price,
          delivery_address, delivery_lat, delivery_lng, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Declined')
      `, [
        userId, subtotal, totalWeight, deliveryFee, taxAmount, totalPrice,
        location.address, location.lat, location.lng
      ]);
      const declinedOrderId = declinedRes.insertId;
      for (const item of items) {
        await conn.query(`
          INSERT INTO OrderItems (order_id, product_id, quantity, unit_price, unit_weight)
          VALUES (?, ?, ?, ?, ?)
        `, [declinedOrderId, item.product_id, item.quantity, item.price, item.weight]);
      }
      await conn.query(`
        INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status)
        VALUES (?, ?, ?, 'declined')
      `, [declinedOrderId, failedTxId, totalPrice]);
      await notifyUser(conn, userId, `Your card was declined for Order #${declinedOrderId}, so it wasn't placed. Nothing was charged.`, {
        orderId: declinedOrderId, link: '#/checkout'
      });
      await conn.commit();
      return res.status(402).json({ error: `${err.message} Your cart is unchanged.`, order_id: declinedOrderId });
    }

    // Some test cards ask for an extra check with the bank, which we don't support yet.
    // No money moves for those, so the payment just gets cancelled.
    if (payment.status !== 'succeeded') {
      await conn.rollback();
      const unfinishedId = payment.id;
      payment = null;
      await stripe.paymentIntents.cancel(unfinishedId);
      return res.status(402).json({
        error: 'This card needs an extra verification step that we don\'t support yet. Please try a different card.'
      });
    }

    // 1. Create Order
    const [orderRes] = await conn.query(`
      INSERT INTO Orders (
        user_id, subtotal, total_weight, delivery_fee, tax_amount, total_price,
        delivery_address, delivery_lat, delivery_lng, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
    `, [
      userId, subtotal, totalWeight, deliveryFee, taxAmount, totalPrice,
      location.address, location.lat, location.lng
    ]);
    const orderId = orderRes.insertId;

    // 2. Insert OrderItems & decrement Inventory
    for (const item of items) {
      await conn.query(`
        INSERT INTO OrderItems (order_id, product_id, quantity, unit_price, unit_weight)
        VALUES (?, ?, ?, ?, ?)
      `, [orderId, item.product_id, item.quantity, item.price, item.weight]);

      await conn.query(`
        UPDATE Inventory SET quantity = quantity - ? WHERE product_id = ?
      `, [item.quantity, item.product_id]);
    }

    // 3. Record Successful Stripe Transaction
    await conn.query(`
      INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status)
      VALUES (?, ?, ?, 'succeeded')
    `, [orderId, payment.id, totalPrice]);

    // 4. Clear Customer's Cart
    await conn.query('DELETE FROM CartItems WHERE cart_id = ?', [cartId]);

    // 5. Let the customer know, tell the employees there's a new order to pack,
    // and warn the managers about anything this order ran out or made run low
    await notifyUser(conn, userId, `Thanks! Order #${orderId} was placed. We'll start packing it soon.`, {
      orderId, link: '#/orders'
    });
    await notifyRoles(conn, ['employee'], `New Order #${orderId} is ready to pack.`, {
      orderId, link: `#/employee-packing?id=${orderId}`
    });
    for (const item of items) {
      const { quantity: before, reorder_level: lowStockAt } = stockBefore[item.product_id];
      const after = before - item.quantity;
      // Only the order that crosses the line sends one, so managers don't get one for every order
      let warning = null;
      if (after === 0) {
        warning = `${item.name} is out of stock.`;
      } else if (before > lowStockAt && after <= lowStockAt) {
        warning = `${item.name} is low on stock: ${after} left (low stock at ${lowStockAt}).`;
      }
      if (warning) {
        await notifyRoles(conn, ['manager'], warning, { link: '#/manager-inventory' });
      }
    }

    await conn.commit();

    res.status(201).json({
      message: 'Order created successfully.',
      order_id: orderId,
      subtotal,
      total_weight: totalWeight,
      delivery_fee: deliveryFee,
      tax_amount: taxAmount,
      total_price: totalPrice,
      status: 'Pending'
    });
  } catch (err) {
    await conn.rollback();
    // If the card was charged but the order couldn't be saved, give the money back
    if (payment) {
      try {
        await stripe.refunds.create({ payment_intent: payment.id });
      } catch (refundErr) {
        console.error('Refund after failed checkout did not work:', refundErr.message);
      }
    }
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Order creation failed. Please try again.' });
  } finally {
    conn.release();
  }
});

// GET /orders (Customer gets own orders, Employee & Manager get all orders)
router.get('/orders', loginVerification, async (req, res) => {
  try {
    const user = req.session.user;
    if (user.role === 'customer') {
      const [orders] = await pool.query(`
        SELECT o.order_id, o.user_id, o.subtotal, o.total_weight, o.delivery_fee, o.tax_amount,
               o.total_price, o.delivery_address, o.delivery_lat, o.delivery_lng, o.status,
               o.created_at, o.updated_at,
               do.delivery_id, do.stop_sequence, do.estimated_arrival,
               d.robot, d.delivery_status
        FROM Orders AS o
        LEFT JOIN DeliveryOrders AS do ON o.order_id = do.order_id
        LEFT JOIN Deliveries AS d ON do.delivery_id = d.delivery_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `, [user.user_id]);
      return res.json(orders);
    }

    // Employee & Manager: view all orders
    const [orders] = await pool.query(`
      SELECT o.order_id, o.user_id, u.name AS customer, u.email AS customer_email,
             o.subtotal, o.total_weight, o.delivery_fee, o.tax_amount,
             o.total_price, o.delivery_address, o.delivery_lat, o.delivery_lng, o.status,
             o.created_at, o.updated_at,
             do.delivery_id, do.stop_sequence, do.estimated_arrival,
             d.robot, d.delivery_status
      FROM Orders AS o
      JOIN Users AS u ON o.user_id = u.user_id
      LEFT JOIN DeliveryOrders AS do ON o.order_id = do.order_id
      LEFT JOIN Deliveries AS d ON do.delivery_id = d.delivery_id
      ORDER BY o.created_at DESC
    `);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

// GET /orders/:id (Customer [own orders], Employee, Manager)
router.get('/orders/:id', loginVerification, async (req, res) => {
  try {
    const user = req.session.user;
    const orderId = Number(req.params.id);

    const [orderRows] = await pool.query(`
      SELECT o.*, u.name AS customer_name, u.email AS customer_email,
             do.delivery_id, do.stop_sequence, do.estimated_arrival,
             d.robot, d.delivery_status
      FROM Orders AS o
      JOIN Users AS u ON o.user_id = u.user_id
      LEFT JOIN DeliveryOrders AS do ON o.order_id = do.order_id
      LEFT JOIN Deliveries AS d ON do.delivery_id = d.delivery_id
      WHERE o.order_id = ?
    `, [orderId]);

    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRows[0];
    if (user.role === 'customer' && order.user_id !== user.user_id) {
      return res.status(403).json({ error: 'Not allowed to view this order.' });
    }

    const [items] = await pool.query(`
      SELECT oi.order_item_id, oi.product_id, oi.quantity, oi.unit_price, oi.unit_weight,
             p.name, p.category, p.description, p.image_url
      FROM OrderItems AS oi
      JOIN Products AS p ON oi.product_id = p.product_id
      WHERE oi.order_id = ?
    `, [orderId]);

    res.json({ ...order, items });
  } catch (err) {
    console.error('Error fetching order detail:', err);
    res.status(500).json({ error: 'Could not load order details.' });
  }
});

// PUT /orders/:id/status (Employee, Manager, but only managers can cancel)
router.put('/orders/:id/status', loginVerification, roleVerification('employee', 'manager'), async (req, res) => {
  const orderId = Number(req.params.id);
  const { status: targetStatus } = req.body || {};

  if (targetStatus === 'Cancelled' && req.session.user.role !== 'manager') {
    return res.status(403).json({ error: 'Only managers can cancel orders.' });
  }

  if (!targetStatus || typeof targetStatus !== 'string') {
    return res.status(400).json({ error: 'Target status is required.' });
  }

  const [orderRows] = await pool.query('SELECT status, user_id, total_price FROM Orders WHERE order_id = ?', [orderId]);
  if (orderRows.length === 0) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const currentStatus = orderRows[0].status;
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return res.status(400).json({
      error: `Invalid status transition from "${currentStatus}" to "${targetStatus}". Allowed: ${allowed.join(', ') || 'none'}.`
    });
  }

  // Handle cancellation transition: restore inventory & record refund
  if (targetStatus === 'Cancelled') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [items] = await conn.query('SELECT product_id, quantity FROM OrderItems WHERE order_id = ?', [orderId]);
      for (const item of items) {
        await conn.query('UPDATE Inventory SET quantity = quantity + ? WHERE product_id = ?', [
          item.quantity, item.product_id
        ]);
      }

      await conn.query('UPDATE Orders SET status = ? WHERE order_id = ?', ['Cancelled', orderId]);

      const refundTxId = await refundOrder(conn, orderId);
      await conn.query(`
        INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status)
        VALUES (?, ?, ?, 'refunded')
      `, [orderId, refundTxId, orderRows[0].total_price]);

      await notifyUser(conn, orderRows[0].user_id, statusMessage(orderId, 'Cancelled'), { orderId, link: '#/orders' });

      await conn.commit();
      return res.json({ message: 'Order cancelled, inventory restored, and refund recorded.', order_id: orderId, status: 'Cancelled' });
    } catch (err) {
      await conn.rollback();
      console.error('Cancel order error:', err);
      return res.status(500).json({ error: 'Could not cancel order.' });
    } finally {
      conn.release();
    }
  }

  // Standard status transition
  await pool.query('UPDATE Orders SET status = ? WHERE order_id = ?', [targetStatus, orderId]);
  await notifyUser(pool, orderRows[0].user_id, statusMessage(orderId, targetStatus), { orderId, link: '#/orders' });
  if (targetStatus === 'Failed') {
    await notifyRoles(pool, ['manager'], `Order #${orderId} was marked failed and needs a follow up.`, {
      orderId, link: `#/manager-orders?id=${orderId}`
    });
  }

  res.json({ message: `Order status updated to ${targetStatus}.`, order_id: orderId, status: targetStatus });
});

// POST /orders/:id/cancel (Manager)
router.post('/orders/:id/cancel', loginVerification, roleVerification('manager'), async (req, res) => {
  const orderId = Number(req.params.id);

  const [orderRows] = await pool.query('SELECT status, user_id, total_price FROM Orders WHERE order_id = ?', [orderId]);
  if (orderRows.length === 0) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const currentStatus = orderRows[0].status;
  if (!['Pending', 'Preparing', 'Staged'].includes(currentStatus)) {
    return res.status(400).json({ error: `Cannot cancel order in "${currentStatus}" status.` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [items] = await conn.query('SELECT product_id, quantity FROM OrderItems WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await conn.query('UPDATE Inventory SET quantity = quantity + ? WHERE product_id = ?', [
        item.quantity, item.product_id
      ]);
    }

    await conn.query('UPDATE Orders SET status = ? WHERE order_id = ?', ['Cancelled', orderId]);

    const refundTxId = await refundOrder(conn, orderId);
    await conn.query(`
      INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status)
      VALUES (?, ?, ?, 'refunded')
    `, [orderId, refundTxId, orderRows[0].total_price]);

    await notifyUser(conn, orderRows[0].user_id, statusMessage(orderId, 'Cancelled'), { orderId, link: '#/orders' });

    await conn.commit();
    res.json({ message: 'Order successfully cancelled and inventory restored.', order_id: orderId, status: 'Cancelled' });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Could not cancel order.' });
  } finally {
    conn.release();
  }
});

// POST /orders/:id/received (Role: Customer)
// The customer presses Got My Order once they have their groceries. This only marks
// their own order. The employee still finishes the trip when the robot gets back,
// and that skips orders that are already delivered.
router.post('/orders/:id/received', loginVerification, roleVerification('customer'), async (req, res) => {
  const orderId = Number(req.params.id);

  try {
    const [orderRows] = await pool.query('SELECT user_id FROM Orders WHERE order_id = ?', [orderId]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (orderRows[0].user_id !== req.session.user.user_id) {
      return res.status(403).json({ error: 'You can only confirm your own orders.' });
    }

    // The status check is part of the update, so this can't undo something an
    // employee changed a moment ago
    const [result] = await pool.query(
      "UPDATE Orders SET status = 'Delivered' WHERE order_id = ? AND status = 'Out for Delivery'",
      [orderId]
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ error: 'You can only confirm an order while it is out for delivery.' });
    }
    await notifyRoles(pool, ['employee'], `The customer confirmed they got Order #${orderId}.`, {
      orderId, link: '#/employee'
    });

    res.json({ message: `Order #${orderId} is marked as delivered.`, order_id: orderId, status: 'Delivered' });
  } catch (err) {
    console.error('Order received error:', err);
    res.status(500).json({ error: 'Could not update the order.' });
  }
});

module.exports = router;
