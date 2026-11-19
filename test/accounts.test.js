const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const session = require('express-session');
const http = require('http');
const pool = require('../db');
const { hashPassword } = require('../auth');
const userRoutes = require('../routes/users');
const accountRoutes = require('../routes/accounts');
const productRoutes = require('../routes/products');

describe('Deleting accounts and product decimals', () => {
  let server;
  let baseUrl;

  const stamp = Date.now();
  const password = 'account_test_password_1';
  // Every account this file makes, so they all get cleaned up at the end
  const userIds = [];
  // The product the test orders use
  let productId;

  const call = (method, path, cookie, body) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined
    });

  // Makes an account straight in the database
  async function makeAccount(name, role) {
    const email = `account_test_${userIds.length}_${stamp}@example.com`;
    const [result] = await pool.query(
      'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, await hashPassword(password), role]
    );
    userIds.push(result.insertId);
    return { id: result.insertId, email };
  }

  // Logs in and gives back the session cookie
  async function logIn(email) {
    const res = await call('POST', '/login', null, { email, password });
    assert.strictEqual(res.status, 200);
    return res.headers.get('set-cookie').split(';')[0];
  }

  // Saves a paid order for 1 of the test product, the way checkout does. It's paid
  // with a practice payment, so cancelling it doesn't need Stripe.
  async function makeOrder(userId, status) {
    const [order] = await pool.query(`
      INSERT INTO Orders (
        user_id, subtotal, total_weight, delivery_fee, tax_amount, total_price,
        delivery_address, delivery_lat, delivery_lng, status
      ) VALUES (?, 4.49, 1.00, 0.00, 0.42, 4.91, '200 E Santa Clara St, San Jose, CA 95113', 37.337000, -121.885000, ?)
    `, [userId, status]);
    await pool.query(
      'INSERT INTO OrderItems (order_id, product_id, quantity, unit_price, unit_weight) VALUES (?, ?, 1, 4.49, 1.00)',
      [order.insertId, productId]
    );
    await pool.query(
      "INSERT INTO Transactions (order_id, stripe_transaction_id, amount, payment_status) VALUES (?, ?, 4.91, 'succeeded')",
      [order.insertId, `practice_account_test_${order.insertId}_${stamp}`]
    );
    return order.insertId;
  }

  async function isActive(userId) {
    const [rows] = await pool.query('SELECT active FROM Users WHERE user_id = ?', [userId]);
    return Boolean(rows[0].active);
  }

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: 'account-test-secret', resave: false, saveUninitialized: false }));
    app.use('/', userRoutes);
    app.use('/', accountRoutes);
    app.use('/', productRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const [products] = await pool.query('SELECT product_id FROM Products WHERE active = TRUE LIMIT 1');
    productId = products[0].product_id;
  });

  after(async () => {
    if (userIds.length > 0) {
      const [orders] = await pool.query('SELECT order_id, status FROM Orders WHERE user_id IN (?)', [userIds]);

      // Cancelling a test order put its 1 item back in stock, so take those back out
      const cancelled = orders.filter((order) => order.status === 'Cancelled').length;
      if (cancelled > 0) {
        await pool.query('UPDATE Inventory SET quantity = quantity - ? WHERE product_id = ?', [cancelled, productId]);
      }

      const orderIds = orders.map((order) => order.order_id);
      if (orderIds.length > 0) {
        await pool.query('DELETE FROM Transactions WHERE order_id IN (?)', [orderIds]);
        await pool.query('DELETE FROM Orders WHERE order_id IN (?)', [orderIds]);
      }
      await pool.query('DELETE FROM Notifications WHERE user_id IN (?)', [userIds]);
      await pool.query('DELETE FROM Users WHERE user_id IN (?)', [userIds]);
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  });

  describe('DELETE /profile', () => {
    let customer;

    test('A customer deletes their own account, and their order that has not shipped is cancelled and refunded', async () => {
      customer = await makeAccount('Account Tester', 'customer');
      const orderId = await makeOrder(customer.id, 'Pending');
      const [before] = await pool.query('SELECT quantity FROM Inventory WHERE product_id = ?', [productId]);
      const cookie = await logIn(customer.email);

      const res = await call('DELETE', '/profile', cookie);
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual((await res.json()).cancelled_orders, [orderId]);

      assert.strictEqual(await isActive(customer.id), false);
      const [orders] = await pool.query('SELECT status FROM Orders WHERE order_id = ?', [orderId]);
      assert.strictEqual(orders[0].status, 'Cancelled');
      const [refunds] = await pool.query("SELECT amount FROM Transactions WHERE order_id = ? AND payment_status = 'refunded'", [orderId]);
      assert.strictEqual(Number(refunds[0].amount), 4.91);
      const [afterDelete] = await pool.query('SELECT quantity FROM Inventory WHERE product_id = ?', [productId]);
      assert.strictEqual(afterDelete[0].quantity, before[0].quantity + 1);

      // The session that deleted the account is logged out
      assert.strictEqual((await call('GET', '/profile', cookie)).status, 401);
    });

    test('A deleted account can not log in, register again, or get a reset code', async () => {
      const login = await call('POST', '/login', null, { email: customer.email, password });
      assert.strictEqual(login.status, 403);
      assert.strictEqual((await login.json()).error, 'This account is not active anymore.');

      const register = await call('POST', '/register', null, {
        name: 'Account Tester', email: customer.email, password, confirmPassword: password
      });
      assert.strictEqual(register.status, 409);
      assert.strictEqual((await register.json()).error, 'This email belongs to an account that is not active anymore.');

      const resetCode = await call('POST', '/forgot-password/code', null, { email: customer.email });
      assert.strictEqual(resetCode.status, 403);
      assert.strictEqual((await resetCode.json()).error, 'This account is not active anymore.');
    });

    test('An order out for delivery has to arrive before the account can be deleted', async () => {
      const waiting = await makeAccount('Waiting Tester', 'customer');
      const orderId = await makeOrder(waiting.id, 'Out for Delivery');
      const cookie = await logIn(waiting.email);

      const res = await call('DELETE', '/profile', cookie);
      assert.strictEqual(res.status, 409);
      assert.strictEqual(
        (await res.json()).error,
        `Order #${orderId} is out for delivery right now. The account can be deleted after it arrives.`
      );
      assert.strictEqual(await isActive(waiting.id), true);
    });

    test('Error if nobody is logged in', async () => {
      assert.strictEqual((await call('DELETE', '/profile')).status, 401);
    });
  });

  describe('GET /users and DELETE /users/:id', () => {
    let managerCookie;
    let manager;
    let otherManager;

    before(async () => {
      manager = await makeAccount('Manager Tester', 'manager');
      otherManager = await makeAccount('Other Manager Tester', 'manager');
      managerCookie = await logIn(manager.email);
    });

    test('Managers see every account', async () => {
      const res = await call('GET', '/users', managerCookie);
      assert.strictEqual(res.status, 200);
      const accounts = await res.json();
      const mine = accounts.find((account) => account.user_id === manager.id);
      assert.strictEqual(mine.role, 'manager');
      assert.strictEqual(mine.active, true);
      assert.strictEqual(mine.unshipped_orders, 0);
    });

    test('A manager deletes an employee account, and the employee is logged out right away', async () => {
      const employee = await makeAccount('Employee Tester', 'employee');
      const employeeCookie = await logIn(employee.email);

      const res = await call('DELETE', `/users/${employee.id}`, managerCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.json()).message, "Employee Tester's account was deleted.");
      assert.strictEqual(await isActive(employee.id), false);
      assert.strictEqual((await call('GET', '/profile', employeeCookie)).status, 401);

      const again = await call('DELETE', `/users/${employee.id}`, managerCookie);
      assert.strictEqual(again.status, 409);
      assert.strictEqual((await again.json()).error, 'This account is already deleted.');
    });

    test('A manager can not delete another manager from Accounts', async () => {
      const res = await call('DELETE', `/users/${otherManager.id}`, managerCookie);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(await isActive(otherManager.id), true);
    });

    test('Customers can not see or delete other accounts', async () => {
      const customer = await makeAccount('Curious Customer', 'customer');
      const cookie = await logIn(customer.email);
      assert.strictEqual((await call('GET', '/users', cookie)).status, 403);
      assert.strictEqual((await call('DELETE', `/users/${otherManager.id}`, cookie)).status, 403);
    });

    test('A manager deletes their own account when another manager is still there', async () => {
      const res = await call('DELETE', '/profile', managerCookie);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(await isActive(manager.id), false);
    });
  });

  describe('Product prices and weights', () => {
    let managerCookie;
    const product = {
      name: `Decimal Tester ${stamp}`, category: 'Snacks', description: '', image_url: '',
      reorder_level: 5, quantity: 0
    };

    before(async () => {
      const manager = await makeAccount('Product Manager Tester', 'manager');
      managerCookie = await logIn(manager.email);
    });

    test('Error if a price has more than 2 decimal places', async () => {
      const res = await call('POST', '/products', managerCookie, { ...product, price: '4.999', weight: '1' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Price can have at most 2 decimal places, like 4.99.');
    });

    test('Error if a weight has more than 2 decimal places', async () => {
      const res = await call('POST', '/products', managerCookie, { ...product, price: '4.99', weight: '1.234' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Weight can have at most 2 decimal places, like 1.25.');
    });

    test('Error if a product is changed to a price with more than 2 decimal places', async () => {
      const res = await call('PUT', `/products/${productId}`, managerCookie, { ...product, price: '3.333', weight: '1' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error, 'Price can have at most 2 decimal places, like 4.99.');
    });
  });
});
