import { cartRequest, money } from '../cart-api.js';
import { setupFilters } from './catalog-filters.js';

const FALLBACK_IMAGE =
  'https://placehold.co/800x600/e6f1e8/2f6f3e?text=OFS+Product';

// General, non-brand-specific nutrition notes for the existing sample products.
// Exact calories and nutrition labels are not in the current Products database.
// These notes must NOT be used as substitutes for package nutrition/allergen labels.
const GENERAL_HEALTH_INFO = {
  'Organic Fuji Apples': 'Apples contain dietary fiber and naturally occurring sugars. Eating the peel provides additional fiber.',
  'Bananas': 'Bananas provide potassium, carbohydrates, and dietary fiber. Nutrient amounts vary with banana size.',
  'Whole Milk': 'Milk provides protein and calcium. Contains milk, a common food allergen.',
  'Large Brown Eggs': 'Eggs provide protein and choline. Contains egg, a common food allergen.',
  'Cheddar Cheese': 'Cheddar provides protein and calcium. Contains milk, a common food allergen.',
  'Chicken Breast': 'Chicken breast is a source of protein. Fat and calories depend on portion size and preparation.',
  'Ground Beef': 'Beef provides protein, iron, and vitamin B12. Fat content varies with the specific blend.',
  'Brown Rice': 'Brown rice is a whole grain that provides carbohydrates and dietary fiber.',
  'Spaghetti Pasta': 'Pasta supplies carbohydrates. Check the ingredient list for wheat, gluten, and other allergens.',
  'Tomato Pasta Sauce': 'Tomatoes contain lycopene. Sodium and added sugar levels depend on the recipe and brand.',
  'Potato Chips': 'Potato chips generally contain carbohydrates, fat, and sodium; amounts depend on the brand.',
  'Granola Bars': 'Granola bars can contain fiber and added sugar. Check the label for nuts, wheat, and other allergens.',
  'Orange Juice': 'Orange juice provides vitamin C and naturally occurring sugars, but has less fiber than whole oranges.',
  'Bottled Water': 'Plain, unsweetened water provides hydration without calories.',
  'Frozen Cheese Pizza': 'Cheese pizza typically contains milk and wheat. Sodium and saturated fat vary by recipe.',
  'Frozen Mixed Vegetables': 'Mixed vegetables provide fiber and assorted vitamins and minerals. Specific nutrients depend on the mix.'
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function imageUrlFor(product) {
  const value = String(product.image_url || '').trim();
  if (!value) return FALLBACK_IMAGE;
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : FALLBACK_IMAGE;
  } catch {
    return FALLBACK_IMAGE;
  }
}

function findCartItem(cart, productId) {
  return (cart.items || []).find((item) => Number(item.product_id) === Number(productId));
}

function cartQuantity(cart, productId) {
  return Number(findCartItem(cart, productId)?.quantity || 0);
}

function updateQuantityControls(controls, quantity, stock, price) {
  const input = controls.querySelector('.product-cart-quantity');
  input.value = String(quantity);
  input.dataset.confirmed = String(quantity);
  input.max = String(stock);
  const busy = controls.dataset.busy === 'true';
  input.disabled = busy || stock === 0;
  controls.querySelector('.decrease').disabled = busy || quantity <= 0;
  controls.querySelector('.increase').disabled = busy || quantity >= stock;
  const lineTotal = controls.parentElement.querySelector('.product-line-total');
  if (lineTotal) lineTotal.textContent = `In cart: ${money(price * quantity)}`;
}

function updateCartSummary(app, cart, isLoggedOut = false) {
  const totals = app.querySelector('#catalog-cart-totals');
  if (isLoggedOut) {
    totals.textContent = 'Log in to view your cart totals.';
    return;
  }
  const itemCount = (cart.items || []).reduce((total, item) => total + Number(item.quantity), 0);
  const subtotal = Number(cart.subtotal || 0);
  const estimatedTotal = Number(cart.total ?? (subtotal + Number(cart.deliveryFee || 0) + Number(cart.taxAmount || 0)));
  totals.innerHTML = `
    <span><strong>${itemCount}</strong> item${itemCount === 1 ? '' : 's'}</span>
    <span>Subtotal: <strong>${money(subtotal)}</strong></span>
    <span>Estimated total: <strong>${money(estimatedTotal)}</strong></span>
    <span>Weight: <strong>${cart.totalWeight} of ${cart.maxWeight} lb</strong></span>
  `;
}

