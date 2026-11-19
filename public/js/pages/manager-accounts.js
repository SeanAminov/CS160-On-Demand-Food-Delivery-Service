import { cartRequest, escapeHtml } from '../cart-api.js';
import { managerNavigation } from '../manager-nav.js';
import { getUser } from '../user.js';

let allAccounts = [];
let searchTerm = '';
// The manager looking at the page, so their own row doesn't get a Delete button
let currentUserId = null;

function roleLabel(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getFilteredAccounts() {
  const searchValue = searchTerm.trim().toLowerCase();

  if (!searchValue) {
    return allAccounts;
  }

  return allAccounts.filter((account) => {
    const searchableText = [
      account.name,
      account.email,
      account.role,
      account.active ? 'active' : 'not active deleted',
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchValue);
  });
}

// What goes in the last column: a Delete button for customers and employees,
// and a short note for everyone else
function accountAction(account) {
  if (!account.active) {
    return '<span class="muted">Deleted</span>';
  }
  // A manager deletes their own account from My Account
  if (account.user_id === currentUserId) {
    return '<span class="muted">You</span>';
  }
  if (account.role === 'manager') {
    return '<span class="muted">Manager</span>';
  }
  return `
    <button class="button small account-delete-button" data-user-id="${account.user_id}" type="button">
      Delete
    </button>
  `;
}

function renderAccountResults(app) {
  const accounts = getFilteredAccounts();
  const resultsContainer = app.querySelector('#account-results');
  const countElement = app.querySelector('#account-count');

  countElement.textContent =
    `${accounts.length} account${accounts.length === 1 ? '' : 's'} found`;

  if (accounts.length === 0) {
    resultsContainer.innerHTML = `
      <p class="muted order-empty-message">
        No accounts match your search.
      </p>
    `;
    return;
  }

  resultsContainer.innerHTML = `
    <div class="order-management-table-wrapper">
      <table class="order-management-table account-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Orders Not Shipped</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${accounts
            .map(
              (account) => `
                <tr class="${account.active ? '' : 'account-row-inactive'}">
                  <td>
                    <div class="order-customer">
                      <strong>${escapeHtml(account.name)}</strong>
                      <span class="muted">${escapeHtml(account.email)}</span>
                    </div>
                  </td>

                  <td>${roleLabel(account.role)}</td>

                  <td>
                    <span class="account-status ${account.active ? 'active' : 'inactive'}">
                      ${account.active ? 'Active' : 'Not active'}
                    </span>
                  </td>

                  <td>${new Date(account.created_at).toLocaleDateString()}</td>

                  <td>
                    ${account.unshipped_orders}
                    ${
                      account.orders_on_the_way > 0
                        ? `<span class="muted transaction-note">${account.orders_on_the_way} out for delivery</span>`
                        : ''
                    }
                  </td>

                  <td>${accountAction(account)}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  resultsContainer.querySelectorAll('.account-delete-button').forEach((button) => {
    button.addEventListener('click', () => {
      deleteAccount(app, Number(button.dataset.userId));
    });
  });
}

async function loadAccounts() {
  allAccounts = await cartRequest('GET', '/users');
}

async function deleteAccount(app, userId) {
  const account = allAccounts.find((item) => item.user_id === userId);
  const ordersNote = account.unshipped_orders > 0
    ? ` Their ${account.unshipped_orders} order${account.unshipped_orders === 1 ? '' : 's'} that haven't shipped will be cancelled and refunded.`
    : '';

  const confirmed = window.confirm(
    `Are you sure you want to delete ${account.name}'s account (${account.email})? They won't be able to log in again.${ordersNote}`
  );
  if (!confirmed) {
    return;
  }

  const message = app.querySelector('#account-message');

  try {
    const result = await cartRequest('DELETE', `/users/${userId}`);
    const cancelled = result.cancelled_orders || [];

    message.textContent = cancelled.length > 0
      ? `${result.message} Cancelled and refunded ${cancelled.map((id) => `#${id}`).join(', ')}.`
      : result.message;
    message.className = 'message success';

    await loadAccounts();
    renderAccountResults(app);
  } catch (error) {
    message.textContent = error.message;
    message.className = 'message';
  }
}

export default {
  title: 'Accounts',

  async show(app) {
    searchTerm = '';

    app.innerHTML = `
      <section class="hero">
        <h1>Accounts</h1>

        <p class="muted">
          Every customer, employee, and manager. Deleting an account turns it off, and its past orders stay in the records.
        </p>
      </section>

      ${managerNavigation('#/manager-accounts')}

      <section class="card order-management-card">
        <div class="order-management-header">
          <div>
            <h2>Accounts</h2>
            <p id="account-count" class="muted">
              Loading accounts...
            </p>
          </div>

          <div class="order-search-container">
            <label for="account-search">
              Search accounts
            </label>

            <input
              id="account-search"
              class="order-search-input"
              type="search"
              placeholder="Name, email, or role"
              autocomplete="off"
            />
          </div>
        </div>

        <p id="account-message" class="message"></p>

        <div id="account-results"></div>
      </section>
    `;

    try {
      const user = await getUser();
      currentUserId = user ? user.userID : null;

      await loadAccounts();
      renderAccountResults(app);

      app
        .querySelector('#account-search')
        .addEventListener('input', (event) => {
          searchTerm = event.target.value;
          renderAccountResults(app);
        });
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Accounts</h1>

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
