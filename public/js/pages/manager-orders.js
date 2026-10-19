let allOrders = [];

function formatDate(dateValue) {
  if (!dateValue) {
    return '—';
  }

  return new Date(dateValue).toLocaleString();
}

function renderOrderResults(app, orders) {
  const resultsContainer = app.querySelector('#order-results');
  const countElement = app.querySelector('#order-count');

  countElement.textContent =
    `${orders.length} order${orders.length === 1 ? '' : 's'} found`;

  if (orders.length === 0) {
    resultsContainer.innerHTML = `
      <p class="muted order-empty-message">
        No orders match your search.
      </p>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <div class="order-management-table-wrapper">
      <table class="order-management-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer Information</th>
            <th>Delivery Address</th>
            <th>Status</th>
            <th>Total</th>
            <th>Placed</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${orders
            .map(
              (order) => `
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
                      type="button"
                      disabled
                      title="Cancellation will be added later"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function bindOrderSearch(app) {
  const searchInput = app.querySelector('#order-search');

  searchInput.addEventListener('input', () => {
    const searchValue = searchInput.value.trim().toLowerCase();

    const filteredOrders = allOrders.filter((order) => {
      const searchableText = [
        order.order_id,
        order.customer,
        order.customer_email,
        order.delivery_address,
        order.status,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchValue);
    });

    renderOrderResults(app, filteredOrders);
  });
}

export default {
  title: 'Order Management',

  async show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Order Management</h1>
        <p class="muted">
          Review customer orders, delivery information, and order status.
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

      <section class="card order-management-card">
        <div class="order-management-header">
          <div>
            <h2>Customer Orders</h2>
            <p id="order-count" class="muted">
              Loading orders...
            </p>
          </div>

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
        </div>

        <div id="order-results"></div>

        <p class="order-management-note">
          Order cancellation will be enabled in a future update.
        </p>
      </section>
    `;

    try {
      const response = await fetch('/orders');

      if (!response.ok) {
        throw new Error('Could not load orders.');
      }

      allOrders = await response.json();

      renderOrderResults(app, allOrders);
      bindOrderSearch(app);
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