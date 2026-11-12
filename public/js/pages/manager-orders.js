import { renderOrderDetails } from '../order-details.js';
import { managerNavigation } from '../manager-nav.js';

let allOrders = [];
let searchTerm = '';
let statusFilter = '';
let openOrderId = null;

const cancellableStatuses = [
  'Pending',
  'Preparing',
  'Staged',
];

function getFilteredOrders() {
  const searchValue = searchTerm.trim().toLowerCase();

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

    const matchesSearch =
      !searchValue ||
      searchableText.includes(searchValue);

    const matchesStatus =
      !statusFilter ||
      order.status === statusFilter;

    return matchesSearch && matchesStatus;
  });
}

function getStatusClass(status) {
  return status
    .toLowerCase()
    .replaceAll(' ', '-');
}

function getOrderCounts() {
  return {
    total: allOrders.length,

    active: allOrders.filter(
      (order) =>
        order.status !== 'Delivered' &&
        order.status !== 'Cancelled' &&
        order.status !== 'Failed'
    ).length,

    needsAttention: allOrders.filter(
      (order) =>
        order.status === 'Pending' ||
        order.status === 'Preparing'
    ).length,

    cancelled: allOrders.filter(
      (order) => order.status === 'Cancelled'
    ).length,
  };
}

function updateOrderSummary(app) {
  const counts = getOrderCounts();

  app.querySelector('#total-orders-count')
    .textContent = counts.total;

  app.querySelector('#active-orders-count')
    .textContent = counts.active;

  app.querySelector('#attention-orders-count')
    .textContent = counts.needsAttention;

  app.querySelector('#cancelled-orders-count')
    .textContent = counts.cancelled;
}

function renderOrderResults(app) {
  const orders = getFilteredOrders();
  const resultsContainer = app.querySelector('#order-results');
  const countElement = app.querySelector('#order-count');

  countElement.textContent =
    `Showing ${orders.length} of ${allOrders.length} orders`;

  if (orders.length === 0) {
    resultsContainer.innerHTML = `
      <p class="muted order-empty-message">
        No orders match the current search or filter.
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

              const isOpen =
                order.order_id === openOrderId;

              return `
                <tr
                  class="order-row ${
                    isOpen ? 'order-row-open' : ''
                  }"
                  data-order-id="${order.order_id}"
                >
                  <td>
                    <button
                      class="order-details-toggle"
                      type="button"
                      aria-expanded="${isOpen}"
                    >
                      <span class="order-toggle-icon">
                        ${isOpen ? '▾' : '▸'}
                      </span>

                      <strong>
                        #${order.order_id}
                      </strong>
                    </button>
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
                    <span
                      class="
                        order-status
                        order-status-${getStatusClass(order.status)}
                      "
                    >
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
                      ${new Date(
                        order.created_at
                      ).toLocaleString()}
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
                          : 'Cancel'
                      }
                    </button>
                  </td>
                </tr>

                ${
                  isOpen
                    ? `
                      <tr class="order-details-row">
                        <td colspan="7">
                          <div
                            id="order-details-panel"
                            class="order-details-panel"
                          ></div>
                        </td>
                      </tr>
                    `
                    : ''
                }
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  bindCancelButtons(app);
  bindOrderRows(app);
  showOpenOrder(app);
}

function bindOrderRows(app) {
  app.querySelectorAll('.order-row').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (
        event.target.closest('.order-cancel-button')
      ) {
        return;
      }

      const orderId = Number(row.dataset.orderId);

      openOrderId =
        orderId === openOrderId
          ? null
          : orderId;

      renderOrderResults(app);
    });
  });
}

async function showOpenOrder(app) {
  const panel = app.querySelector(
    '#order-details-panel'
  );

  if (!panel || !openOrderId) {
    return;
  }

  try {
    await renderOrderDetails(
      panel,
      openOrderId,
      true
    );
  } catch (error) {
    panel.innerHTML = `
      <p class="message">
        ${error.message}
      </p>
    `;
  }
}

function bindCancelButtons(app) {
  app
    .querySelectorAll(
      '.order-cancel-button:not(:disabled)'
    )
    .forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.stopPropagation();

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
              result.error ||
                'Could not cancel order.'
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

          updateOrderSummary(app);
          renderOrderResults(app);

          const message = app.querySelector(
            '#order-message'
          );

          message.textContent =
            `Order #${orderId} was cancelled successfully.`;

          message.className =
            'order-message success';
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Cancel';

          const message = app.querySelector(
            '#order-message'
          );

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
      openOrderId = null;
      renderOrderResults(app);
    });

  app
    .querySelector('#status-filter')
    .addEventListener('change', (event) => {
      statusFilter = event.target.value;
      openOrderId = null;
      renderOrderResults(app);
    });
}

function renderOrderDashboard(app) {
  const counts = getOrderCounts();

  app.innerHTML = `
    <section class="hero">
      <h1>Order Management</h1>

      <p class="muted">
        Review customer orders, inspect products, and
        cancel eligible orders.
      </p>
    </section>

    ${managerNavigation('#/manager-orders')}

    <section class="order-management-summary">
      <div class="card order-summary-card">
        <p class="muted">Total Orders</p>
        <h2 id="total-orders-count">
          ${counts.total}
        </h2>
        <small>Orders in the database</small>
      </div>

      <div class="card order-summary-card">
        <p class="muted">Active Orders</p>
        <h2 id="active-orders-count">
          ${counts.active}
        </h2>
        <small>Orders still being processed</small>
      </div>

      <div class="card order-summary-card">
        <p class="muted">Needs Attention</p>
        <h2 id="attention-orders-count">
          ${counts.needsAttention}
        </h2>
        <small>Pending or preparing</small>
      </div>

      <div class="card order-summary-card">
        <p class="muted">Cancelled Orders</p>
        <h2 id="cancelled-orders-count">
          ${counts.cancelled}
        </h2>
        <small>Orders marked cancelled</small>
      </div>
    </section>

    <section class="card order-management-card">
      <div class="order-management-header">
        <div>
          <h2>Customer Orders</h2>

          <p id="order-count" class="muted">
            Loading orders...
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
              placeholder="Name, email, ID, or address"
              autocomplete="off"
            />
          </div>

          <div class="order-status-filter">
            <label for="status-filter">
              Status
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

  renderOrderResults(app);
  bindOrderFilters(app);
}

export default {
  title: 'Order Management',

  async show(app) {
    searchTerm = '';
    statusFilter = '';

    const queryString =
      window.location.hash.split('?')[1] || '';

    openOrderId =
      Number(
        new URLSearchParams(queryString).get('id')
      ) || null;

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

      const openRow = app.querySelector(
        '.order-details-row'
      );

      if (openRow) {
        openRow.scrollIntoView({
          block: 'center',
        });
      }
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