export default {
  title: 'Manager Dashboard',

  show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Manager Dashboard</h1>
        <p class="muted">
          Manage products, inventory, customer orders, and payments.
        </p>
      </section>

      <section class="grid manager-options">
        <a
          class="card manager-option-card"
          href="#/manager-inventory"
        >
          <h2>Products and Inventory</h2>

          <p class="muted">
            Change prices, names, weights, and other product details, and adjust stock.
          </p>

          <span class="button primary">
            Open Products
          </span>
        </a>

        <a
          class="card manager-option-card"
          href="#/manager-orders"
        >
          <h2>Order Management</h2>

          <p class="muted">
            Review customer orders and what's on them, and cancel orders.
          </p>

          <span class="button primary">
            Manage Orders
          </span>
        </a>

        <a
          class="card manager-option-card"
          href="#/manager-transactions"
        >
          <h2>Transaction History</h2>

          <p class="muted">
            See paid, refunded, and declined payments from Stripe, matched with each order.
          </p>

          <span class="button primary">
            View Transactions
          </span>
        </a>
      </section>
    `;
  },
};
