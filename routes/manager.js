const express = require('express');
const pool = require('../db');
const {
  loginVerification,
  roleVerification,
} = require('../auth');

const router = express.Router();

// All manager routes require a logged-in manager.
router.use(
  loginVerification, roleVerification('manager')
);

// Read inventory
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
      WHERE p.active = TRUE
      ORDER BY p.category, p.name
    `);

    res.json(inventory);
  } catch (error) {
    console.error('Manager inventory error:', error);

    res.status(500).json({
      error: 'Could not load inventory.',
    });
  }
});

// Adjust inventory quantity
router.patch('/inventory/:productId', async (req, res) => {
  const productId = Number(req.params.productId);
  const change = Number((req.body || {}).change);

  if (!Number.isInteger(productId)) {
    return res.status(400).json({
      error: 'Invalid product ID.',
    });
  }

  if (!Number.isInteger(change) || change === 0) {
    return res.status(400).json({
      error: 'Inventory change must be a whole number other than 0.',
    });
  }

  try {
    // Change the quantity in one step instead of reading it and writing it back,
    // so a customer checking out at the same time doesn't get overwritten.
    // The WHERE part stops the quantity from going below zero.
    const [result] = await pool.query(
      `
        UPDATE Inventory
        SET quantity = quantity + ?
        WHERE product_id = ? AND quantity + ? >= 0
      `,
      [change, productId, change]
    );

    const [rows] = await pool.query(
      `
        SELECT quantity
        FROM Inventory
        WHERE product_id = ?
      `,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Inventory item not found.',
      });
    }

    if (result.affectedRows === 0) {
      return res.status(400).json({
        error: 'Inventory quantity cannot be below zero.',
      });
    }

    res.json({
      product_id: productId,
      quantity: rows[0].quantity,
    });
  } catch (error) {
    console.error('Inventory update error:', error);

    res.status(500).json({
      error: 'Could not update inventory.',
    });
  }
});

module.exports = router;