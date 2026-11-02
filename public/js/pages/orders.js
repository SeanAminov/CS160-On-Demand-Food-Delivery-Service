import { money } from '../cart-api.js';
import { getUser } from '../user.js';
import { renderOrderTrackingMap } from '../route-map.js';

export default {
  title: 'My Orders',
  async show(app) {
    const user = await getUser();
    if (!user) {
      app.innerHTML = `
        <h1>My Orders</h1>
        <p class="muted">Please log in to view your orders.</p>
        <a class="button primary" href="#/login">Log In</a>
      `;
      return;
    }

    try {
      const response = await fetch('/orders');
      if (!response.ok) throw new Error('Could not load orders.');
      const orders = await response.json();
      renderOrders(app, orders);
    } catch (err) {
      app.innerHTML = `<h1>My Orders</h1><p class="message">${err.message}</p>`;
    }
  },
};

function getStatusBadge(status) {
  const colors = {
    'Pending': '#b45309',
    'Preparing': '#1d4ed8',
    'Staged': '#6d28d9',
    'Out for Delivery': '#047857',
    'Delivered': '#2f6f3e',
    'Cancelled': '#b91c1c',
    'Failed': '#991b1b',
  };
  const color = colors[status] || '#555';
  return `<span style="display: inline-block; padding: 4px 10px; border-radius: 12px; background: ${color}1a; color: ${color}; border: 1px solid ${color}; font-weight: bold; font-size: 13px;">${status}</span>`;
}

// 5-step visual order journey stepper
function renderProgressStepper(status) {
  if (status === 'Cancelled' || status === 'Failed') {
    return `
      <div style="padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 13px; margin: 10px 0;">
        <i class='bx bx-x-circle' style="vertical-align: middle;"></i> Order ${status}
      </div>
    `;
  }

  const steps = [
    { key: 'Pending', label: 'Order Placed' },
    { key: 'Preparing', label: 'Packing' },
    { key: 'Staged', label: 'Staged' },
    { key: 'Out for Delivery', label: 'En Route' },
    { key: 'Delivered', label: 'Delivered' }
  ];

  const currentIdx = steps.findIndex(s => s.key === status);
  const activeIndex = currentIdx >= 0 ? currentIdx : 0;

  return `
    <div class="order-stepper">
      ${steps.map((step, idx) => {
        const isCompleted = idx < activeIndex || status === 'Delivered';
        const isCurrent = idx === activeIndex && status !== 'Delivered';
        const stateClass = isCompleted ? 'completed' : (isCurrent ? 'active' : 'upcoming');
        const icon = isCompleted ? "<i class='bx bx-check'></i>" : String(idx + 1);

        const connector = idx < steps.length - 1
          ? `<div class="stepper-line ${idx < activeIndex || status === 'Delivered' ? 'completed' : ''}"></div>`
          : '';

        return `
          <div class="stepper-step ${stateClass}">
            <div class="stepper-circle">${icon}</div>
            <div class="stepper-label">${step.label}</div>
          </div>
          ${connector}
        `;
      }).join('')}
    </div>
  `;
}

