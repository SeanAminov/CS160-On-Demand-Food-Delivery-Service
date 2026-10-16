const express = require('express');
const pool = require('../db');
const router = express.Router();

// server.js only lets employees and managers reach these routes

// Orders that have been paid for and still need to be packed or sent out
router.get('/orders', async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT o.order_id, u.name AS customer, o.total_weight, o.status, o.created_at
      FROM Orders AS o
      JOIN Users AS u ON o.user_id = u.user_id
      WHERE o.status IN ('Pending', 'Preparing', 'Staged')
      ORDER BY o.created_at
    `);
    res.json(orders);
  } catch (error) {
    console.error('Employee Orders Error: ', error);
    res.status(500).json({ error: 'Could not load orders.' });
  }
});

module.exports = router;
