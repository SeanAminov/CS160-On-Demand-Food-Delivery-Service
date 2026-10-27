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

function renderOrders(app, orders) {
  if (orders.length === 0) {
    app.innerHTML = `
      <h1>My Orders</h1>
      <p class="muted">You haven't placed any orders yet.</p>
      <a class="button primary" href="#/catalog">Shop Now</a>
    `;
    return;
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

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 14px; margin-bottom: 12px; background: #fafcfa; padding: 10px; border-radius: 6px;">
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
            <i class='bx bx-map-pin'></i> ${order.status === 'Out for Delivery' ? 'Track Live Robot Delivery' : 'View Delivery Map'}
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
    ${cards}
  `;

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

      const defaultLabel = `<i class='bx bx-map-pin'></i> ${status === 'Out for Delivery' ? 'Track Live Robot Delivery' : 'View Delivery Map'}`;

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
