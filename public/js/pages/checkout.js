import { cartRequest, money } from '../cart-api.js';
import { getUser } from '../user.js';

export default {
  title: 'Checkout',
  async show(app) {
    const user = await getUser();
    if (!user) {
      app.innerHTML = `
        <h1>Checkout</h1>
        <p class="muted">Please log in to complete your checkout.</p>
        <a class="button primary" href="#/login">Log In</a>
      `;
      return;
    }

    try {
      const cart = await cartRequest('GET', '/cart');
      if (!cart.items || cart.items.length === 0) {
        app.innerHTML = `
          <h1>Checkout</h1>
          <p class="muted">Your cart is empty. Add items from the shop before checking out.</p>
          <a class="button primary" href="#/catalog">Go Shopping</a>
        `;
        return;
      }
      renderCheckout(app, cart);
    } catch (err) {
      app.innerHTML = `<h1>Checkout</h1><p class="message">${err.message}</p>`;
    }
  },
};

function renderCheckout(app, cart, errorMessage = '') {
  let rows = '';
  for (const item of cart.items) {
    rows += `
      <tr>
        <td>${item.name}</td>
        <td>${money(item.price)}</td>
        <td>${item.quantity}</td>
        <td>${(item.weight * item.quantity).toFixed(2)} lb</td>
        <td>${money(item.price * item.quantity)}</td>
      </tr>
    `;
  }

  const feeNote = cart.deliveryFee > 0
    ? 'Your order is 20 lb or more ($10 delivery fee applied).'
    : 'Free delivery applied (under 20 lb threshold).';

  app.innerHTML = `
    <h1>Checkout</h1>
    ${errorMessage ? `<p class="message" id="checkout-error">${errorMessage}</p>` : '<p class="message" id="checkout-error"></p>'}

    <div style="display: flex; flex-wrap: wrap; gap: 24px;">
      <!-- Order Summary Column -->
      <div style="flex: 1; min-width: 320px;">
        <h2>Order Summary</h2>
        <table class="cart">
          <tr><th>Item</th><th>Price</th><th>Qty</th><th>Weight</th><th>Total</th></tr>
          ${rows}
        </table>

        <div class="card summary" style="max-width: 100%;">
          <p>Product Subtotal: <b>${money(cart.subtotal)}</b></p>
          <p>Total Weight: <b>${cart.totalWeight} lb</b></p>
          <p>Delivery Fee: <b>${money(cart.deliveryFee)}</b></p>
          <p class="muted" style="font-size: 13px;">${feeNote}</p>
          <p>Sales Tax (${((cart.taxRate || 0.09375) * 100).toFixed(2)}%): <b>${money(cart.taxAmount)}</b></p>
          <hr style="border:0; border-top:1px solid #d5e2d8; margin: 10px 0;">
          <p style="font-size: 18px;">Total to Pay: <b>${money(cart.total)}</b></p>
        </div>
      </div>

      <!-- Shipping & Payment Column -->
      <div style="flex: 1; min-width: 320px;">
        <h2>Delivery Address</h2>
        <div class="card" style="margin-bottom: 20px;">
          <p class="muted" style="margin-top: 0; font-size: 14px;">
            We deliver exclusively within <b>Downtown San Jose</b> (ZIPs 95110, 95112, 95113, 95116, 95192).
          </p>
          <div style="margin-bottom: 12px;">
            <label for="address-input" style="display: block; font-weight: bold; margin-bottom: 6px;">Street Address</label>
            <input id="address-input" type="text" style="width: 100%; padding: 10px; border: 1px solid #2f6f3e; border-radius: 6px;"
              placeholder="e.g. 1 Washington Sq, San Jose, CA 95192" value="1 Washington Sq, San Jose, CA 95192">
          </div>
        </div>

        <h2>Payment Information</h2>
        <div class="card" style="margin-bottom: 20px;">
          <p class="muted" style="margin-top: 0; font-size: 13px;">
            Stripe Test Mode Simulation (card details are processed securely and never saved unhashed).
          </p>
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-weight: bold; margin-bottom: 4px;">Cardholder Name</label>
            <input id="card-name" type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;"
              placeholder="Full Name" value="Test Customer">
          </div>
          <div style="margin-bottom: 10px;">
            <label style="display: block; font-weight: bold; margin-bottom: 4px;">Card Number</label>
            <input id="card-number" type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;"
              placeholder="4242 •••• •••• 4242" value="4242 4242 4242 4242">
          </div>
          <div style="display: flex; gap: 10px; margin-bottom: 14px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: bold; margin-bottom: 4px;">Expires</label>
              <input type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;"
                placeholder="MM/YY" value="12/28">
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: bold; margin-bottom: 4px;">CVC</label>
              <input type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 6px;"
                placeholder="CVC" value="123">
            </div>
          </div>

          <div style="background: #f0f7f1; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 10px;">
            <label style="display: flex; align-items: center; cursor: pointer; gap: 8px;">
              <input id="test-decline" type="checkbox">
              <span><b>Test Scenario:</b> Simulate card decline (tests error handling & cart preservation)</span>
            </label>
          </div>
        </div>

        <div class="buttons">
          <button id="place-order-btn" class="button primary" style="width: 100%; padding: 12px; font-size: 17px;">
            Place Order (${money(cart.total)})
          </button>
          <a class="button" href="#/cart" style="text-align: center; width: 100%;">Back to Cart</a>
        </div>
      </div>
    </div>
  `;

  const placeBtn = app.querySelector('#place-order-btn');
  placeBtn.addEventListener('click', async () => {
    const address = app.querySelector('#address-input').value.trim();
    const cardNumber = app.querySelector('#card-number').value.trim();
    const simulateDecline = app.querySelector('#test-decline').checked;
    const errorEl = app.querySelector('#checkout-error');

    if (!address) {
      errorEl.textContent = 'Please provide a valid delivery address.';
      return;
    }

    placeBtn.disabled = true;
    placeBtn.textContent = 'Processing Payment...';
    errorEl.textContent = '';

    try {
      const result = await cartRequest('POST', '/checkout', {
        delivery_address: address,
        card_number: cardNumber,
        simulate_decline: simulateDecline
      });

      renderConfirmation(app, result);
    } catch (err) {
      placeBtn.disabled = false;
      placeBtn.textContent = `Place Order (${money(cart.total)})`;
      errorEl.textContent = err.message;
    }
  });
}

