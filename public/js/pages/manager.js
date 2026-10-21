export default {
  title: 'Manager Dashboard',

  show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Manager Dashboard</h1>
        <p class="muted">
          Manage inventory and customer orders.
        </p>
      </section>

      <section class="grid manager-options">
        <a
          class="card manager-option-card"
          href="#/manager-inventory"
        >
          <h2>Inventory Adjustment</h2>

          <p class="muted">
            Review current inventory and prepare quantity adjustments.
          </p>

          <span class="button primary">
            Open Inventory
          </span>
        </a>

        <a
          class="card manager-option-card"
          href="#/manager-orders"
        >
          <h2>Order Management</h2>

          <p class="muted">
            Review customer orders, statuses, and cancellation options.
          </p>

          <span class="button primary">
            Manage Orders
          </span>
        </a>
      </section>
    `;
  },
};