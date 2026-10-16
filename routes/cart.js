const express = require('express');
const pool = require('../db');
const router = express.Router();

const FREE_DELIVERY_LIMIT = 20;
const DELIVERY_FEE = 10;
const TAX_RATE = process.env.TAX_RATE ? Number(process.env.TAX_RATE) : 0.09375;

// The logged in user comes from the session, not from anything the browser sends
function getUserId(req) {
  return req.session.user ? req.session.user.user_id : null;
}

// Finds the user's cart, making one if they don't have it yet.
// Sends a 401 and returns null if nobody valid is logged in.
async function getCartId(req, res) {
  const userId = getUserId(req);
  if (userId) {
    const [users] = await pool.query('SELECT user_id FROM Users WHERE user_id = ?', [userId]);
    if (users.length > 0) {
      const [rows] = await pool.query('SELECT cart_id FROM Carts WHERE user_id = ?', [userId]);
      if (rows.length > 0) {
        return rows[0].cart_id;
      }
      const [result] = await pool.query('INSERT INTO Carts (user_id) VALUES (?)', [userId]);
      return result.insertId;
    }
  }
  res.status(401).json({ error: 'Please log in to use your cart.' });
  return null;
}

// Price and weight always come from the database, not from the browser
async function buildCart(cartId) {
  const [items] = await pool.query(`
    SELECT ci.cart_item_id, ci.product_id, ci.quantity,
           p.name, p.price, p.weight, i.quantity AS stock
    FROM CartItems AS ci
    JOIN Products AS p ON ci.product_id = p.product_id
    JOIN Inventory AS i ON p.product_id = i.product_id
    WHERE ci.cart_id = ?
    ORDER BY ci.cart_item_id
  `, [cartId]);

  let subtotal = 0;
  let totalWeight = 0;
  for (const item of items) {
    item.price = Number(item.price);
    item.weight = Number(item.weight);
    subtotal += item.price * item.quantity;
    totalWeight += item.weight * item.quantity;
  }

  let deliveryFee = 0;
  if (items.length > 0 && totalWeight >= FREE_DELIVERY_LIMIT) {
    deliveryFee = DELIVERY_FEE;
  }

  // Flat sales tax applied to product subtotal only, per Part 2 spec
  const taxAmount = Number((subtotal * TAX_RATE).toFixed(2));
  const total = Number((subtotal + deliveryFee + taxAmount).toFixed(2));

  return {
    items,
    subtotal: Number(subtotal.toFixed(2)),
    totalWeight: Number(totalWeight.toFixed(2)),
    deliveryFee,
    taxRate: TAX_RATE,
    taxAmount,
    total,
  };
}

async function getStock(productId) {
  const [rows] = await pool.query(`
    SELECT i.quantity
    FROM Products AS p
    JOIN Inventory AS i ON p.product_id = i.product_id
    WHERE p.product_id = ? AND p.active = TRUE
  `, [productId]);
  return rows.length > 0 ? rows[0].quantity : null;
}

function isValidQuantity(quantity) {
  return Number.isInteger(quantity) && quantity > 0;
}

router.get('/cart', async (req, res) => {
  try {
    const cartId = await getCartId(req, res);
    if (!cartId) return;
    res.json(await buildCart(cartId));
  } catch (error) {
    console.error('Cart Error: ', error);
    res.status(500).json({ error: 'Could not load the cart.' });
  }
});

router.post('/cart/items', async (req, res) => {
  const productId = Number(req.body.productId);
  const quantity = Number(req.body.quantity ?? 1);
  if (!Number.isInteger(productId) || !isValidQuantity(quantity)) {
    return res.status(400).json({ error: 'Invalid product or quantity.' });
  }
  try {
    const stock = await getStock(productId);
    if (stock === null) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const cartId = await getCartId(req, res);
    if (!cartId) return;
    const [existing] = await pool.query(
      'SELECT quantity FROM CartItems WHERE cart_id = ? AND product_id = ?', [cartId, productId]
    );
    const newQuantity = (existing.length > 0 ? existing[0].quantity : 0) + quantity;
    if (newQuantity > stock) {
      return res.status(409).json({ error: `Only ${stock} left in stock.` });
    }
    if (existing.length > 0) {
      await pool.query(
        'UPDATE CartItems SET quantity = ? WHERE cart_id = ? AND product_id = ?', [newQuantity, cartId, productId]
      );
    } else {
      await pool.query(
        'INSERT INTO CartItems (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartId, productId, quantity]
      );
    }
    res.json(await buildCart(cartId));
  } catch (error) {
    console.error('Cart Error: ', error);
    res.status(500).json({ error: 'Could not add the item.' });
  }
});

router.put('/cart/items/:id', async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!isValidQuantity(quantity)) {
    return res.status(400).json({ error: 'Quantity must be at least 1.' });
  }
  try {
    const cartId = await getCartId(req, res);
    if (!cartId) return;
    const [rows] = await pool.query(
      'SELECT product_id FROM CartItems WHERE cart_item_id = ? AND cart_id = ?', [req.params.id, cartId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Item not found in your cart.' });
    }
    const stock = await getStock(rows[0].product_id);
    if (stock === null || quantity > stock) {
      return res.status(409).json({ error: `Only ${stock ?? 0} left in stock.` });
    }
    await pool.query('UPDATE CartItems SET quantity = ? WHERE cart_item_id = ?', [quantity, req.params.id]);
    res.json(await buildCart(cartId));
  } catch (error) {
    console.error('Cart Error: ', error);
    res.status(500).json({ error: 'Could not update the item.' });
  }
});

router.delete('/cart/items/:id', async (req, res) => {
  try {
    const cartId = await getCartId(req, res);
    if (!cartId) return;
    const [result] = await pool.query(
      'DELETE FROM CartItems WHERE cart_item_id = ? AND cart_id = ?', [req.params.id, cartId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found in your cart.' });
    }
    res.json(await buildCart(cartId));
  } catch (error) {
    console.error('Cart Error: ', error);
    res.status(500).json({ error: 'Could not remove the item.' });
  }
});

router.buildCart = buildCart;
router.getCartId = getCartId;
router.TAX_RATE = TAX_RATE;

module.exports = router;

