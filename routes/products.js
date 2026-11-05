const express = require('express');
const pool = require('../db');
const { loginVerification, roleVerification } = require('../auth');
const router = express.Router();

// Stripe won't charge less than $0.50, so a single item can't cost less than that.
const MIN_PRICE = 0.5;
const MAX_PRICE = 9999.99;
// A robot only carries 200 lbs, so a single item can't weigh more than that.
const MAX_WEIGHT = 200;
const MAX_REORDER_LEVEL = 1000000;
const MAX_STOCK = 1000000;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

// Checks the product form. If something is wrong, this gives back the error to send.
// If it's fine, it gives back the cleaned up values.
function checkProduct(body) {
  const name = clean(body.name);
  const category = clean(body.category);
  const description = clean(body.description);
  const imageUrl = clean(body.image_url);
  const price = Number(body.price);
  const weight = Number(body.weight);
  const reorderLevel = Number(body.reorder_level);

  if (!name || name.length > 150) {
    return { error: 'Name is required and must be 150 characters or less.' };
  }
  if (!category || category.length > 100) {
    return { error: 'Category is required and must be 100 characters or less.' };
  }
  if (description.length > 1000) {
    return { error: 'Description must be 1000 characters or less.' };
  }
  // These show up on a lot of pages, so HTML has to stay out of them
  if (/[<>"]/.test(name + category + description)) {
    return { error: 'Product details can\'t use < > or double quotes.' };
  }
  if (isBlank(body.price) || !Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return { error: `Price must be between $${MIN_PRICE.toFixed(2)} and $${MAX_PRICE}.` };
  }
  if (isBlank(body.weight) || !Number.isFinite(weight) || weight < 0.01 || weight > MAX_WEIGHT) {
    return { error: `Weight must be between 0.01 and ${MAX_WEIGHT} lbs.` };
  }
  if (isBlank(body.reorder_level) || !Number.isInteger(reorderLevel) || reorderLevel < 0 || reorderLevel > MAX_REORDER_LEVEL) {
    return { error: 'Reorder level must be a whole number of 0 or more.' };
  }
  if (imageUrl && (imageUrl.length > 500 || !/^(https?:\/\/|\/images\/)[^\s<>"]+$/.test(imageUrl))) {
    return { error: 'Photo must be a web link starting with http:// or https://, or a path starting with /images/.' };
  }

  return {
    name,
    category,
    description: description || null,
    image_url: imageUrl || null,
    price: Number(price.toFixed(2)),
    weight: Number(weight.toFixed(2)),
    reorder_level: reorderLevel
  };
}

// PUT /products/:id (Role: Manager)
// Changes a product's details. Orders that were already placed keep the price and
// weight they were bought at, since those are saved on the order itself.
router.put('/products/:id', loginVerification, roleVerification('manager'), async (req, res) => {
  const productId = Number(req.params.id);
  const product = checkProduct(req.body || {});

  if (product.error) {
    return res.status(400).json({ error: product.error });
  }

  try {
    const [existing] = await pool.query(
      'SELECT product_id FROM Products WHERE product_id = ? AND active = TRUE',
      [productId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const [sameName] = await pool.query(
      'SELECT product_id FROM Products WHERE name = ? AND product_id <> ? AND active = TRUE',
      [product.name, productId]
    );
    if (sameName.length > 0) {
      return res.status(400).json({ error: 'Another product already has that name.' });
    }

    await pool.query(`
      UPDATE Products AS p
      JOIN Inventory AS i ON p.product_id = i.product_id
      SET p.name = ?, p.category = ?, p.description = ?, p.image_url = ?,
          p.price = ?, p.weight = ?, i.reorder_level = ?
      WHERE p.product_id = ?
    `, [
      product.name, product.category, product.description, product.image_url,
      product.price, product.weight, product.reorder_level, productId
    ]);

    res.json({ message: 'Product updated.', product: { product_id: productId, ...product } });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ error: 'Could not update the product.' });
  }
});

// POST /products (Role: Manager)
// Adds a new product along with how many are in stock to start.
router.post('/products', loginVerification, roleVerification('manager'), async (req, res) => {
  const body = req.body || {};
  const product = checkProduct(body);
  const quantity = Number(body.quantity);

  if (product.error) {
    return res.status(400).json({ error: product.error });
  }
  if (isBlank(body.quantity) || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_STOCK) {
    return res.status(400).json({ error: 'Starting stock must be a whole number of 0 or more.' });
  }

  const conn = await pool.getConnection();
  try {
    const [sameName] = await conn.query(
      'SELECT product_id FROM Products WHERE name = ? AND active = TRUE',
      [product.name]
    );
    if (sameName.length > 0) {
      return res.status(400).json({ error: 'Another product already has that name.' });
    }

    // The product and its stock row go in together, or not at all
    await conn.beginTransaction();
    const [result] = await conn.query(`
      INSERT INTO Products (name, category, description, image_url, price, weight)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [product.name, product.category, product.description, product.image_url, product.price, product.weight]);
    await conn.query(
      'INSERT INTO Inventory (product_id, quantity, reorder_level) VALUES (?, ?, ?)',
      [result.insertId, quantity, product.reorder_level]
    );
    await conn.commit();

    res.status(201).json({
      message: 'Product added.',
      product: { product_id: result.insertId, ...product, quantity }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Product add error:', err);
    res.status(500).json({ error: 'Could not add the product.' });
  } finally {
    conn.release();
  }
});

// DELETE /products/:id (Role: Manager)
// Takes a product out of the shop. Old orders still point to it, so the row stays
// and is marked inactive instead. It also comes out of everyone's cart.
router.delete('/products/:id', loginVerification, roleVerification('manager'), async (req, res) => {
  const productId = Number(req.params.id);

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query(
      'SELECT name FROM Products WHERE product_id = ? AND active = TRUE',
      [productId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    await conn.beginTransaction();
    await conn.query('UPDATE Products SET active = FALSE WHERE product_id = ?', [productId]);
    await conn.query('DELETE FROM CartItems WHERE product_id = ?', [productId]);
    await conn.commit();

    res.json({ message: `${existing[0].name} was removed from the shop.` });
  } catch (err) {
    await conn.rollback();
    console.error('Product remove error:', err);
    res.status(500).json({ error: 'Could not remove the product.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
