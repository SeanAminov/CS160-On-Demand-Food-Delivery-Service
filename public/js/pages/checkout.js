import { cartRequest, money } from '../cart-api.js';
import { getUser } from '../user.js';
import { addressFields, readAddress } from '../address-form.js';

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

      // Fill in the address saved on their account, if they have one
      let savedAddress = null;
      try {
        const data = await cartRequest('GET', '/profile/address');
        savedAddress = data.parts;
      } catch {
        // No saved address, so the boxes just start empty
      }

      // The publishable key lets the page show Stripe's card box
      const { publishableKey } = await cartRequest('GET', '/stripe-key');

      renderCheckout(app, cart, savedAddress, publishableKey);
    } catch (err) {
      app.innerHTML = `<h1>Checkout</h1><p class="message">${err.message}</p>`;
    }
  },
};

function renderCheckout(app, cart, savedAddress, publishableKey, errorMessage = '') {
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
          ${addressFields(savedAddress)}
          <label style="display: flex; align-items: center; cursor: pointer; gap: 8px; font-size: 14px; margin-top: 12px;">
            <input id="save-address" type="checkbox" ${savedAddress ? '' : 'checked'}>
            <span>Save this address to my account</span>
          </label>
        </div>

        <h2>Payment Information</h2>
        <div class="card" style="margin-bottom: 20px;">
          <p class="muted" style="margin-top: 0; font-size: 13px;">
            Card details go straight to Stripe and never touch our server. This is Stripe test mode, so no real money is charged.
          </p>
          <label style="display: block; font-weight: bold; margin-bottom: 6px;">Card</label>
          <div id="card-element" style="padding: 12px; border: 1px solid #ccc; border-radius: 6px; background: white;"></div>
          <p class="message" id="card-error" style="font-size: 14px;"></p>

          <div style="background: #f0f7f1; padding: 10px; border-radius: 6px; font-size: 13px; line-height: 1.6;">
            <b>Test card (Stripe test mode)</b><br>
            Card number: 4242 4242 4242 4242, or 4000 0000 0000 0002 to test a declined card<br>
            Expiration: any month and year in the future, like 12 / 34<br>
            CVC: any 3 digits, like 123
          </div>
        </div>

        <p class="message" id="checkout-error">${errorMessage}</p>
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
  const errorEl = app.querySelector('#checkout-error');

  // Stripe's card box lives on Stripe's own servers, so the card number typed
  // into it goes straight to Stripe and our code never sees it
  if (!publishableKey || !window.Stripe) {
    errorEl.textContent = 'Payments are not set up on this computer yet. Add the Stripe keys to .env and restart the server.';
    placeBtn.disabled = true;
    return;
  }
  const stripe = window.Stripe(publishableKey);
  // The delivery address already has a ZIP box, so the card box doesn't ask for another one
  const card = stripe.elements().create('card', { hidePostalCode: true, style: { base: { fontSize: '16px' } } });
  card.mount('#card-element');

  // Stripe checks the card while it's typed, so show what's wrong right away,
  // like an expiration date that's already passed
  const cardError = app.querySelector('#card-error');
  card.on('change', (event) => {
    cardError.textContent = event.error ? event.error.message : '';
  });

  placeBtn.addEventListener('click', async () => {
    const address = readAddress(app);
    const saveAddress = app.querySelector('#save-address').checked;

    if (!address.street || !address.zip) {
      errorEl.textContent = 'Please fill in your street address and ZIP code.';
      return;
    }

    placeBtn.disabled = true;
    placeBtn.textContent = 'Processing Payment...';
    errorEl.textContent = '';

    try {
      // Stripe turns the card into a payment method ID, and only that ID comes to our server
      const { paymentMethod, error } = await stripe.createPaymentMethod({ type: 'card', card });
      if (error) {
        throw new Error(error.message);
      }

      const result = await cartRequest('POST', '/checkout', {
        delivery_address: address,
        payment_method_id: paymentMethod.id
      });

      if (saveAddress) {
        try {
          await cartRequest('PUT', '/profile/address', address);
        } catch {
          // The order still went through, so there's no need to show an error for this
        }
      }

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
