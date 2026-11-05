const express = require('express');
const pool = require('../db');
const { loginVerification, roleVerification } = require('../auth');
const Stripe = require('stripe');
const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const SAVED_STATUS_NAMES = { succeeded: 'Paid', refunded: 'Refunded', declined: 'Declined' };

// Gets the payments and refunds straight from Stripe. If the Stripe keys are missing or
// Stripe can't be reached, this returns null and the page shows what we saved instead.
async function getStripeRecords() {
  if (!stripe) {
    return null;
  }
  try {
    const [payments, refunds] = await Promise.all([
      stripe.paymentIntents.list({ limit: 100 }).autoPagingToArray({ limit: 1000 }),
      stripe.refunds.list({ limit: 100 }).autoPagingToArray({ limit: 1000 })
    ]);
    return { payments, refunds };
  } catch (err) {
    console.error('Stripe transaction lookup error:', err.message);
    return null;
  }
}

function fromStripe(row, stripeId, status, cents, createdSeconds) {
  return {
    stripe_id: stripeId,
    order_id: row.order_id,
    customer: row.customer,
    customer_email: row.customer_email,
    status,
    amount: cents / 100,
    date: new Date(createdSeconds * 1000),
    in_stripe: true
  };
}

// Our Transactions table saves the Stripe ID for each payment, so that ID is how a Stripe
// record gets matched to one of our orders. The team shares one Stripe test account, so
// Stripe also has payments from other people's databases. Those don't match anything here
// and get left out.
function matchWithStripe(savedRows, stripeRecords) {
  const { payments, refunds } = stripeRecords || { payments: [], refunds: [] };
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
  const refundsById = new Map(refunds.map((refund) => [refund.id, refund]));

  const transactions = savedRows.map((row) => {
    const stripeId = row.stripe_transaction_id;
    const payment = paymentsById.get(stripeId);
    const refund = refundsById.get(stripeId);

    if (payment) {
      const status = payment.status === 'succeeded' ? 'Paid' : 'Declined';
      return fromStripe(row, stripeId, status, payment.amount, payment.created);
    }
    if (refund) {
      const status = refund.status === 'failed' || refund.status === 'canceled' ? 'Refund failed' : 'Refunded';
      return fromStripe(row, stripeId, status, refund.amount, refund.created);
    }

    // Not in Stripe, like the practice payments from before Stripe was hooked up
    return {
      stripe_id: stripeId,
      order_id: row.order_id,
      customer: row.customer,
      customer_email: row.customer_email,
      status: SAVED_STATUS_NAMES[row.payment_status] || row.payment_status,
      amount: Number(row.amount),
      date: row.transaction_date,
      in_stripe: false
    };
  });

  // A refund made right in Stripe's dashboard isn't in our table, but it points back to
  // the payment it came from, and that payment tells us which order it belongs to.
  const savedById = new Map(savedRows.map((row) => [row.stripe_transaction_id, row]));
  for (const refund of refunds) {
    const paymentRow = savedById.get(refund.payment_intent);
    if (paymentRow && !savedById.has(refund.id)) {
      transactions.push(fromStripe(paymentRow, refund.id, 'Refunded', refund.amount, refund.created));
    }
  }

  return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// GET /transactions (Role: Manager)
// Every payment, refund, and declined card, matched with its order
router.get('/transactions', loginVerification, roleVerification('manager'), async (req, res) => {
  try {
    const [savedRows] = await pool.query(`
      SELECT t.order_id, t.stripe_transaction_id, t.amount, t.payment_status, t.transaction_date,
             u.name AS customer, u.email AS customer_email
      FROM Transactions AS t
      LEFT JOIN Orders AS o ON t.order_id = o.order_id
      LEFT JOIN Users AS u ON o.user_id = u.user_id
    `);

    const stripeRecords = await getStripeRecords();

    res.json({
      stripe_connected: stripeRecords !== null,
      transactions: matchWithStripe(savedRows, stripeRecords)
    });
  } catch (err) {
    console.error('Transaction history error:', err);
    res.status(500).json({ error: 'Could not load transactions.' });
  }
});

module.exports = router;
