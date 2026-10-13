import { getUser, cartRequest, money } from '../cart-api.js';

export default {
  title: 'Cart',
  async show(app) {
    if (!getUser()) {
      app.innerHTML = `
        <h1>Your Cart</h1>
        <p class="muted">Please log in to see your cart.</p>
        <a class="button primary" href="#/login">Log In</a>
      `;
      return;
    }

    try {
      draw(app, await cartRequest('GET', '/cart'));
    } catch (err) {
      app.innerHTML = `<h1>Your Cart</h1><p class="message">${err.message}</p>`;
    }
  },
};

function draw(app, cart, note = '') {
  if (cart.items.length === 0) {
    app.innerHTML = `
      <h1>Your Cart</h1>
      <p class="message">${note}</p>
      <p class="muted">Your cart is empty.</p>
      <a class="button primary" href="#/catalog">Go Shopping</a>
    `;
    return;
  }

  let rows = '';
  for (const item of cart.items) {
    rows += `
      <tr>
        <td>${item.name}</td>
        <td>${money(item.price)}</td>
        <td>
          <button class="button small change" data-id="${item.cart_item_id}" data-qty="${item.quantity - 1}"
            ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
          ${item.quantity}
          <button class="button small change" data-id="${item.cart_item_id}" data-qty="${item.quantity + 1}"
            ${item.quantity >= item.stock ? 'disabled' : ''}>+</button>
        </td>
        <td>${(item.weight * item.quantity).toFixed(2)} lb</td>
        <td>${money(item.price * item.quantity)}</td>
        <td><button class="button small remove" data-id="${item.cart_item_id}">Remove</button></td>
      </tr>
    `;
  }

  let feeNote = `Free delivery. You can add ${(20 - cart.totalWeight).toFixed(2)} more lb before the $10 fee.`;
  if (cart.deliveryFee > 0) {
    feeNote = 'Your order is 20 lb or more, so a $10 delivery fee applies.';
  }

  app.innerHTML = `
    <h1>Your Cart</h1>
    <p class="message">${note}</p>
    <table class="cart">
      <tr><th>Item</th><th>Price</th><th>Quantity</th><th>Weight</th><th>Total</th><th></th></tr>
      ${rows}
    </table>

    <div class="card summary">
      <p>Subtotal: <b>${money(cart.subtotal)}</b></p>
      <p>Total weight: <b>${cart.totalWeight} lb</b></p>
      <p>Delivery fee: <b>${money(cart.deliveryFee)}</b></p>
      <p class="muted">${feeNote}</p>
    </div>

    <div class="buttons">
      <a class="button" href="#/catalog">Keep Shopping</a>
      <a class="button primary" href="#/checkout">Checkout</a>
    </div>
  `;

  for (const button of app.querySelectorAll('.change')) {
    button.addEventListener('click', () => update(app, 'PUT', button.dataset.id, { quantity: Number(button.dataset.qty) }));
  }
  for (const button of app.querySelectorAll('.remove')) {
    button.addEventListener('click', () => update(app, 'DELETE', button.dataset.id));
  }
}

async function update(app, method, id, body) {
  try {
    draw(app, await cartRequest(method, `/cart/items/${id}`, body));
  } catch (err) {
    draw(app, await cartRequest('GET', '/cart'), err.message);
  }
}
