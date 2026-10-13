// TODO: filter by category (fruits, vegetables, pantry)

import { getUser, cartRequest, money } from '../cart-api.js';

export default {
  title: 'Shop',
  async show(app) {
    const response = await fetch('/products');
    const products = await response.json();

    if (products.length === 0) {
      app.innerHTML = '<h1>Shop</h1><p class="muted">No products yet.</p>';
      return;
    }

    let cards = '';
    for (const product of products) {
      const inStock = product.quantity > 0;
      cards += `
        <div class="card">
          <h2>${product.name}</h2>
          <p class="muted">${product.description}</p>
          <p class="price">${money(product.price)}, ${Number(product.weight)} lb</p>
          <button class="button primary add" data-id="${product.product_id}" ${inStock ? '' : 'disabled'}>
            ${inStock ? 'Add to Cart' : 'Out of Stock'}
          </button>
        </div>
      `;
    }

    app.innerHTML = `
      <h1>Shop</h1>
      <p id="message" class="message"></p>
      <div class="grid">${cards}</div>
    `;

    const message = document.getElementById('message');

    for (const button of app.querySelectorAll('.add')) {
      button.addEventListener('click', async () => {
        if (!getUser()) {
          message.textContent = 'Please log in to add items to your cart.';
          return;
        }
        try {
          const cart = await cartRequest('POST', '/cart/items', { productId: Number(button.dataset.id), quantity: 1 });
          message.textContent = `Added to cart. Cart total is ${money(cart.subtotal)}, ${cart.totalWeight} lb.`;
        } catch (err) {
          message.textContent = err.message;
        }
      });
    }
  },
};
