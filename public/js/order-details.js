import { money, escapeHtml } from './cart-api.js';

// Shows the products on one order. My Orders and Order Management both use this.
// Prices and weights are from when the order was placed, so changing a product
// later doesn't change what an old order says was paid.
export async function renderOrderDetails(container, orderId, showTotals = false) {
  container.innerHTML = '<p class="muted">Loading order details...</p>';

  const response = await fetch(`/orders/${orderId}`);
  const order = await response.json();

  if (!response.ok) {
    throw new Error(order.error || 'Could not load order details.');
  }

  const rows = order.items.map((item) => `
    <tr>
      <td>
        <div class="order-item">
          ${item.image_url ? `
            <img
              class="order-item-image"
              src="${escapeHtml(item.image_url)}"
              alt=""
              loading="lazy"
              onerror="this.remove()"
            >
          ` : ''}

          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="muted order-item-text">${escapeHtml(item.category)}</div>
            <div class="muted order-item-text">${escapeHtml(item.description)}</div>
          </div>
        </div>
      </td>
      <td>${money(item.unit_price)}</td>
      <td>${item.quantity}</td>
      <td>${(item.unit_weight * item.quantity).toFixed(2)} lb</td>
      <td>${money(item.unit_price * item.quantity)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="cart order-details-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Price Each</th>
          <th>Qty</th>
          <th>Weight</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    ${showTotals ? `
      <div class="order-details-totals">
        <span>Subtotal: <strong>${money(order.subtotal)}</strong></span>
        <span>Total Weight: <strong>${Number(order.total_weight).toFixed(2)} lb</strong></span>
        <span>Delivery Fee: <strong>${money(order.delivery_fee)}</strong></span>
        <span>Sales Tax: <strong>${money(order.tax_amount)}</strong></span>
        <span>Order Total: <strong>${money(order.total_price)}</strong></span>
      </div>
    ` : ''}
  `;
}
