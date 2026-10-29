import { cartRequest, money } from '../cart-api.js';
import {setupFilters} from './catalog-filters.js';

const FALLBACK_IMAGE =
  'https://placehold.co/800x600/e6f1e8/2f6f3e?text=OFS+Product';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default {
  title: 'Shop',

  async show(app) {
    const response = await fetch('/products');

    if (!response.ok) {
      app.innerHTML = '<h1>Shop</h1><p class="message">Could not load products.</p>';
      return;
    }

    const products = await response.json();

    if (products.length === 0) {
      app.innerHTML = '<h1>Shop</h1><p class="muted">No products yet.</p>';
      return;
    }

    // A logged-out visitor will get a 401 here. That is fine: the controls
    // will still render, and the add/remove request will explain that login is
    // required if they click one.
    let cart = { items: [] };
    try {
      cart = await cartRequest('GET', '/cart');
    } catch {
      // The shop is public, so do not prevent it from loading without a cart.
    }

    const cartItems = new Map(
      (cart.items || []).map((item) => [Number(item.product_id), item])
    );

    const cards = products.map((product) => {
      const stock = Number(product.quantity);
      const imageUrl = escapeHtml(product.image_url || FALLBACK_IMAGE);
      const cartItem = cartItems.get(Number(product.product_id));
      const cartQuantity = cartItem ? Number(cartItem.quantity) : 0;
      const stockMessage = stock === 0
        ? '<p class="low-stock">Out of stock</p>'
        : stock <= 5
          ? `<p class="low-stock">Only ${stock} left</p>`
          : '';

      return `
        <div class="card product-card">
          <img
            class="product-image"
            src="${imageUrl}"
            alt="${escapeHtml(product.name)}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'"
          >
          <div class="card-content">
            <p class="product-category">${escapeHtml(product.category)}</p>
            <h2>${escapeHtml(product.name)}</h2>
            <p class="muted">${escapeHtml(product.description)}</p>
            <p class="price">
              ${money(product.price)}, ${Number(product.weight)} lb
            </p>
            ${stockMessage}
          </div>
          <div class="product-cart-controls" data-product-id="${Number(product.product_id)}">
            <button
              class="button small quantity-button decrease"
              type="button"
              aria-label="Remove one ${escapeHtml(product.name)}"
              ${cartQuantity > 0 ? '' : 'disabled'}
            >−</button>
            <span class="product-cart-quantity" aria-live="polite">${cartQuantity}</span>
            <button
              class="button small quantity-button increase"
              type="button"
              aria-label="Add one ${escapeHtml(product.name)}"
              ${stock > cartQuantity ? '' : 'disabled'}
            >+</button>
          </div>
        </div>
      `;
    }).join('');

    app.innerHTML = `
      <h1>Shop</h1>
      <p id="message" class="message"></p>
      <div class="grid">${cards}</div>
    `;

    const message = app.querySelector('#message');

    for (const controls of app.querySelectorAll('.product-cart-controls')) {
      const productId = Number(controls.dataset.productId);
      const product = products.find((item) => Number(item.product_id) === productId);

      controls.querySelector('.increase').addEventListener('click', async () => {
        await changeProductQuantity(product, 1, controls, message);
      });

      controls.querySelector('.decrease').addEventListener('click', async () => {
        await changeProductQuantity(product, -1, controls, message);
      });
    }
    setupFilters(app, products);
  }
};

async function changeProductQuantity(product, change, controls, message) {
  const productId = Number(product.product_id);
  const quantityElement = controls.querySelector('.product-cart-quantity');
  const increaseButton = controls.querySelector('.increase');
  const decreaseButton = controls.querySelector('.decrease');
  const currentQuantity = Number(quantityElement.textContent);
  const nextQuantity = currentQuantity + change;

  if (nextQuantity < 0 || nextQuantity > Number(product.quantity)) {
    return;
  }

  increaseButton.disabled = true;
  decreaseButton.disabled = true;

  try {
    let cart;
    if (change > 0) {
      cart = await cartRequest('POST', '/cart/items', {
        productId,
        quantity: 1
      });
    } else {
      // We need the cart item id for the PUT/DELETE endpoints. Fetching the
      // cart also handles a cart that changed in another browser tab.
      const currentCart = await cartRequest('GET', '/cart');
      const item = currentCart.items.find((cartItem) => Number(cartItem.product_id) === productId);
      if (!item) {
        updateQuantityControls(controls, 0, Number(product.quantity));
        return;
      }

      cart = nextQuantity === 0
        ? await cartRequest('DELETE', `/cart/items/${item.cart_item_id}`)
        : await cartRequest('PUT', `/cart/items/${item.cart_item_id}`, { quantity: nextQuantity });
    }

    const item = cart.items.find((cartItem) => Number(cartItem.product_id) === productId);
    updateQuantityControls(controls, item ? Number(item.quantity) : 0, Number(product.quantity));
    message.className = 'message success';
    message.textContent = `Cart updated. Subtotal is ${money(cart.subtotal)}.`;
  } catch (error) {
    updateQuantityControls(controls, currentQuantity, Number(product.quantity));
    message.className = 'message';
    message.textContent = error.message;
  }
}

function updateQuantityControls(controls, quantity, stock) {
  controls.querySelector('.product-cart-quantity').textContent = quantity;
  controls.querySelector('.decrease').disabled = quantity <= 0;
  controls.querySelector('.increase').disabled = quantity >= stock;
}
