let inventoryItems = [];
let pendingChanges = {};

function getPendingQuantity(item) {
  return item.quantity + (pendingChanges[item.product_id] || 0);
}

function renderInventory(app) {
  const pendingEntries = Object.entries(pendingChanges).filter(
    ([, change]) => change !== 0
  );

  app.innerHTML = `
    <section class="hero">
      <h1>Inventory Adjustment</h1>

      <p class="muted">
        Review inventory and confirm quantity changes before saving.
      </p>
    </section>

    <nav class="buttons manager-navigation">
      <a class="button" href="#/manager">
        Manager Dashboard
      </a>

      <a class="button primary" href="#/manager-inventory">
        Inventory Adjustment
      </a>

      <a class="button" href="#/manager-orders">
        Order Management
      </a>
    </nav>

    <div class="inventory-workspace">
      <section class="card inventory-table-card">
        <div class="manager-section-header">
          <div>
            <h2>Current Inventory</h2>

            <p class="muted">
              Inventory currently recorded in the database.
            </p>
          </div>

          <span class="inventory-count">
            ${inventoryItems.length} products
          </span>
        </div>

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
              ${inventoryItems
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
                        <strong class="inventory-quantity">
                          ${getPendingQuantity(item)}
                        </strong>

                        ${
                          pendingChanges[item.product_id]
                            ? `
                              <span class="pending-quantity-label">
                                pending
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
                        </div>
                      </td>
                    </tr>
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
  title: 'Inventory Adjustment',

  async show(app) {
    pendingChanges = {};

    app.innerHTML = `
      <section class="hero">
        <h1>Inventory Adjustment</h1>

        <p class="muted">
          Loading inventory...
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
          <h1>Inventory Adjustment</h1>

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