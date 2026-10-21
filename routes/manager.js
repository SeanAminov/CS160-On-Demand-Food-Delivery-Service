const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/inventory', async (req, res) => {
    try {
      const [inventory] = await pool.query(`
        SELECT
          p.product_id,
          p.name,
          p.category,
          p.price,
          p.weight,
          i.quantity
        FROM Products AS p
        JOIN Inventory AS i
          ON p.product_id = i.product_id
        ORDER BY p.category, p.name
      `);

      res.json(inventory);
    } catch (error) {
      console.error('Manager inventory error:', error);

      res.status(500).json({
        error: 'Could not load inventory.',
      });
    }
  }
);

module.exports = router;