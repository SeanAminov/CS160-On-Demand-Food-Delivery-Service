let inventoryItems = [];

function renderInventory(app) {
  app.innerHTML = `
    <section class="hero">
      <h1>Inventory Adjustment</h1>
      <p class="muted">
        Review current inventory and prepare quantity adjustments.
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
              <th>Current Quantity</th>
              <th>Adjustment</th>
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
                        ${item.quantity}
                      </strong>
                    </td>

                    <td>
                      <div class="inventory-controls">
                        <button
                          class="inventory-adjust-button"
                          type="button"
                          disabled
                          title="Inventory adjustment coming soon"
                        >
                          −
                        </button>

                        <button
                          class="inventory-adjust-button"
                          type="button"
                          disabled
                          title="Inventory adjustment coming soon"
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

      <p class="inventory-message">
        Inventory adjustment controls will be enabled in a future update.
      </p>
    </section>
  `;
}

export default {
  title: 'Inventory Adjustment',

  async show(app) {
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