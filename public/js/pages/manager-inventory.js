import { escapeHtml } from '../cart-api.js';
import { managerNavigation } from '../manager-nav.js';

let inventoryItems = [];
let pendingChanges = {};
let showLowStockOnly = false;
// The product being edited ('new' while adding one), and what's been typed into its form so far
let editingProductId = null;
let editDraft = null;

function getPendingQuantity(item) {
  return item.quantity + (pendingChanges[item.product_id] || 0);
}

// A product is low on stock once its saved quantity reaches its reorder level
function isLowStock(item) {
  return item.quantity <= item.reorder_level;
}

function openProductEditor(productId) {
  const item = inventoryItems.find(
    (currentItem) => currentItem.product_id === productId
  );

  editingProductId = productId;
  editDraft = {
    name: item.name,
    category: item.category,
    description: item.description || '',
    price: Number(item.price).toFixed(2),
    weight: Number(item.weight).toFixed(2),
    reorder_level: item.reorder_level,
    image_url: item.image_url || '',
  };
}

function openNewProductForm() {
  editingProductId = 'new';
  editDraft = {
    name: '',
    category: '',
    description: '',
    price: '',
    weight: '',
    reorder_level: 10,
    image_url: '',
    quantity: 0,
  };
}

function closeProductEditor() {
  editingProductId = null;
  editDraft = null;
}

function renderEditRow() {
  const isNew = editingProductId === 'new';
  const categories = [
    ...new Set(inventoryItems.map((item) => item.category)),
  ].sort();

  return `
    <tr class="product-edit-row">
      <td colspan="6">
        <form id="product-edit-form" class="product-edit-form" novalidate>
          <div class="product-edit-wide">
            <label for="edit-name">Name</label>
            <input
              id="edit-name"
              name="name"
              type="text"
              maxlength="150"
              value="${escapeHtml(editDraft.name)}"
            >
          </div>

          <div>
            <label for="edit-category">Category</label>
            <input
              id="edit-category"
              name="category"
              type="text"
              maxlength="100"
              list="edit-category-list"
              value="${escapeHtml(editDraft.category)}"
            >
            <datalist id="edit-category-list">
              ${categories
                .map(
                  (category) => `<option value="${escapeHtml(category)}"></option>`
                )
                .join('')}
            </datalist>
          </div>

          <div>
            <label for="edit-price">Price ($)</label>
            <input
              id="edit-price"
              name="price"
              type="number"
              min="0.50"
              step="0.01"
              value="${escapeHtml(editDraft.price)}"
            >
          </div>

          <div>
            <label for="edit-weight">Weight (lb)</label>
            <input
              id="edit-weight"
              name="weight"
              type="number"
              min="0.01"
              step="0.01"
              value="${escapeHtml(editDraft.weight)}"
            >
          </div>

          <div>
            <label for="edit-reorder">Low Stock At</label>
            <input
              id="edit-reorder"
              name="reorder_level"
              type="number"
              min="0"
              step="1"
              value="${escapeHtml(editDraft.reorder_level)}"
            >
          </div>

          ${
            isNew
              ? `
                <div>
                  <label for="edit-quantity">Starting Stock</label>
                  <input
                    id="edit-quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHtml(editDraft.quantity)}"
                  >
                </div>
              `
              : ''
          }

          <div class="product-edit-wide">
            <label for="edit-description">Description</label>
            <textarea
              id="edit-description"
              name="description"
              rows="2"
              maxlength="1000"
            >${escapeHtml(editDraft.description)}</textarea>
          </div>

          <div class="product-edit-wide">
            <label for="edit-image">Photo Link</label>
            <input
              id="edit-image"
              name="image_url"
              type="text"
              maxlength="500"
              value="${escapeHtml(editDraft.image_url)}"
            >
          </div>

          ${
            isNew
              ? ''
              : `
                <p class="muted product-edit-wide product-edit-note">
                  Orders already placed keep the price and weight they were bought at.
                </p>
              `
          }

          <p id="product-edit-error" class="message product-edit-wide"></p>

          <div class="buttons product-edit-wide product-edit-actions">
            <button id="product-edit-save" class="button primary" type="submit">
              ${isNew ? 'Add Product' : 'Save Changes'}
            </button>

            <button id="product-edit-cancel" class="button" type="button">
              Cancel
            </button>
          </div>
        </form>
      </td>
    </tr>
  `;
}

