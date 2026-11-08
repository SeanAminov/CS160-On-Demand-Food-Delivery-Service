let allOrders = [];
let searchTerm = '';
let statusFilter = '';

const cancellableStatuses = [
  'Pending',
  'Preparing',
  'Staged',
];

function formatDate(dateValue) {
  if (!dateValue) {
    return '—';
  }

  return new Date(dateValue).toLocaleString();
}

function getFilteredOrders() {
  const searchValue = searchTerm.trim().toLowerCase();

  return allOrders.filter((order) => {
    const matchesSearch =
      !searchValue ||
      [
        order.order_id,
        order.customer,
        order.customer_email,
        order.delivery_address,
        order.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchValue);

    const matchesStatus =
      !statusFilter || order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

function renderOrderTable(app) {
  const orders = getFilteredOrders();
  const results = app.querySelector('#order-results');
  const resultCount = app.querySelector('#order-count');

  resultCount.textContent =
    `Showing ${orders.length} of ${allOrders.length} orders`;

  if (orders.length === 0) {
    results.innerHTML = `
      <p class="muted order-empty-message">
        No orders match the current search or filter.
      </p>
    `;
    return;
  }

  results.innerHTML = `
    <div class="order-management-table-wrapper">
      <table class="order-management-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Delivery Address</th>
            <th>Status</th>
            <th>Total</th>
            <th>Placed</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${orders
            .map((order) => {
              const canCancel =
                cancellableStatuses.includes(order.status);

              return `
                <tr>
                  <td>
                    <strong class="order-number">
                      #${order.order_id}
                    </strong>
                  </td>

                  <td>
                    <div class="order-customer">
                      <strong>
                        ${order.customer || 'Unknown Customer'}
                      </strong>

                      <span class="muted">
                        ${order.customer_email || 'No email available'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span class="order-address">
                      ${order.delivery_address || 'No address available'}
                    </span>
                  </td>

                  <td>
                    <span class="order-status">
                      ${order.status}
                    </span>
                  </td>

                  <td>
                    <strong>
                      $${Number(order.total_price || 0).toFixed(2)}
                    </strong>

                    <span class="order-weight muted">
                      ${Number(order.total_weight || 0).toFixed(2)} lb
                    </span>
                  </td>

                  <td>
                    <span class="order-date">
                      ${formatDate(order.created_at)}
                    </span>
                  </td>

                  <td>
                    <button
                      class="button order-cancel-button"
                      data-order-id="${order.order_id}"
                      type="button"
                      ${canCancel ? '' : 'disabled'}
                    >
                      ${
                        order.status === 'Cancelled'
                          ? 'Cancelled'
                          : 'Cancel Order'
                      }
                    </button>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  bindCancelButtons(app);
}

function bindCancelButtons(app) {
  app
    .querySelectorAll('.order-cancel-button:not(:disabled)')
    .forEach((button) => {
      button.addEventListener('click', async () => {
        const orderId = button.dataset.orderId;

        const confirmed = window.confirm(
          `Are you sure you want to cancel order #${orderId}?`
        );

        if (!confirmed) {
          return;
        }

        button.disabled = true;
        button.textContent = 'Cancelling...';

        try {
          const response = await fetch(
            `/orders/${orderId}/cancel`,
            {
              method: 'POST',
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(
              result.error || 'Could not cancel order.'
            );
          }

          const order = allOrders.find(
            (currentOrder) =>
              String(currentOrder.order_id) ===
              String(orderId)
          );

          if (order) {
            order.status = 'Cancelled';
          }

          renderOrderTable(app);

          const message = app.querySelector('#order-message');

          message.textContent =
            `Order #${orderId} was cancelled successfully.`;

          message.className =
            'order-message success';
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Cancel Order';

          const message = app.querySelector('#order-message');

          message.textContent = error.message;
          message.className =
            'order-message error';
        }
      });
    });
}

function bindOrderFilters(app) {
  app
    .querySelector('#order-search')
    .addEventListener('input', (event) => {
      searchTerm = event.target.value;
      renderOrderTable(app);
    });

  app
    .querySelector('#status-filter')
    .addEventListener('change', (event) => {
      statusFilter = event.target.value;
      renderOrderTable(app);
    });
}

function renderOrderDashboard(app) {
  const activeOrders = allOrders.filter(
    (order) =>
      order.status !== 'Delivered' &&
      order.status !== 'Cancelled'
  );

  const stagedOrders = allOrders.filter(
    (order) => order.status === 'Staged'
  );

  const cancelledOrders = allOrders.filter(
    (order) => order.status === 'Cancelled'
  );

  app.innerHTML = `
    <section class="hero">
      <h1>Order Management</h1>

      <p class="muted">
        Review customer orders and manage active order status.
      </p>
    </section>

    <nav class="buttons manager-navigation">
      <a class="button" href="#/manager">
        Manager Dashboard
      </a>

      <a class="button" href="#/manager-inventory">
        Inventory Adjustment
      </a>

      <a class="button primary" href="#/manager-orders">
        Order Management
      </a>
    </nav>

    <section class="manager-summary-grid order-summary-grid">
      <div class="card manager-summary-card">
        <p class="muted">Total Orders</p>
        <h2>${allOrders.length}</h2>
        <small>Orders in the database</small>
      </div>

      <div class="card manager-summary-card">
        <p class="muted">Active Orders</p>
        <h2>${activeOrders.length}</h2>
        <small>Orders still in progress</small>
      </div>

      <div class="card manager-summary-card">
        <p class="muted">Staged Orders</p>
        <h2>${stagedOrders.length}</h2>
        <small>Orders waiting for delivery</small>
      </div>

      <div class="card manager-summary-card">
        <p class="muted">Cancelled Orders</p>
        <h2>${cancelledOrders.length}</h2>
        <small>Orders marked cancelled</small>
      </div>
    </section>

    <section class="card order-management-card">
      <div class="order-management-header">
        <div>
          <h2>Customer Orders</h2>

          <p id="order-count" class="muted">
            Showing ${allOrders.length} of ${allOrders.length} orders
          </p>
        </div>

        <div class="order-filter-controls">
          <div class="order-search-container">
            <label for="order-search">
              Search orders
            </label>

            <input
              id="order-search"
              class="order-search-input"
              type="search"
              placeholder="Name, email, order ID, or address"
              autocomplete="off"
            />
          </div>

          <div class="order-status-filter">
            <label for="status-filter">
              Filter by status
            </label>

            <select id="status-filter">
              <option value="">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Preparing">Preparing</option>
              <option value="Staged">Staged</option>
              <option value="Out for Delivery">
                Out for Delivery
              </option>
              <option value="Delivered">Delivered</option>
              <option value="Failed">Failed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <p id="order-message" class="order-message"></p>

      <div id="order-results"></div>
    </section>
  `;

  renderOrderTable(app);
  bindOrderFilters(app);
}

export default {
  title: 'Order Management',

  async show(app) {
    searchTerm = '';
    statusFilter = '';

    app.innerHTML = `
      <section class="hero">
        <h1>Order Management</h1>
        <p class="muted">
          Loading customer orders...
        </p>
      </section>
    `;

    try {
      const response = await fetch('/orders');

      if (!response.ok) {
        throw new Error('Could not load orders.');
      }

      allOrders = await response.json();

      renderOrderDashboard(app);
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Order Management</h1>

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