const express = require('express');
const session = require('express-session');
const path = require('path');
const pool = require('./db');
const { initializeDatabase } = require('./db');
const { loginVerification, roleVerification } = require('./auth');


const app = express();
const PORT = process.env.PORT || 3000;

const userRoutes = require('./routes/users');
const cartRoutes = require('./routes/cart');
const employeeRoutes = require('./routes/employee');
const orderRoutes = require('./routes/orders');
const deliveryRoutes = require('./routes/deliveries');
const managerRoutes = require('./routes/manager');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'development-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 30
  }
}));

app.get('/products', async (req, res) => {
  try {
    const [products] = await pool.query(`
      SELECT
        p.product_id,
        p.name,
        p.category,
        p.description,
        p.image_url,
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

app.use('/', userRoutes);
app.use('/', cartRoutes);
app.use('/', orderRoutes);
app.use('/', deliveryRoutes);
// Only employees and managers can get employee data.
// This is the real check, since anyone can open the page files in a browser.
app.use('/employee', loginVerification, roleVerification('employee', 'manager'), employeeRoutes);

// Only managers can get manager data.
app.use('/manager', loginVerification, roleVerification('manager'), managerRoutes);

// Set up the database first (tables, new columns, and sample products), then start the server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Could not set up the database. Check that MySQL is running and that .env is right.');
    console.error(error.message);
    process.exit(1);
  });