function showStatus(message, text, success = false) {
  message.className = `message${success ? ' success' : ''}`;
  message.textContent = text;
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

    // The product catalog is public; signed-out visitors can still view details.
    let cart = { items: [], subtotal: 0, total: 0 };
    let isLoggedOut = false;
    try {
      cart = await cartRequest('GET', '/cart');
    } catch {
      isLoggedOut = true;
    }

    const productsById = new Map(products.map((product) => [Number(product.product_id), product]));

    const cards = products.map((product) => {
      const productId = Number(product.product_id);
      const stock = Number(product.quantity);
      const quantity = cartQuantity(cart, productId);
      const imageUrl = imageUrlFor(product);
      const name = escapeHtml(product.name);
      const stockMessage = stock === 0
        ? '<p class="low-stock">Out of stock</p>'
        : stock <= 5
          ? `<p class="low-stock">Only ${stock} left</p>`
          : '';

      return `
        <div class="card product-card">
          <button class="product-details-trigger product-image-trigger" type="button"
            data-product-id="${productId}" aria-label="View details for ${name}">
            <img class="product-image" src="${imageUrl}" alt="${name}"
              loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
          </button>
          <div class="card-content">
            <p class="product-category">${escapeHtml(product.category)}</p>
            <h2><button class="product-details-trigger product-name-trigger" type="button"
              data-product-id="${productId}">${name}</button></h2>
            <p class="muted">${escapeHtml(product.description)}</p>
            <p class="price">${money(product.price)}, ${Number(product.weight)} lb</p>
            ${stockMessage}
            <button class="product-details-trigger product-view-details" type="button"
              data-product-id="${productId}">View description &amp; health info</button>
          </div>
          <div class="product-purchase-area">
            <div class="product-cart-controls" data-product-id="${productId}">
              <button class="button small quantity-button decrease" type="button"
                aria-label="Remove one ${name}" ${quantity <= 0 ? 'disabled' : ''}>−</button>
              <input class="product-cart-quantity" type="number" inputmode="numeric"
                min="0" max="${stock}" step="1" value="${quantity}"
                data-confirmed="${quantity}" aria-label="Quantity of ${name}"
                ${stock === 0 ? 'disabled' : ''}>
              <button class="button small quantity-button increase" type="button"
                aria-label="Add one ${name}" ${quantity >= stock ? 'disabled' : ''}>+</button>
            </div>
            <p class="product-line-total">In cart: ${money(Number(product.price) * quantity)}</p>
          </div>
        </div>
      `;
    }).join('');

    app.innerHTML = `
      <h1>Shop</h1>
      <div class="catalog-cart-summary" role="region" aria-label="Shopping cart summary">
        <div class="catalog-cart-summary-heading">
          <strong>Your cart</strong>
          <a class="button small" href="#/cart">View Cart</a>
        </div>
        <div id="catalog-cart-totals" class="catalog-cart-totals" aria-live="polite"></div>
        <p id="message" class="message catalog-cart-message" role="status" aria-live="polite"></p>
      </div>
      <div class="grid">${cards}</div>
      <dialog id="product-detail-dialog" class="product-detail-dialog" aria-label="Product details">
        <button type="button" class="product-detail-close" aria-label="Close product details">×</button>
        <div class="product-detail-content"></div>
      </dialog>
    `;

    const message = app.querySelector('#message');
    const dialog = app.querySelector('#product-detail-dialog');
    const detailContent = dialog.querySelector('.product-detail-content');

    function syncCart(nextCart) {
      cart = nextCart;
      isLoggedOut = false;
      updateCartSummary(app, cart);
      for (const controls of app.querySelectorAll('.product-cart-controls')) {
        const product = productsById.get(Number(controls.dataset.productId));
        if (!product) continue;
        updateQuantityControls(
          controls,
          cartQuantity(cart, product.product_id),
          Number(product.quantity),
          Number(product.price)
        );
      }
    }

    updateCartSummary(app, cart, isLoggedOut);

    async function setQuantity(product, controls, requestedQuantity, delta = null) {
      if (controls.dataset.busy === 'true') return;
      const input = controls.querySelector('.product-cart-quantity');
      const oldQuantity = Number(input.dataset.confirmed);
      const stock = Number(product.quantity);

      if (delta === null && (!Number.isInteger(requestedQuantity) || requestedQuantity < 0 || requestedQuantity > stock)) {
        showStatus(message, `Enter a whole-number quantity from 0 to ${stock}.`);
        input.value = String(oldQuantity);
        return;
      }

      controls.dataset.busy = 'true';
      updateQuantityControls(controls, oldQuantity, stock, Number(product.price));

      try {
        // Read the latest cart to avoid using a stale cart_item_id or quantity.
        const latest = await cartRequest('GET', '/cart');
        const currentItem = findCartItem(latest, product.product_id);
        const currentQuantity = Number(currentItem?.quantity || 0);
        const newQuantity = delta === null ? requestedQuantity : currentQuantity + delta;

        if (!Number.isInteger(newQuantity) || newQuantity < 0 || newQuantity > stock) {
          throw new Error(`Only ${stock} available. Choose a quantity from 0 to ${stock}.`);
        }
        if (newQuantity === currentQuantity) {
          syncCart(latest);
          showStatus(message, 'Your cart is already at that quantity.', true);
          return;
        }

        let updated;
        if (newQuantity === 0) {
          updated = await cartRequest('DELETE', `/cart/items/${currentItem.cart_item_id}`);
        } else if (currentItem) {
          updated = await cartRequest('PUT', `/cart/items/${currentItem.cart_item_id}`, {
            quantity: newQuantity
          });
        } else {
          updated = await cartRequest('POST', '/cart/items', {
            productId: Number(product.product_id),
            quantity: newQuantity
          });
        }

        syncCart(updated);
        const difference = Number(updated.subtotal) - Number(latest.subtotal);
        const differenceText = `${difference >= 0 ? '+' : '−'}${money(Math.abs(difference))}`;
        showStatus(
          message,
          `${product.name}: ${currentQuantity} → ${newQuantity}. Subtotal change: ${differenceText}. New subtotal: ${money(updated.subtotal)}.`,
          true
        );
      } catch (error) {
        // Restore input from the server when possible (e.g. stock changed in another tab).
        try {
          syncCart(await cartRequest('GET', '/cart'));
        } catch {
          input.value = String(oldQuantity);
          updateCartSummary(app, cart, isLoggedOut);
        }
        showStatus(message, error.message);
      } finally {
        controls.dataset.busy = 'false';
        updateQuantityControls(
          controls,
          cartQuantity(cart, product.product_id),
          stock,
          Number(product.price)
        );
      }
    }

    for (const controls of app.querySelectorAll('.product-cart-controls')) {
      const product = productsById.get(Number(controls.dataset.productId));
      const input = controls.querySelector('.product-cart-quantity');

      controls.querySelector('.increase').addEventListener('click', () => {
        setQuantity(product, controls, null, 1);
      });
      controls.querySelector('.decrease').addEventListener('click', () => {
        setQuantity(product, controls, null, -1);
      });
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const quantity = raw === '' ? NaN : Number(raw);
        setQuantity(product, controls, quantity);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });
    }

    for (const trigger of app.querySelectorAll('.product-details-trigger')) {
      trigger.addEventListener('click', () => {
        const product = productsById.get(Number(trigger.dataset.productId));
        if (!product) return;
        const stock = Number(product.quantity);
        const healthInfo = GENERAL_HEALTH_INFO[product.name]
          || 'Detailed nutrition information has not been added for this product.';

        detailContent.innerHTML = `
          <div class="product-detail-layout">
            <img src="${imageUrlFor(product)}" alt="${escapeHtml(product.name)}"
              onerror="this.onerror=null;this.src='${FALLBACK_IMAGE}'">
            <div>
              <p class="product-category">${escapeHtml(product.category)}</p>
              <h2>${escapeHtml(product.name)}</h2>
              <p class="price">${money(product.price)} · ${Number(product.weight)} lb</p>
              <h3>Description</h3>
              <p>${escapeHtml(product.description || 'No description available.')}</p>
              <h3>Health &amp; nutrition</h3>
              <p>${escapeHtml(healthInfo)}</p>
              <p class="muted product-detail-disclaimer">General information only. Exact calories,
                serving size, ingredients, and allergen details are not available in this catalog.
                Check the product packaging for accurate information.</p>
              <p class="${stock <= 5 ? 'low-stock' : 'muted'}">
                ${stock === 0 ? 'Out of stock' : stock <= 5 ? `Only ${stock} left` : `${stock} in stock`}
              </p>
            </div>
          </div>
        `;
        dialog.showModal();
      });
    }

    dialog.querySelector('.product-detail-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    // Keep existing search, category filters and sorting working as before.
    setupFilters(app, products);
  }
};