function renderInventory(app) {
  const pendingEntries = Object.entries(pendingChanges).filter(
    ([, change]) => change !== 0
  );

  const lowStockCount = inventoryItems.filter(isLowStock).length;

  const visibleItems = showLowStockOnly
    ? inventoryItems.filter(isLowStock)
    : inventoryItems;

  app.innerHTML = `
    <section class="hero">
      <h1>Products and Inventory</h1>

      <p class="muted">
        Change product details and adjust stock.
      </p>
    </section>

    ${managerNavigation('#/manager-inventory')}

    <div class="inventory-workspace">
      <section class="card inventory-table-card">
        <div class="manager-section-header">
          <div>
            <h2>Products</h2>

            <p class="muted">
              Add a product, or click Edit to change a product's price, name, weight, and more.
            </p>
          </div>

          <div class="inventory-header-tools">
            <span class="inventory-count">
              ${inventoryItems.length} products,
              ${lowStockCount} low on stock
            </span>

            <button
              id="low-stock-toggle"
              class="button"
              type="button"
            >
              ${showLowStockOnly ? 'Show All Products' : 'Show Low Stock Only'}
            </button>

            <button
              id="add-product-button"
              class="button primary"
              type="button"
            >
              ${editingProductId === 'new' ? 'Close New Product' : 'Add Product'}
            </button>
          </div>
        </div>

        <p id="product-message" class="message"></p>

        <div class="inventory-table-wrapper">
          <table class="inventory-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Weight</th>
                <th>Quantity</th>
                <th>Adjust</th>
              </tr>
            </thead>

            <tbody>
              ${editingProductId === 'new' ? renderEditRow() : ''}

              ${
                visibleItems.length === 0
                  ? `
                    <tr>
                      <td colspan="6" class="muted">
                        No products are low on stock right now.
                      </td>
                    </tr>
                  `
                  : ''
              }

              ${visibleItems
                .map(
                  (item) => `
                    <tr>
                      <td>
                        <strong>${item.name}</strong>
                      </td>

                      <td>
                        ${item.category || '—'}
                      </td>

                      <td>
                        $${Number(item.price || 0).toFixed(2)}
                      </td>

                      <td>
                        ${Number(item.weight || 0).toFixed(2)} lb
                      </td>

                      <td>
                        <input
                          class="inventory-quantity-input"
                          type="number"
                          min="0"
                          step="1"
                          data-product-id="${item.product_id}"
                          value="${getPendingQuantity(item)}"
                          aria-label="Quantity for ${item.name}"
                        >

                        ${
                          pendingChanges[item.product_id]
                            ? `
                              <span class="pending-quantity-label">
                                pending
                              </span>
                            `
                            : ''
                        }

                        ${
                          isLowStock(item)
                            ? `
                              <span class="low-stock-label">
                                Low stock (reorder at ${item.reorder_level})
                              </span>
                            `
                            : ''
                        }
                      </td>

                      <td>
                        <div class="inventory-controls">
                          <button
                            class="inventory-adjust-button"
                            data-action="decrease"
                            data-product-id="${item.product_id}"
                            type="button"
                          >
                            −
                          </button>

                          <button
                            class="inventory-adjust-button"
                            data-action="increase"
                            data-product-id="${item.product_id}"
                            type="button"
                          >
                            +
                          </button>

                          <button
                            class="button small product-edit-button"
                            data-product-id="${item.product_id}"
                            type="button"
                          >
                            ${item.product_id === editingProductId ? 'Close' : 'Edit'}
                          </button>

                          <button
                            class="button small product-remove-button"
                            data-product-id="${item.product_id}"
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>

                    ${item.product_id === editingProductId ? renderEditRow() : ''}
                  `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card pending-inventory-card">
        <div class="pending-inventory-header">
          <div>
            <h2>Quantity Changes</h2>

            <p class="muted">
              Review changes before updating the database.
            </p>
          </div>

          <span class="pending-count">
            ${pendingEntries.length} pending
          </span>
        </div>

        ${
          pendingEntries.length === 0
            ? `
              <p class="muted">
                No quantity changes have been selected.
              </p>
            `
            : `
              <div class="pending-inventory-list">
                ${pendingEntries
                  .map(([productId, change]) => {
                    const item = inventoryItems.find(
                      (currentItem) =>
                        String(currentItem.product_id) ===
                        String(productId)
                    );

                    if (!item) {
                      return '';
                    }

                    const newQuantity =
                      getPendingQuantity(item);

                    const changeLabel =
                      change > 0 ? `+${change}` : change;

                    return `
                      <div class="pending-inventory-row">
                        <strong>${item.name}</strong>

                        <span>
                          ${item.quantity}
                          →
                          ${newQuantity}
                        </span>

                        <span class="pending-change-value">
                          ${changeLabel}
                        </span>

                        <button
                          class="button pending-remove-button"
                          data-product-id="${item.product_id}"
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    `;
                  })
                  .join('')}
              </div>

              <div class="pending-inventory-actions">
                <button
                  id="clear-inventory-button"
                  class="button"
                  type="button"
                >
                  Clear Changes
                </button>

                <button
                  id="confirm-inventory-button"
                  class="button primary"
                  type="button"
                >
                  Confirm Updates
                </button>
              </div>
            `
        }

        <p id="inventory-message" class="inventory-message">
          Changes are not saved until you select Confirm Updates.
        </p>
      </section>
    </div>
  `;

  bindInventoryEvents(app);
}

