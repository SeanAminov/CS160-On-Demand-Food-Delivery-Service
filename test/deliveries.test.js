const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const session = require('express-session');
const pool = require('../db');
const deliveryRoutes = require('../routes/deliveries');
const http = require('http');

describe('Deliveries & Robot Pathway Trips API', () => {
  let server;
  let baseUrl;
  let testSessionUser = null;
  let testUserId = null;
  let testOrderId = null;
  let testDeliveryId = null;

  before(async () => {
    // Setup Express test app with mock session
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.session = {
        user: testSessionUser
      };
      next();
    });
    app.use('/', deliveryRoutes);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Create a temporary test customer user
    const [userRes] = await pool.query(`
      INSERT INTO Users (name, email, password_hash, role)
      VALUES ('Tracking Test Customer', 'tracking_test@example.com', 'dummy_hash', 'customer')
      ON DUPLICATE KEY UPDATE user_id = LAST_INSERT_ID(user_id)
    `);
    testUserId = userRes.insertId;

    // Create a staged test order in Downtown San Jose
    const [orderRes] = await pool.query(`
      INSERT INTO Orders (
        user_id, subtotal, total_weight, delivery_fee, tax_amount, total_price,
        delivery_address, delivery_lat, delivery_lng, status
      ) VALUES (
        ?, 45.00, 10.50, 0.00, 4.22, 49.22,
        '200 E San Carlos St, San Jose, CA 95112', 37.336000, -121.884000, 'Staged'
      )
    `, [testUserId]);
    testOrderId = orderRes.insertId;
  });

  after(async () => {
    // Cleanup created test records
    if (testDeliveryId) {
      await pool.query('DELETE FROM Deliveries WHERE delivery_id = ?', [testDeliveryId]);
    }
    if (testOrderId) {
      await pool.query('DELETE FROM Orders WHERE order_id = ?', [testOrderId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM Users WHERE user_id = ?', [testUserId]);
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await pool.end();
  });

  test('GET /maps-key returns API key payload', async () => {
    const res = await fetch(`${baseUrl}/maps-key`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok('apiKey' in data);
  });

  test('POST /deliveries/batches validates robot selection', async () => {
    testSessionUser = { user_id: 1, role: 'employee', name: 'Staff' };

    const res = await fetch(`${baseUrl}/deliveries/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ robot: 'Flying Saucer' })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Please pick a robot for this trip.');
  });

  test('POST /deliveries/batches dispatches trip using legal bicycle lanes and stores overview_polyline', async () => {
    testSessionUser = { user_id: 1, role: 'employee', name: 'Staff' };

    const res = await fetch(`${baseUrl}/deliveries/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        robot: 'Robot 1',
        orderIds: [testOrderId]
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.delivery_id);
    testDeliveryId = data.delivery_id;

    assert.strictEqual(data.robot, 'Robot 1');
    assert.strictEqual(data.route.travel_mode, 'BICYCLE');
    assert.ok(data.route.overview_polyline, 'Must include non-empty polyline');
    assert.ok(data.route.overview_polyline.length > 10);

    // Verify order was updated to Out for Delivery
    const [orders] = await pool.query('SELECT status FROM Orders WHERE order_id = ?', [testOrderId]);
    assert.strictEqual(orders[0].status, 'Out for Delivery');
  });

  test('GET /deliveries/:id allows customer to view their active trip with route information', async () => {
    testSessionUser = { user_id: testUserId, role: 'customer', name: 'Tracking Test Customer' };

    const res = await fetch(`${baseUrl}/deliveries/${testDeliveryId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.strictEqual(data.delivery_id, testDeliveryId);
    assert.strictEqual(data.delivery_status, 'Out for Delivery');
    assert.ok(data.route_parsed);
    assert.strictEqual(data.route_parsed.travel_mode, 'BICYCLE');
    assert.ok(data.route_parsed.overview_polyline);
    assert.ok(data.orders.some(o => o.order_id === testOrderId));
  });

  test('GET /deliveries/:id blocks other customers from viewing a trip they do not belong to', async () => {
    testSessionUser = { user_id: 999999, role: 'customer', name: 'Intruder' };

    const res = await fetch(`${baseUrl}/deliveries/${testDeliveryId}`);
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.error, 'Not allowed to view this delivery trip.');
  });

  test('PUT /deliveries/:id/complete marks trip and orders as Delivered', async () => {
    testSessionUser = { user_id: 1, role: 'employee', name: 'Staff' };

    const res = await fetch(`${baseUrl}/deliveries/${testDeliveryId}/complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome: 'Completed' })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.delivery_status, 'Completed');

    const [orders] = await pool.query('SELECT status FROM Orders WHERE order_id = ?', [testOrderId]);
    assert.strictEqual(orders[0].status, 'Delivered');
  });
});
