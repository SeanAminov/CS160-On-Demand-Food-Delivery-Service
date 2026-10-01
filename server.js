const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/products', async (req, res) => {
  try {
    const [products] = await pool.query(`
      SELECT
        p.product_id,
        p.name,
        p.description,
        p.price,
        p.weight,
        p.active,
        i.quantity
      FROM Products AS p
      JOIN Inventory AS i
        ON p.product_id = i.product_id
      WHERE p.active = TRUE
    `);

    res.json(products);
  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({
      error: 'Failed to load products'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});