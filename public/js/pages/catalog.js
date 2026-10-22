// TODO: filter by category (fruits, vegetables, pantry)

import { cartRequest, money } from '../cart-api.js';

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

    const cards = products.map((product) => {
      const inStock = Number(product.quantity) > 0;
      const imageUrl = escapeHtml(product.image_url || FALLBACK_IMAGE);

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
          </div>
          <button
            class="button primary add"
            data-id="${Number(product.product_id)}"
            ${inStock ? '' : 'disabled'}
          >
            ${inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      `;
    }).join('');

    app.innerHTML = `
      <h1>Shop</h1>
      <p id="message" class="message"></p>
      <div class="grid">${cards}</div>
    `;

    const message = app.querySelector('#message');

    for (const button of app.querySelectorAll('.add')) {
      button.addEventListener('click', async () => {
        try {
          const cart = await cartRequest('POST', '/cart/items', {
            productId: Number(button.dataset.id),
            quantity: 1
          });

          message.textContent =
            `Added to cart. Cart total is ${money(cart.subtotal)}, ` +
            `${cart.totalWeight} lb.`;
        } catch (error) {
          message.textContent = error.message;
        }
      });
    }
  }
};
