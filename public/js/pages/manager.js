function getActiveOrders(orders) {
  return orders.filter(
    (order) =>
      order.status !== 'Delivered' &&
      order.status !== 'Cancelled'
  );
}

function getLowStockItems(inventory) {
  return inventory.filter(
    (item) => Number(item.quantity) <= 5
  );
}

function pluralizeOrders(count) {
  return `${count} order${count === 1 ? '' : 's'}`;
}

export default {
  title: 'Manager Dashboard',

  async show(app) {
    app.innerHTML = `
      <section class="manager-welcome">
        <p class="manager-eyebrow">
          Operations overview
        </p>

        <h1>Manager Dashboard</h1>

        <p class="muted">
          Monitor orders, inventory, and fulfillment activity
          from one place.
        </p>
      </section>

      <section class="manager-summary-section">
        <div class="manager-section-title">
          <h2>Today at a glance</h2>

          <p class="muted">
            Current information from the database.
          </p>
        </div>

        <div class="manager-summary-grid">
          <div class="card manager-summary-card">
            <p class="muted">Active Orders</p>
            <h2 id="active-orders-count">—</h2>
            <small>Orders still being processed</small>
          </div>

          <div class="card manager-summary-card">
            <p class="muted">Low Stock Items</p>
            <h2 id="low-stock-count">—</h2>
            <small>Items with 5 or fewer units</small>
          </div>

          <div class="card manager-summary-card">
            <p class="muted">Staged Orders</p>
            <h2 id="staged-orders-count">—</h2>
            <small>Orders waiting for delivery</small>
          </div>

          <div class="card manager-summary-card">
            <p class="muted">Active Trips</p>
            <h2 id="active-trips-count">—</h2>
            <small>Robot trips in progress</small>
          </div>
        </div>
      </section>

      <section class="manager-work-section">
        <div class="manager-section-title">
          <h2>Management tools</h2>

          <p class="muted">
            Choose an area to manage.
          </p>
        </div>

        <div class="manager-tool-grid">
          <a
            class="card manager-tool-card"
            href="#/manager-inventory"
          >
            <h2>Inventory Adjustment</h2>

            <p class="muted">
              Review current quantities and prepare changes
              before saving them to the database.
            </p>

            <span class="manager-tool-link">
              Open inventory →
            </span>
          </a>

          <a
            class="card manager-tool-card"
            href="#/manager-orders"
          >
            <h2>Order Management</h2>

            <p class="muted">
              Search customer orders, review statuses, and
              cancel eligible orders.
            </p>

            <span class="manager-tool-link">
              Manage orders →
            </span>
          </a>
        </div>
      </section>

      <section class="manager-status-section">
        <div class="manager-section-title">
          <h2>Order workflow</h2>

          <p class="muted">
            A quick view of where orders are in the process.
          </p>
        </div>

        <div class="card manager-workflow-card">
          <div class="manager-workflow-step">
            <strong>Pending</strong>
            <span id="pending-orders-count" class="muted">
              Loading...
            </span>
          </div>

          <span class="workflow-arrow">→</span>

          <div class="manager-workflow-step">
            <strong>Preparing</strong>
            <span id="preparing-orders-count" class="muted">
              Loading...
            </span>
          </div>

          <span class="workflow-arrow">→</span>

          <div class="manager-workflow-step">
            <strong>Staged</strong>
            <span id="workflow-staged-count" class="muted">
              Loading...
            </span>
          </div>
        </div>
      </section>
    `;

    try {
      const [
        ordersResponse,
        inventoryResponse,
        deliveriesResponse,
      ] = await Promise.all([
        fetch('/orders'),
        fetch('/manager/inventory'),
        fetch('/deliveries'),
      ]);

      if (!ordersResponse.ok) {
        throw new Error('Could not load order information.');
      }

      if (!inventoryResponse.ok) {
        throw new Error('Could not load inventory information.');
      }

      if (!deliveriesResponse.ok) {
        throw new Error('Could not load delivery information.');
      }

      const orders = await ordersResponse.json();
      const inventory = await inventoryResponse.json();
      const deliveries = await deliveriesResponse.json();

      const activeOrders = getActiveOrders(orders);

      const pendingOrders = orders.filter(
        (order) => order.status === 'Pending'
      );

      const preparingOrders = orders.filter(
        (order) => order.status === 'Preparing'
      );

      const stagedOrders = orders.filter(
        (order) => order.status === 'Staged'
      );

      const lowStockItems = getLowStockItems(inventory);

      const activeTrips = deliveries.filter(
        (delivery) =>
          delivery.delivery_status !== 'Delivered' &&
          delivery.delivery_status !== 'Failed'
      );

      app.querySelector('#active-orders-count')
        .textContent = activeOrders.length;

      app.querySelector('#low-stock-count')
        .textContent = lowStockItems.length;

      app.querySelector('#staged-orders-count')
        .textContent = stagedOrders.length;

      app.querySelector('#active-trips-count')
        .textContent = activeTrips.length;

      app.querySelector('#pending-orders-count')
        .textContent = pluralizeOrders(pendingOrders.length);

      app.querySelector('#preparing-orders-count')
        .textContent = pluralizeOrders(preparingOrders.length);

      app.querySelector('#workflow-staged-count')
        .textContent = pluralizeOrders(stagedOrders.length);
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Manager Dashboard</h1>

          <p class="message">
            ${error.message}
          </p>

          <button
            class="button primary"
            type="button"
            onclick="window.location.reload()"
          >
            Try Again
          </button>
        </section>
      `;
    }
  },
};