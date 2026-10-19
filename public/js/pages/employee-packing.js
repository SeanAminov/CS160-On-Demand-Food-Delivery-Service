export default {
  title: 'Orders to Pack',

  async show(app) {

    const queryString = window.location.hash.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    const orderId = params.get('id');
    
    if (orderId) {
        await renderPackingOrder(app, orderId);
        return;
    }

    app.innerHTML = `
      <section class="hero">
        <h1>Orders to Pack</h1>
        <p class="muted">
          Review paid orders that are waiting to be prepared.
        </p>
      </section>

      <nav class="buttons employee-navigation">
        <a class="button" href="#/employee">
          Dashboard
        </a>

        <a class="button primary" href="#/employee-packing">
          Orders to Pack
        </a>

        <a class="button" href="#/employee-shipping">
          Waiting to Ship
        </a>
      </nav>

      <section class="card">
        <h2>Order Packing Queue</h2>
        <p class="muted">Loading orders...</p>
      </section>
    `;

    try {
      const response = await fetch('/employee/orders');

      if (!response.ok) {
        throw new Error('Could not load employee orders.');
      }

      const orders = await response.json();

      const packingOrders = orders.filter(
        (order) =>
          order.status === 'Pending' ||
          order.status === 'Preparing'
      );

      const queueSection = app.querySelector('.card');

      if (packingOrders.length === 0) {
        queueSection.innerHTML = `
          <h2>Order Packing Queue</h2>
          <p class="muted">
            There are currently no orders waiting to be packed.
          </p>
        `;
        return;
      }

      queueSection.innerHTML = `
        <h2>Order Packing Queue</h2>

        <p class="muted">
          ${packingOrders.length}
          order${packingOrders.length === 1 ? '' : 's'}
          currently need attention.
        </p>

        <table class="cart">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total Weight</th>
              <th>Status</th>
              <th>Placed</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${packingOrders
              .map(
                (order) => `
                  <tr>
                    <td>
                      <strong>#${order.order_id}</strong>
                    </td>

                    <td>
                      ${order.customer}
                    </td>

                    <td>
                      ${Number(order.total_weight).toFixed(2)} lb
                    </td>

                    <td>
                      <span class="order-status">
                        ${order.status}
                      </span>
                    </td>

                    <td>
                      ${new Date(
                        order.created_at
                      ).toLocaleString()}
                    </td>

                    <td>
                      <a
                        class="button primary"
                        href="#/employee-packing?id=${order.order_id}"
                      >
                        Open Order
                      </a>
                    </td>
                  </tr>
                `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      app.innerHTML = `
        <section class="hero packing-hero">
          <h1>Orders to Pack</h1>
          <p class="message">
            ${error.message}
          </p>

          <a class="button primary" href="#/employee">
            Return to Dashboard
          </a>
        </section>
      `;
    }
  },
};


//Function to render order packing for specific orders
async function renderPackingOrder(app, orderId) {
  try {
    const response = await fetch(`/orders/${orderId}`);

    if (!response.ok) {
      throw new Error('Could not load order details.');
    }

    const order = await response.json();

    const confirmedQuantities = {};

    order.items.forEach((item) => {
      confirmedQuantities[item.product_id] = 0;
    });

    let packageType = '';

    function isComplete() {
      return order.items.every(
        (item) =>
          confirmedQuantities[item.product_id] >= item.quantity
      );
    }

    async function updateStatus(status) {
      const statusResponse = await fetch(
        `/orders/${order.order_id}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(
          data.error || 'Could not update order status.'
        );
      }

      order.status = status;
    }

    function renderPackingPage(message = '', isError = false) {
      const confirmedCount = order.items.reduce(
        (total, item) =>
          total + confirmedQuantities[item.product_id],
        0
      );

      const requiredCount = order.items.reduce(
        (total, item) => total + item.quantity,
        0
      );

      app.innerHTML = `
        <section class="hero">
          <h1>Pack Order #${order.order_id}</h1>

          <p>
            Customer:
            <strong>${order.customer_name}</strong>
          </p>

          <p class="muted">
            ${order.delivery_address}
          </p>

          <p class="muted">
            Status: ${order.status}
          </p>
        </section>

        <nav class="buttons employee-navigation packing-navigation">
          <a class="button" href="#/employee">
            Dashboard
          </a>

          <a class="button primary" href="#/employee-packing">
            Orders to Pack
          </a>
        </nav>

        ${
          message
            ? `
              <p class="message ${isError ? 'error' : ''}">
                ${message}
              </p>
            `
            : ''
        }

        <div class="packing-layout">
          <section class="card">
            <h2>Order Items</h2>

            <p class="muted">
              Confirm each item before staging the order.
            </p>

            <p>
              <strong>
                ${confirmedCount} / ${requiredCount}
              </strong>
              items confirmed
            </p>

            ${order.items
              .map((item) => {
                const confirmed =
                  confirmedQuantities[item.product_id];

                const complete = confirmed >= item.quantity;

                return `
                  <div class="card">
                    <strong>${item.name}</strong>

                    <p class="muted">
                      Product ID: ${item.product_id}
                    </p>

                    <p class="muted">
                      Required quantity: ${item.quantity}
                    </p>

                    <p>
                      Confirmed:
                      <strong>
                        ${confirmed} / ${item.quantity}
                      </strong>
                    </p>

                    <span class="order-status">
                      ${complete ? 'Confirmed' : 'Needs Packing'}
                    </span>
                  </div>
                `;
              })
              .join('')}

            <form id="item-form">
              <label for="product-id">
                Enter Product ID
              </label>

              <div class="buttons">
                <input
                  id="product-id"
                  type="text"
                  placeholder="Example: 3"
                  autocomplete="off"
                />

                <button
                  class="button primary"
                  type="submit"
                >
                  Confirm Item
                </button>
              </div>
            </form>
          </section>

          <section class="card">
            <h2>Package Confirmation</h2>

            <p class="muted">
              Choose the package used for this order.
            </p>

            <label>
              <input
                type="radio"
                name="packageType"
                value="Box"
                ${packageType === 'Box' ? 'checked' : ''}
              />
              Box
            </label>

            <br /><br />

            <label>
              <input
                type="radio"
                name="packageType"
                value="Bag"
                ${packageType === 'Bag' ? 'checked' : ''}
              />
              Bag
            </label>

            <br /><br />

            <button
              id="stage-button"
              class="button primary"
              ${
                isComplete() && packageType
                  ? ''
                  : 'disabled'
              }
            >
              Mark Ready and Stage Order
            </button>
          </section>
        </div>
      `;

      bindPackingEvents();
    }

    function bindPackingEvents() {
      const itemForm = app.querySelector('#item-form');
      const productInput = app.querySelector('#product-id');
      const stageButton = app.querySelector('#stage-button');

      itemForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const productId = Number(productInput.value.trim());

        const item = order.items.find(
          (currentItem) =>
            currentItem.product_id === productId
        );

        if (!item) {
          renderPackingPage(
            'That Product ID is not part of this order.',
            true
          );
          return;
        }

        if (
          confirmedQuantities[item.product_id] >=
          item.quantity
        ) {
          renderPackingPage(
            'This item is already fully confirmed.',
            true
          );
          return;
        }

        try {
          if (order.status === 'Pending') {
            await updateStatus('Preparing');
          }

          confirmedQuantities[item.product_id] += 1;
          renderPackingPage('Item confirmed.');
        } catch (error) {
          renderPackingPage(error.message, true);
        }
      });

      app
        .querySelectorAll('input[name="packageType"]')
        .forEach((radio) => {
          radio.addEventListener('change', () => {
            packageType = radio.value;
            renderPackingPage();
          });
        });

      stageButton.addEventListener('click', async () => {
        if (!isComplete() || !packageType) {
          return;
        }

        try {
          await updateStatus('Staged');

          app.innerHTML = `
            <section class="hero">
              <h1>Order Staged</h1>

              <p>
                Order
                <strong>#${order.order_id}</strong>
                has been packed successfully.
              </p>

              <a
                class="button primary"
                href="#/employee"
              >
                Return to Dashboard
              </a>
            </section>
          `;
        } catch (error) {
          renderPackingPage(error.message, true);
        }
      });
    }

    renderPackingPage();
  } catch (error) {
    app.innerHTML = `
      <section class="hero">
        <h1>Unable to Load Order</h1>

        <p class="message error">
          ${error.message}
        </p>

        <a class="button primary" href="#/employee">
          Return to Dashboard
        </a>
      </section>
    `;
  }
}