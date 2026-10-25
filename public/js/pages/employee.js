import { money } from '../cart-api.js';
import { getUser } from '../user.js';

// Only managers can cancel orders, so employees don't see the Cancel buttons
let isManager = false;

export default {
  title: 'Employee Dashboard',
  async show(app) {
    try {
      const user = await getUser();
      isManager = Boolean(user && user.role === 'manager');
      await renderDashboard(app);
    } catch (err) {
      app.innerHTML = `<h1>Employee Dashboard</h1><p class="message">${err.message}</p>`;
    }
  },
};

async function renderDashboard(app, feedbackMsg = '', isError = false) {
  // Fetch orders and active deliveries in parallel
  const [ordersRes, deliveriesRes] = await Promise.all([
    fetch('/orders'),
    fetch('/deliveries')
  ]);

  if (!ordersRes.ok || !deliveriesRes.ok) {
    throw new Error('Could not load dashboard data. Access restricted to employees and managers.');
  }

  const allOrders = await ordersRes.json();
  const allDeliveries = await deliveriesRes.json();

  const pendingOrders = allOrders.filter(o => o.status === 'Pending');
  const preparingOrders = allOrders.filter(o => o.status === 'Preparing');
  const stagedOrders = allOrders.filter(o => o.status === 'Staged');
  const activeTrips = allDeliveries.filter(d => d.delivery_status === 'Out for Delivery');

  const stagedWeightTotal = stagedOrders.reduce((sum, o) => sum + Number(o.total_weight), 0);

  app.innerHTML = `
    <h1>Employee Fulfillment Dashboard</h1>
    ${feedbackMsg ? `<p class="message" style="color: ${isError ? '#a12a2a' : '#2f6f3e'}; font-weight: bold;">${feedbackMsg}</p>` : ''}

    <!-- Quick Stats Bar -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px;">
      <div class="card" style="text-align: center; border-left: 4px solid #b45309;">
        <span class="muted" style="font-size: 13px;">Pending Packing</span>
        <h2 style="margin: 6px 0; color: #b45309;">${pendingOrders.length}</h2>
      </div>
      <div class="card" style="text-align: center; border-left: 4px solid #1d4ed8;">
        <span class="muted" style="font-size: 13px;">Currently Preparing</span>
        <h2 style="margin: 6px 0; color: #1d4ed8;">${preparingOrders.length}</h2>
      </div>
      <div class="card" style="text-align: center; border-left: 4px solid #6d28d9;">
        <span class="muted" style="font-size: 13px;">Staged for Robot</span>
        <h2 style="margin: 6px 0; color: #6d28d9;">${stagedOrders.length} (${stagedWeightTotal.toFixed(1)} lb)</h2>
      </div>
      <div class="card" style="text-align: center; border-left: 4px solid #047857;">
        <span class="muted" style="font-size: 13px;">Active Robot Trips</span>
        <h2 style="margin: 6px 0; color: #047857;">${activeTrips.length}</h2>
      </div>
    </div>

    <!-- Section 1: Robot Delivery Dispatch -->
    <div class="hero" style="background: #eef7f0; border: 1px solid #c2e2c8; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="margin: 0 0 6px;">Autonomous Robot Delivery Dispatch</h2>
          <p class="muted" style="margin: 0; font-size: 14px;">
            Batches staged orders into a downtown delivery route (Max 10 orders & 200.0 lbs per trip).
          </p>
        </div>
        <div>
            ${
              stagedOrders.length > 0
              ? `
                <a
                  class="button primary"
                  href="#/employee-shipping"
                  style="padding: 12px 20px;"
                >
                  Review and Assign Robot
                  (${stagedOrders.length} staged)
                </a>
              `
              : `
                <button
                  class="button primary"
                  disabled
                  style="padding: 12px 20px;"
                >
                  No Staged Orders
                </button>
              `
            }
        </div>
      </div>

      ${stagedOrders.length > 0 ? `
        <div style="margin-top: 16px; background: white; padding: 12px; border-radius: 8px;">
          <b>Ready for loading (${stagedOrders.length} orders, ${stagedWeightTotal.toFixed(2)} lbs total):</b>
          <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 14px;">
            ${stagedOrders.map(o => `<li>Order #${o.order_id} &mdash; ${o.customer} (${o.total_weight} lb) &bull; ${o.delivery_address}</li>`).join('')}
          </ul>
        </div>
      ` : '<p class="muted" style="margin-top: 10px; font-size: 13px;">No orders currently staged. Pack orders below and mark them Staged to dispatch a trip.</p>'}
    </div>

    <!-- Section 2: Active Robot Trips Out for Delivery -->
    ${activeTrips.length > 0 ? `
      <h2>Active Trips on the Road</h2>
      <div style="margin-bottom: 30px;">
        ${activeTrips.map(t => `
          <div class="card" style="margin-bottom: 14px; border-left: 4px solid #047857;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <b>Trip #${t.delivery_id}</b>${t.robot ? ` &bull; ${t.robot}` : ''} &bull; Status: <span style="color: #047857; font-weight: bold;">Out for Delivery</span>
                <span class="muted" style="margin-left: 10px; font-size: 13px;">Departed: ${new Date(t.departure_time || t.created_at).toLocaleTimeString()}</span>
              </div>
              <div class="buttons" style="margin-top: 0;">
                <button class="button small primary complete-trip" data-id="${t.delivery_id}" data-outcome="Completed">Mark All Delivered</button>
                <button class="button small complete-trip" data-id="${t.delivery_id}" data-outcome="Failed" style="color: #a12a2a; border-color: #a12a2a;">Mark Delivery Failed</button>
              </div>
            </div>
            <p style="font-size: 14px; margin: 8px 0 0;">
              Total Weight: <b>${t.total_weight} lb</b> | Orders: <b>${t.order_count}</b> | Est. Distance: <b>${t.total_distance || 0} mi</b>
            </p>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Section 3: Packing Work Queue (Pending & Preparing) -->
    <h2>Order Fulfillment Queue</h2>
    ${(pendingOrders.length === 0 && preparingOrders.length === 0) ? `
      <p class="muted">No pending or preparing orders in the packing queue.</p>
    ` : `
      <table class="cart" style="margin-top: 12px;">
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Weight</th>
          <th>Status</th>
          <th>Address</th>
          <th>Actions</th>
        </tr>
        ${[...pendingOrders, ...preparingOrders].map(order => `
          <tr>
            <td><b>#${order.order_id}</b></td>
            <td>${order.customer}</td>
            <td>${order.total_weight} lb</td>
            <td>
              <span style="font-weight: bold; color: ${order.status === 'Pending' ? '#b45309' : '#1d4ed8'};">
                ${order.status}
              </span>
            </td>
            <td style="font-size: 13px;">${order.delivery_address}</td>
            <td>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <a
                  class="button small primary"
                  href="#/employee-packing?id=${order.order_id}"
                >
                  Open Packing
                </a>
                ${isManager ? `
                  <button class="button small cancel-btn" data-id="${order.order_id}" style="color: #b91c1c; border-color: #b91c1c;">
                    Cancel
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `).join('')}
      </table>
    `}
  `;

  // Attach event handlers.
  // Dispatching a trip happens on the Waiting to Ship page, and moving an order
  // to Preparing and Staged happens on the packing page.
  for (const btn of app.querySelectorAll('.cancel-btn')) {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      if (!confirm(`Cancel Order #${orderId}? This will issue a refund and restore inventory.`)) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/orders/${orderId}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to cancel order.');
        await renderDashboard(app, `Order #${orderId} cancelled and inventory restored.`);
      } catch (err) {
        await renderDashboard(app, err.message, true);
      }
    });
  }

  for (const btn of app.querySelectorAll('.complete-trip')) {
    btn.addEventListener('click', async () => {
      const tripId = btn.dataset.id;
      const outcome = btn.dataset.outcome;
      btn.disabled = true;
      try {
        const res = await fetch(`/deliveries/${tripId}/complete`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete delivery trip.');
        await renderDashboard(app, `Trip #${tripId} marked as ${outcome}. Orders updated.`);
      } catch (err) {
        await renderDashboard(app, err.message, true);
      }
    });
  }
}
