let allOrders = [];
let searchTerm = '';

const cancellableStatuses = [
  'Pending',
  'Preparing',
  'Staged',
];

function getFilteredOrders() {
  const searchValue = searchTerm.trim().toLowerCase();

  if (!searchValue) {
    return allOrders;
  }

  return allOrders.filter((order) => {
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
}

function renderOrderResults(app) {
  const orders = getFilteredOrders();
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
            <th>Customer</th>
            <th>Address</th>
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
                    <strong>#${order.order_id}</strong>
                  </td>

                  <td>
                    <div class="order-customer">
                      <strong>
                        ${order.customer || 'Unknown Customer'}
                      </strong>

                      <span class="muted">
                        ${order.customer_email || 'No email'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span class="order-address">
                      ${order.delivery_address || 'No address'}
                    </span>
                  </td>

                  <td>
                    <span class="order-status">
                      ${order.status}
                    </span>
                  </td>

                  <td>
                    $${Number(order.total_price || 0).toFixed(2)}
                  </td>

                  <td>
                    ${new Date(
                      order.created_at
                    ).toLocaleString()}
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
          `Cancel order #${orderId}?`
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

          renderOrderResults(app);

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

export default {
  title: 'Order Management',

  async show(app) {
    searchTerm = '';

    app.innerHTML = `
      <section class="hero">
        <h1>Order Management</h1>

        <p class="muted">
          Review customer orders and cancel orders when necessary.
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

        <p id="order-message" class="order-message"></p>

        <div id="order-results"></div>
      </section>
    `;

    try {
      const response = await fetch('/orders');

      if (!response.ok) {
        throw new Error('Could not load orders.');
      }

      allOrders = await response.json();

      renderOrderResults(app);

      app
        .querySelector('#order-search')
        .addEventListener('input', (event) => {
          searchTerm = event.target.value;
          renderOrderResults(app);
        });
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