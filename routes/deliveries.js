const express = require('express');
const pool = require('../db');
const { loginVerification, roleVerification } = require('../auth');
const { getOptimizedRoute } = require('../maps');
const router = express.Router();

const MAX_TRIP_ORDERS = 10;
const MAX_TRIP_WEIGHT = 200.0;
// The robots an employee can pick on the Waiting to Ship page
const ROBOTS = ['Robot 1', 'Robot 2', 'Robot 3'];

// POST /deliveries/batches (Role: Employee, Manager)
// Groups staged orders into a robot delivery trip within 10 orders & 200 lbs limits.
// The Waiting to Ship page sends the orders the employee checked and the robot they picked.
// If no orders are sent, the oldest staged orders that fit are picked automatically.
router.post('/deliveries/batches', loginVerification, roleVerification('employee', 'manager'), async (req, res) => {
  const { robot, orderIds } = req.body || {};

  if (!ROBOTS.includes(robot)) {
    return res.status(400).json({ error: 'Please pick a robot for this trip.' });
  }
  if (orderIds !== undefined && (!Array.isArray(orderIds) || orderIds.length === 0 || !orderIds.every(Number.isInteger))) {
    return res.status(400).json({ error: 'Please pick at least one order.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // A robot can only be on one trip at a time.
    // FOR UPDATE makes a second dispatch wait until this one is finished.
    const [busyTrips] = await conn.query(`
      SELECT delivery_id
      FROM Deliveries
      WHERE robot = ? AND delivery_status = 'Out for Delivery'
      FOR UPDATE
    `, [robot]);
    if (busyTrips.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: `${robot} is already out on trip #${busyTrips[0].delivery_id}.` });
    }

    // 1. Fetch staged orders, oldest first.
    // FOR UPDATE stops two employees from sending the same order out twice.
    const [stagedOrders] = await conn.query(`
      SELECT order_id, user_id, total_weight, total_price, delivery_address, delivery_lat, delivery_lng, created_at
      FROM Orders
      WHERE status = 'Staged'
      ORDER BY created_at ASC
      FOR UPDATE
    `);

    let selectedOrders = [];
    let tripWeight = 0;

    if (orderIds) {
      // 2a. The employee picked the orders, so make sure each one is still staged and they all fit
      selectedOrders = stagedOrders.filter(order => orderIds.includes(order.order_id));
      if (selectedOrders.length !== new Set(orderIds).size) {
        await conn.rollback();
        return res.status(409).json({ error: 'Some of those orders are not waiting to ship anymore. Reload the page and try again.' });
      }
      for (const order of selectedOrders) {
        tripWeight = Number((tripWeight + Number(order.total_weight)).toFixed(2));
      }
      if (selectedOrders.length > MAX_TRIP_ORDERS || tripWeight > MAX_TRIP_WEIGHT) {
        await conn.rollback();
        return res.status(400).json({ error: `A robot can carry up to ${MAX_TRIP_ORDERS} orders and ${MAX_TRIP_WEIGHT} lbs.` });
      }
    } else {
      // 2b. Greedy knapsack selection per Section 6 of Part 2 spec:
      // Take oldest orders first; if an order would push the trip past 200 lbs, skip it and continue
      // checking subsequent orders since a smaller order may still fit. Stop when 10 orders reached.
      for (const order of stagedOrders) {
        if (selectedOrders.length >= MAX_TRIP_ORDERS) {
          break;
        }
        const orderWeight = Number(order.total_weight);
        if (Number((tripWeight + orderWeight).toFixed(2)) <= MAX_TRIP_WEIGHT) {
          selectedOrders.push(order);
          tripWeight = Number((tripWeight + orderWeight).toFixed(2));
        }
        // If order would push past 200 lbs, skip it and keep checking
      }
    }

    if (selectedOrders.length === 0) {
      await conn.rollback();
      const error = stagedOrders.length === 0
        ? 'No staged orders available to form a delivery trip.'
        : `Could not form a trip. Staged orders individually exceed vehicle limit of ${MAX_TRIP_WEIGHT} lbs.`;
      return res.status(400).json({ error });
    }

    // 3. Request optimized multi-stop round-trip route from Google Maps with departure traffic
    const departureTime = new Date();
    const routePlan = await getOptimizedRoute(selectedOrders, departureTime);
    const routeSummary = JSON.stringify(routePlan.routeInformation);

    // Insert Deliveries record
    const [delivRes] = await conn.query(`
      INSERT INTO Deliveries (
        delivery_status, robot, route_information, total_weight, order_count,
        estimated_duration, total_distance, departure_time
      ) VALUES ('Out for Delivery', ?, ?, ?, ?, ?, ?, NOW())
    `, [robot, routeSummary, tripWeight, selectedOrders.length, routePlan.totalDurationMinutes, routePlan.totalDistanceMiles]);
    const deliveryId = delivRes.insertId;

    // Insert DeliveryOrders in optimized sequence & update Orders status
    for (const item of routePlan.orderedStops) {
      const { order, stop_sequence: stopSeq, estimated_arrival_minutes: estMinutes } = item;

      await conn.query(`
        INSERT INTO DeliveryOrders (delivery_id, order_id, stop_sequence, estimated_arrival)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
      `, [deliveryId, order.order_id, stopSeq, estMinutes]);

      await conn.query(`
        UPDATE Orders SET status = 'Out for Delivery' WHERE order_id = ?
      `, [order.order_id]);

      await conn.query(`
        INSERT INTO Notifications (user_id, order_id, message)
        VALUES (?, ?, ?)
      `, [order.user_id, order.order_id, `Order #${order.order_id} is out for delivery with our autonomous robot (Stop #${stopSeq})!`]);
    }

    await conn.commit();

    res.status(201).json({
      message: 'Robot delivery trip created and dispatched.',
      delivery_id: deliveryId,
      robot,
      order_count: selectedOrders.length,
      total_weight: tripWeight,
      estimated_duration_mins: routePlan.totalDurationMinutes,
      total_distance_miles: routePlan.totalDistanceMiles,
      route: routePlan.routeInformation,
      orders: routePlan.orderedStops.map((item) => ({
        order_id: item.order.order_id,
        stop_sequence: item.stop_sequence,
        estimated_arrival_minutes: item.estimated_arrival_minutes,
        weight: item.order.total_weight,
        address: item.order.delivery_address,
        lat: item.order.delivery_lat,
        lng: item.order.delivery_lng
      }))
    });
  } catch (err) {
    await conn.rollback();
    console.error('Batch delivery error:', err);
    res.status(500).json({ error: 'Failed to create delivery trip.' });
  } finally {
    conn.release();
  }
});

