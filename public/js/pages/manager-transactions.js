import { money, escapeHtml } from '../cart-api.js';
import { managerNavigation } from '../manager-nav.js';

let allTransactions = [];
let searchTerm = '';

function getFilteredTransactions() {
  const searchValue = searchTerm.trim().toLowerCase();

  if (!searchValue) {
    return allTransactions;
  }

  return allTransactions.filter((transaction) => {
    const searchableText = [
      transaction.order_id ? `#${transaction.order_id}` : 'no order',
      transaction.customer,
      transaction.customer_email,
      transaction.status,
      transaction.stripe_id,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchValue);
  });
}

function renderTransactionResults(app) {
  const transactions = getFilteredTransactions();
  const resultsContainer = app.querySelector('#transaction-results');
  const countElement = app.querySelector('#transaction-count');

  countElement.textContent =
    `${transactions.length} transaction${transactions.length === 1 ? '' : 's'} found`;

  if (transactions.length === 0) {
    resultsContainer.innerHTML = `
      <p class="muted order-empty-message">
        No transactions match your search.
      </p>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <div class="order-management-table-wrapper">
      <table class="order-management-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>Cost</th>
            <th>Order</th>
            <th>Customer</th>
            <th>Stripe ID</th>
          </tr>
        </thead>

        <tbody>
          ${transactions
            .map(
              (transaction) => `
                <tr>
                  <td>
                    ${new Date(transaction.date).toLocaleString()}
                  </td>

                  <td>
                    <span class="transaction-status ${escapeHtml(transaction.status.toLowerCase().replace(' ', '-'))}">
                      ${escapeHtml(transaction.status)}
                    </span>
                  </td>

                  <td>
                    <strong>${money(transaction.amount)}</strong>
                  </td>

                  <td>
                    ${
                      transaction.order_id
                        ? `
                          <a class="transaction-order-link" href="#/manager-orders?id=${transaction.order_id}">
                            #${transaction.order_id}
                          </a>
                        `
                        : '<span class="muted">No order</span>'
                    }
                  </td>

                  <td>
                    ${
                      transaction.customer
                        ? `
                          <div class="order-customer">
                            <strong>${escapeHtml(transaction.customer)}</strong>
                            <span class="muted">${escapeHtml(transaction.customer_email)}</span>
                          </div>
                        `
                        : '<span class="muted">Not recorded</span>'
                    }
                  </td>

                  <td>
                    <span class="transaction-id">${escapeHtml(transaction.stripe_id)}</span>
                    ${
                      transaction.in_stripe
                        ? ''
                        : '<span class="muted transaction-note">Not found in Stripe</span>'
                    }
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

export default {
  title: 'Transaction History',

  async show(app) {
    searchTerm = '';

    app.innerHTML = `
      <section class="hero">
        <h1>Transaction History</h1>

        <p class="muted">
          Every payment, refund, and declined card from Stripe, matched with its order.
        </p>
      </section>

      ${managerNavigation('#/manager-transactions')}

      <section class="card order-management-card">
        <div class="order-management-header">
          <div>
            <h2>Transactions</h2>
            <p id="transaction-count" class="muted">
              Loading transactions from Stripe...
            </p>
          </div>

          <div class="order-search-container">
            <label for="transaction-search">
              Search transactions
            </label>

            <input
              id="transaction-search"
              class="order-search-input"
              type="search"
              placeholder="Status, order, customer, or Stripe ID"
              autocomplete="off"
            />
          </div>
        </div>

        <p id="transaction-message" class="message"></p>

        <div id="transaction-results"></div>
      </section>
    `;

    try {
      const response = await fetch('/transactions');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not load transactions.');
      }

      allTransactions = data.transactions;

      if (!data.stripe_connected) {
        app.querySelector('#transaction-message').textContent =
          'Could not reach Stripe, so this list shows what we saved in our database.';
      }

      renderTransactionResults(app);

      app
        .querySelector('#transaction-search')
        .addEventListener('input', (event) => {
          searchTerm = event.target.value;
          renderTransactionResults(app);
        });
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Transaction History</h1>

          <p class="message">
            ${escapeHtml(error.message)}
          </p>

          <a class="button primary" href="#/manager">
            Return to Manager Dashboard
          </a>
        </section>
      `;
    }
  },
};