function bindInventoryEvents(app) {
  app
    .querySelectorAll('.inventory-adjust-button')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const productId = button.dataset.productId;
        const action = button.dataset.action;
        const change = action === 'increase' ? 1 : -1;

        const item = inventoryItems.find(
          (currentItem) =>
            String(currentItem.product_id) ===
            String(productId)
        );

        if (!item) {
          return;
        }

        const currentPendingChange =
          pendingChanges[productId] || 0;

        const newPendingChange =
          currentPendingChange + change;

        const newQuantity =
          item.quantity + newPendingChange;

        if (newQuantity < 0) {
          return;
        }

        if (newPendingChange === 0) {
          delete pendingChanges[productId];
        } else {
          pendingChanges[productId] = newPendingChange;
        }

        renderInventory(app);
      });
    });

  // Typing an amount works like pressing + or - that many times.
  // It becomes a pending change until Confirm Updates is pressed.
  app
    .querySelectorAll('.inventory-quantity-input')
    .forEach((input) => {
      input.addEventListener('change', () => {
        const productId = input.dataset.productId;

        const item = inventoryItems.find(
          (currentItem) =>
            String(currentItem.product_id) ===
            String(productId)
        );

        const typedQuantity = Number(input.value);

        // Only whole numbers of 0 or more. Anything else puts the box back.
        if (
          !item ||
          input.value.trim() === '' ||
          !Number.isInteger(typedQuantity) ||
          typedQuantity < 0
        ) {
          renderInventory(app);
          return;
        }

        const change = typedQuantity - item.quantity;

        if (change === 0) {
          delete pendingChanges[productId];
        } else {
          pendingChanges[productId] = change;
        }

        renderInventory(app);
      });
    });

  app
    .querySelectorAll('.product-edit-button')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const productId = Number(button.dataset.productId);

        if (productId === editingProductId) {
          closeProductEditor();
        } else {
          openProductEditor(productId);
        }

        renderInventory(app);
      });
    });

  app
    .querySelector('#add-product-button')
    .addEventListener('click', () => {
      if (editingProductId === 'new') {
        closeProductEditor();
      } else {
        openNewProductForm();
      }

      renderInventory(app);
    });

  app
    .querySelectorAll('.product-remove-button')
    .forEach((button) => {
      button.addEventListener('click', () => {
        removeProduct(app, Number(button.dataset.productId));
      });
    });

  const editForm = app.querySelector('#product-edit-form');

  if (editForm) {
    // Keep what's been typed, since pressing + or - on any product redraws the page
    editForm.addEventListener('input', (event) => {
      editDraft[event.target.name] = event.target.value;
    });

    editForm.addEventListener('submit', (event) => {
      event.preventDefault();
      saveProductChanges(app);
    });

    app
      .querySelector('#product-edit-cancel')
      .addEventListener('click', () => {
        closeProductEditor();
        renderInventory(app);
      });
  }

  const lowStockToggle = app.querySelector('#low-stock-toggle');

  lowStockToggle.addEventListener('click', () => {
    showLowStockOnly = !showLowStockOnly;
    renderInventory(app);
  });

  app
    .querySelectorAll('.pending-remove-button')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const productId = button.dataset.productId;

        delete pendingChanges[productId];

        renderInventory(app);
      });
    });

  const clearButton = app.querySelector(
    '#clear-inventory-button'
  );

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      pendingChanges = {};
      renderInventory(app);
    });
  }

  const confirmButton = app.querySelector(
    '#confirm-inventory-button'
  );

  if (confirmButton) {
    confirmButton.addEventListener('click', () => {
      saveInventoryChanges(app);
    });
  }
}