function renderConfirmation(app, order) {
  app.innerHTML = `
    <h1>Order Confirmed!</h1>
    <div class="hero" style="border-left: 5px solid #2f6f3e;">
      <h2>Thank you for your order!</h2>
      <p style="font-size: 16px;">
        Order <b>#${order.order_id}</b> has been received and is now <b>Pending</b> in our downtown packing queue.
      </p>
    </div>

    <div class="card summary" style="max-width: 480px; margin-bottom: 24px;">
      <p>Order ID: <b>#${order.order_id}</b></p>
      <p>Initial Status: <b style="color: #2f6f3e;">${order.status}</b></p>
      <p>Total Weight: <b>${order.total_weight} lb</b></p>
      <p>Subtotal: <b>${money(order.subtotal)}</b></p>
      <p>Delivery Fee: <b>${money(order.delivery_fee)}</b></p>
      <p>Sales Tax: <b>${money(order.tax_amount)}</b></p>
      <hr style="border:0; border-top:1px solid #d5e2d8; margin: 8px 0;">
      <p style="font-size: 18px;">Total Paid: <b>${money(order.total_price)}</b></p>
    </div>

    <div class="buttons">
      <a class="button primary" href="#/orders">View My Orders</a>
      <a class="button" href="#/catalog">Continue Shopping</a>
    </div>
  `;
}