// GET /deliveries (Role: Employee, Manager)
router.get('/deliveries', loginVerification, roleVerification('employee', 'manager'), async (req, res) => {
  try {
    const [deliveries] = await pool.query(`
      SELECT d.*, COUNT(do.order_id) AS active_orders_count
      FROM Deliveries AS d
      LEFT JOIN DeliveryOrders AS do ON d.delivery_id = do.delivery_id
      GROUP BY d.delivery_id
      ORDER BY d.created_at DESC
    `);
    res.json(deliveries);
  } catch (err) {
    console.error('Error fetching deliveries:', err);
    res.status(500).json({ error: 'Could not load deliveries.' });
  }
});

// GET /maps-key
// The frontend map needs the Google Maps API key to load the Google Maps JavaScript API.
// It's safe for the browser to see the public maps key.
router.get('/maps-key', (req, res) => {
  res.json({ apiKey: process.env.GOOGLE_MAPS_API_KEY || null });
});

// GET /deliveries/:id (Role: Customer [if their order is in trip], Employee, Manager)
router.get('/deliveries/:id', loginVerification, async (req, res) => {
  try {
    const deliveryId = Number(req.params.id);
    const user = req.session.user;

    const [delivRows] = await pool.query('SELECT * FROM Deliveries WHERE delivery_id = ?', [deliveryId]);
    if (delivRows.length === 0) {
      return res.status(404).json({ error: 'Delivery trip not found.' });
    }

    const [orderRows] = await pool.query(`
      SELECT do.stop_sequence, do.estimated_arrival,
             o.order_id, o.user_id, o.total_weight, o.delivery_address, o.delivery_lat, o.delivery_lng, o.status,
             u.name AS customer_name
      FROM DeliveryOrders AS do
      JOIN Orders AS o ON do.order_id = o.order_id
      JOIN Users AS u ON o.user_id = u.user_id
      WHERE do.delivery_id = ?
      ORDER BY do.stop_sequence ASC
    `, [deliveryId]);

    // Customer can only view if one of their orders is in this trip
    if (user.role === 'customer') {
      const ownsOrder = orderRows.some(o => o.user_id === user.user_id);
      if (!ownsOrder) {
        return res.status(403).json({ error: 'Not allowed to view this delivery trip.' });
      }
    }

    let parsedRoute = null;
    try {
      parsedRoute = delivRows[0].route_information ? JSON.parse(delivRows[0].route_information) : null;
    } catch {
      parsedRoute = delivRows[0].route_information;
    }

    res.json({
      ...delivRows[0],
      route_parsed: parsedRoute,
      orders: orderRows
    });
  } catch (err) {
    console.error('Error fetching delivery:', err);
    res.status(500).json({ error: 'Could not load delivery information.' });
  }
});