async function saveProductChanges(app) {
  const isNew = editingProductId === 'new';
  const saveButton = app.querySelector('#product-edit-save');

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    const response = await fetch(
      isNew ? '/products' : `/products/${editingProductId}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editDraft),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not save the product.');
    }

    if (isNew) {
      // Keep the same order the server sends: by category, then name
      inventoryItems.push(result.product);
      inventoryItems.sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name)
      );
    } else {
      const item = inventoryItems.find(
        (currentItem) => currentItem.product_id === editingProductId
      );

      Object.assign(item, result.product);
    }

    closeProductEditor();
    renderInventory(app);

    const message = app.querySelector('#product-message');

    message.textContent = `${result.product.name} was ${isNew ? 'added' : 'updated'}.`;
    message.className = 'message success';
  } catch (error) {
    app.querySelector('#product-edit-error').textContent = error.message;

    saveButton.disabled = false;
    saveButton.textContent = isNew ? 'Add Product' : 'Save Changes';
  }
}

async function removeProduct(app, productId) {
  const item = inventoryItems.find(
    (currentItem) => currentItem.product_id === productId
  );

  const confirmed = window.confirm(
    `Remove ${item.name} from the shop? Customers won't see it anymore, and it comes out of their carts. Old orders will still show it.`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/products/${productId}`, {
      method: 'DELETE',
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Could not remove the product.');
    }

    inventoryItems = inventoryItems.filter(
      (currentItem) => currentItem.product_id !== productId
    );
    delete pendingChanges[productId];

    if (editingProductId === productId) {
      closeProductEditor();
    }

    renderInventory(app);

    const message = app.querySelector('#product-message');

    message.textContent = result.message;
    message.className = 'message success';
  } catch (error) {
    const message = app.querySelector('#product-message');

    message.textContent = error.message;
    message.className = 'message';
  }
}

async function saveInventoryChanges(app) {
  const changes = Object.entries(pendingChanges);

  if (changes.length === 0) {
    return;
  }

  const confirmButton = app.querySelector(
    '#confirm-inventory-button'
  );

  confirmButton.disabled = true;
  confirmButton.textContent = 'Saving...';

  try {
    await Promise.all(
      changes.map(async ([productId, change]) => {
        const response = await fetch(
          `/manager/inventory/${productId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              change,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || 'Could not update inventory.'
          );
        }

        const item = inventoryItems.find(
          (currentItem) =>
            String(currentItem.product_id) ===
            String(productId)
        );

        if (item) {
          item.quantity = result.quantity;
        }

        // This one is saved, so it won't be sent again if another one fails
        delete pendingChanges[productId];
      })
    );

    pendingChanges = {};
    renderInventory(app);

    const message = app.querySelector(
      '#inventory-message'
    );

    message.textContent =
      'Inventory updates saved successfully.';
    message.className =
      'inventory-message success';
  } catch (error) {
    // Show the new numbers for the ones that saved. Only the ones
    // that failed are still in the list, ready to try again.
    renderInventory(app);

    const message = app.querySelector(
      '#inventory-message'
    );

    message.textContent = error.message;
    message.className =
      'inventory-message error';
  }
}

export default {
  title: 'Products and Inventory',

  async show(app) {
    pendingChanges = {};
    showLowStockOnly = false;
    closeProductEditor();

    app.innerHTML = `
      <section class="hero">
        <h1>Products and Inventory</h1>

        <p class="muted">
          Loading products...
        </p>
      </section>
    `;

    try {
      const response = await fetch('/manager/inventory');

      if (!response.ok) {
        throw new Error('Could not load inventory.');
      }

      inventoryItems = await response.json();

      renderInventory(app);
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Products and Inventory</h1>

          <p class="message">
            ${error.message}
          </p>

          <a class="button primary" href="#/manager">
            Return to Manager Dashboard
          </a>
        </section>
      `;
    }
  },
};