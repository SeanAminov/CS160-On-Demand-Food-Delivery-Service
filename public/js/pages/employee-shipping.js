export default {
  title: 'Waiting to Ship',

  async show(app) {
    app.innerHTML = `
      <section class="hero shipping-hero">
        <h1>Waiting to Ship</h1>

        <p class="muted">
          Select staged orders and assign them to a delivery robot.
        </p>
      </section>

      <nav class="buttons employee-navigation shipping-navigation">
        <a class="button" href="#/employee">
          Dashboard
        </a>

        <a class="button" href="#/employee-packing">
          Orders to Pack
        </a>

        <a class="button primary" href="#/employee-shipping">
          Waiting to Ship
        </a>
      </nav>

      <section class="card">
        <h2>Staged Orders</h2>
        <p class="muted">Loading staged orders...</p>
      </section>
    `;

    try {
      const response = await fetch('/orders');

      if (!response.ok) {
        throw new Error('Could not load staged orders.');
      }

      const orders = await response.json();

      const stagedOrders = orders.filter(
        (order) => order.status === 'Staged'
      );

      const content = app.querySelector('.card');

      if (stagedOrders.length === 0) {
        content.innerHTML = `
          <h2>Staged Orders</h2>
          <p class="muted">
            There are currently no orders waiting to ship.
          </p>
        `;
        return;
      }

      content.innerHTML = `
        <h2>Assign Orders to a Robot</h2>

        <p class="muted">
          A robot can carry up to 10 orders and 200 pounds.
        </p>

        <div class="shipping-summary">
          <strong>
            Selected:
            <span id="selected-count">0</span>
            <span id="selected-label">orders</span>
            orders
          </strong>

          <strong>
            Total weight:
            <span id="selected-weight">0.00</span>
            lb
          </strong>
        </div>

        <div class="shipping-orders">
          ${stagedOrders
            .map(
              (order) => `
                <label class="shipping-order-card">
                  <input
                    type="checkbox"
                    class="shipping-order-checkbox"
                    data-id="${order.order_id}"
                    data-weight="${order.total_weight}"
                  />

                  <span>
                    <strong>
                      Order #${order.order_id}
                    </strong>

                    <span class="muted">
                      ${order.customer}
                    </span>

                    <span class="muted">
                      ${order.delivery_address}
                    </span>

                    <span class="muted">
                      ${Number(order.total_weight).toFixed(2)} lb
                    </span>
                  </span>
                </label>
              `
            )
            .join('')}
        </div>

        <div class="shipping-assignment">
          <label for="robot-select">
            Assign delivery robot
          </label>

          <select id="robot-select">
            <option value="">
              Select a robot
            </option>
            <option value="Robot 1">
              Robot 1
            </option>
            <option value="Robot 2">
              Robot 2
            </option>
            <option value="Robot 3">
              Robot 3
            </option>
          </select>

          <button
            id="dispatch-button"
            class="button primary"
            disabled
          >
            Prepare Robot Dispatch
          </button>

          <p id="shipping-message" class="shipping-message"></p>
        </div>
      `;

      const checkboxes = app.querySelectorAll(
        '.shipping-order-checkbox'
      );

      const selectedCount = app.querySelector('#selected-count');
      const selectedWeight = app.querySelector('#selected-weight');
      const robotSelect = app.querySelector('#robot-select');
      const dispatchButton = app.querySelector('#dispatch-button');
      const message = app.querySelector('#shipping-message');

      function updateSummary() {
        const selectedOrders = [
          ...app.querySelectorAll(
            '.shipping-order-checkbox:checked'
          ),
        ];

        const count = selectedOrders.length;

        const weight = selectedOrders.reduce(
          (total, checkbox) =>
            total + Number(checkbox.dataset.weight),
          0
        );

        selectedCount.textContent = count;

        app.querySelector('#selected-label').textContent =
          count === 1 ? 'order' : 'orders';

        selectedWeight.textContent = weight.toFixed(2);

        dispatchButton.disabled =
          count === 0 || !robotSelect.value;

        if (count > 10) {
          message.textContent =
            'A robot cannot carry more than 10 orders.';
          message.className = 'shipping-message error';
          dispatchButton.disabled = true;
        } else if (weight > 200) {
          message.textContent =
            'A robot cannot carry more than 200 pounds.';
          message.className = 'shipping-message error';
          dispatchButton.disabled = true;
        } else {
          message.textContent = '';
          message.className = 'shipping-message';
        }
      }

      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', updateSummary);
      });

      robotSelect.addEventListener('change', updateSummary);

      dispatchButton.addEventListener('click', () => {
        const selectedRobot = robotSelect.value;

        message.textContent =
          `${selectedRobot} has been assigned to this trip. ` +
          'Database dispatch will be connected next.';

        message.className = 'shipping-message success';
      });
    } catch (error) {
      app.innerHTML = `
        <section class="hero">
          <h1>Unable to Load Shipping Queue</h1>

          <p class="message error">
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