// PUT /deliveries/:id/complete (Role: Employee, Manager)
// Marks trip as Completed (or Failed) and updates all associated orders to Delivered (or Failed)
router.put('/deliveries/:id/complete', loginVerification, roleVerification('employee', 'manager'), async (req, res) => {
  const deliveryId = Number(req.params.id);
  const { outcome } = req.body || {}; // 'Completed' or 'Failed'

  if (outcome !== 'Completed' && outcome !== 'Failed') {
    return res.status(400).json({ error: 'Outcome must be Completed or Failed.' });
  }

  const deliveryStatus = outcome === 'Failed' ? 'Failed' : 'Completed';
  const orderStatus = outcome === 'Failed' ? 'Failed' : 'Delivered';

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [deliv] = await conn.query('SELECT delivery_status FROM Deliveries WHERE delivery_id = ? FOR UPDATE', [deliveryId]);
    if (deliv.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Delivery trip not found.' });
    }

    // A trip can only be finished once, so a delivered trip can't be marked failed later
    if (deliv[0].delivery_status !== 'Out for Delivery') {
      await conn.rollback();
      return res.status(409).json({ error: `Trip #${deliveryId} is already ${deliv[0].delivery_status}.` });
    }

    await conn.query('UPDATE Deliveries SET delivery_status = ? WHERE delivery_id = ?', [deliveryStatus, deliveryId]);

    // Only orders still on the robot change. One already marked delivered stays delivered.
    const [orders] = await conn.query(`
      SELECT o.order_id, o.user_id
      FROM DeliveryOrders AS do
      JOIN Orders AS o ON do.order_id = o.order_id
      WHERE do.delivery_id = ? AND o.status = 'Out for Delivery'
    `, [deliveryId]);

    for (const order of orders) {
      await conn.query('UPDATE Orders SET status = ? WHERE order_id = ?', [orderStatus, order.order_id]);
      const msg = orderStatus === 'Delivered'
        ? `Order #${order.order_id} has been delivered by our robot!`
        : `Order #${order.order_id} delivery could not be completed. An employee will follow up.`;
      await conn.query('INSERT INTO Notifications (user_id, order_id, message) VALUES (?, ?, ?)', [
        order.user_id, order.order_id, msg
      ]);
    }

    await conn.commit();
    res.json({
      message: `Delivery trip marked as ${deliveryStatus}.`,
      delivery_id: deliveryId,
      delivery_status: deliveryStatus,
      orders_status: orderStatus,
      updated_orders: orders.map(o => o.order_id)
    });
  } catch (err) {
    await conn.rollback();
    console.error('Complete delivery error:', err);
    res.status(500).json({ error: 'Could not update delivery trip.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