function renderOrders(app, orders) {
  if (orders.length === 0) {
    app.innerHTML = `
      <h1>My Orders</h1>
      <p class="muted">You haven't placed any orders yet.</p>
      <a class="button primary" href="#/catalog">Shop Now</a>
    `;
    return;
  }

  const activeDeliveryOrder = orders.find(o => o.status === 'Out for Delivery');
  let heroTrackerHtml = '';

  if (activeDeliveryOrder) {
    const etaStr = activeDeliveryOrder.estimated_arrival
      ? new Date(activeDeliveryOrder.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'In Transit';

    heroTrackerHtml = `
      <section class="card live-tracker-hero" style="border: 2px solid #047857; background: #f0fdf4; margin-bottom: 24px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="live-pulse-dot"></span>
            <strong style="color: #047857; font-size: 15px; text-transform: uppercase; letter-spacing: 0.5px;">Live Robot Delivery Active</strong>
          </div>
          <div style="font-size: 13px; color: #166534;">
            Autonomous Robot: <b>${activeDeliveryOrder.robot || 'Robot 1'}</b> &bull; Stop <b>#${activeDeliveryOrder.stop_sequence || 1}</b>
          </div>
        </div>

        <div style="margin-bottom: 14px;">
          <h2 style="margin: 0 0 6px; font-size: 20px; color: #14532d;">Order #${activeDeliveryOrder.order_id} is En Route!</h2>
          <p style="margin: 0; color: #166534; font-size: 14px;">
            Our autonomous robot is traveling on designated bike lanes and pedestrian pathways to <b>${activeDeliveryOrder.delivery_address}</b>.
            ${activeDeliveryOrder.estimated_arrival ? `Estimated Arrival: <b>${etaStr}</b>.` : ''}
          </p>
        </div>

        ${renderProgressStepper(activeDeliveryOrder.status)}

        <div id="hero-live-map-${activeDeliveryOrder.order_id}" style="margin-top: 14px;">
          <div class="muted" style="padding: 16px; text-align: center;"><i class='bx bx-loader-alt bx-spin'></i> Loading live tracking map...</div>
        </div>
      </section>
    `;
  }

  let cards = '';
  for (const order of orders) {
    const dateStr = new Date(order.created_at).toLocaleString();
    cards += `
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
          <div>
            <h3 style="margin: 0; font-size: 18px;">Order #${order.order_id}</h3>
            <span class="muted" style="font-size: 13px;">Placed on ${dateStr}</span>
          </div>
          <div>${getStatusBadge(order.status)}</div>
        </div>

        ${renderProgressStepper(order.status)}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 14px; margin: 12px 0; background: #fafcfa; padding: 10px; border-radius: 6px;">
          <div>Subtotal: <b>${money(order.subtotal)}</b></div>
          <div>Weight: <b>${order.total_weight} lb</b></div>
          <div>Delivery Fee: <b>${money(order.delivery_fee)}</b></div>
          <div>Sales Tax: <b>${money(order.tax_amount)}</b></div>
          <div>Total: <b style="font-size: 16px; color: #2f6f3e;">${money(order.total_price)}</b></div>
        </div>

        <p style="font-size: 14px; margin: 4px 0 12px;"><b>Delivery Address:</b> ${order.delivery_address}</p>

        ${order.status === 'Out for Delivery' && order.robot ? `
          <div style="background: #eef7f0; border-left: 4px solid #047857; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 12px;">
            <i class='bx bx-bot' style="color: #047857; font-size: 16px; vertical-align: middle;"></i>
            Autonomous Delivery Robot: <b>${order.robot}</b> &bull; Stop <b>#${order.stop_sequence || 1}</b>
            ${order.estimated_arrival ? `&bull; ETA: <b>${new Date(order.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>` : ''}
          </div>
        ` : ''}

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="button small toggle-items" data-id="${order.order_id}">View Order Items</button>
          <button
            class="button small ${order.status === 'Out for Delivery' ? 'primary' : ''} view-order-map"
            data-id="${order.order_id}"
            data-status="${order.status}"
          >
            <i class='bx bx-map-pin'></i> ${order.status === 'Out for Delivery' ? 'View Live Tracking Map' : 'Preview Delivery Route'}
          </button>
        </div>

        <div id="items-${order.order_id}" style="display: none; margin-top: 14px;"></div>
        <div id="order-map-${order.order_id}" style="display: none; margin-top: 14px;"></div>
      </div>
    `;
  }

  app.innerHTML = `
    <h1>My Orders</h1>
    <p class="muted" style="margin-bottom: 24px;">Track your grocery deliveries from preparation to autonomous robot delivery.</p>
    ${heroTrackerHtml}
    ${cards}
  `;

  // Auto-render live tracking map for orders currently Out for Delivery
  if (activeDeliveryOrder) {
    const heroMap = app.querySelector(`#hero-live-map-${activeDeliveryOrder.order_id}`);
    if (heroMap) {
      renderOrderTrackingMap(heroMap, activeDeliveryOrder);
    }
  }

  for (const btn of app.querySelectorAll('.toggle-items')) {
    btn.addEventListener('click', async () => {
      const orderId = btn.dataset.id;
      const targetDiv = app.querySelector(`#items-${orderId}`);

      if (targetDiv.style.display === 'block') {
        targetDiv.style.display = 'none';
        btn.textContent = 'View Order Items';
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Loading items...';
      try {
        const res = await fetch(`/orders/${orderId}`);
        const data = await res.json();
        let itemRows = '';
        for (const it of data.items || []) {
          itemRows += `
            <tr>
              <td>${it.name}</td>
              <td>${money(it.unit_price)}</td>
              <td>${it.quantity}</td>
              <td>${(it.unit_weight * it.quantity).toFixed(2)} lb</td>
              <td>${money(it.unit_price * it.quantity)}</td>
            </tr>
          `;
        }

        targetDiv.innerHTML = `
          <table class="cart" style="margin-top: 6px;">
            <tr><th>Item</th><th>Unit Price</th><th>Qty</th><th>Weight</th><th>Total</th></tr>
            ${itemRows}
          </table>
        `;
        targetDiv.style.display = 'block';
        btn.textContent = 'Hide Order Items';
      } catch (err) {
        targetDiv.innerHTML = `<p class="message">${err.message}</p>`;
        targetDiv.style.display = 'block';
        btn.textContent = 'View Order Items';
      } finally {
        btn.disabled = false;
      }
    });
  }

  for (const btn of app.querySelectorAll('.view-order-map')) {
    btn.addEventListener('click', async () => {
      const orderId = Number(btn.dataset.id);
      const status = btn.dataset.status;
      const targetDiv = app.querySelector(`#order-map-${orderId}`);
      if (!targetDiv) return;

      const defaultLabel = `<i class='bx bx-map-pin'></i> ${status === 'Out for Delivery' ? 'View Live Tracking Map' : 'Preview Delivery Route'}`;

      if (targetDiv.style.display === 'block') {
        targetDiv.style.display = 'none';
        btn.innerHTML = defaultLabel;
        return;
      }

      targetDiv.style.display = 'block';
      btn.innerHTML = `<i class='bx bx-chevron-up'></i> Hide Delivery Map`;
      targetDiv.innerHTML = `<p class="muted" style="padding: 10px;"><i class='bx bx-loader-alt bx-spin'></i> Loading delivery map...</p>`;

      try {
        const order = orders.find((o) => o.order_id === orderId);
        if (!order) throw new Error('Order details not found.');
        await renderOrderTrackingMap(targetDiv, order);
      } catch (err) {
        targetDiv.innerHTML = `<p class="message error">${err.message}</p>`;
      }
    });
  }
}
