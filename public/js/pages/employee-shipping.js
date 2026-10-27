import { renderRouteMap } from '../route-map.js';

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
      const [response, tripsResponse] = await Promise.all([
        fetch('/orders'),
        fetch('/deliveries'),
      ]);

      if (!response.ok || !tripsResponse.ok) {
        throw new Error('Could not load staged orders.');
      }

      const orders = await response.json();
      const trips = await tripsResponse.json();

      // Oldest first, since those customers have waited the longest
      const stagedOrders = orders
        .filter((order) => order.status === 'Staged')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Start with the oldest orders that fit on one robot already checked,
      // the same way Section 6 of our Part 2 document picks a trip.
      // The employee can still change which ones go.
      const suggested = [];
      let suggestedWeight = 0;

      for (const order of stagedOrders) {
        const weight = Number(order.total_weight);

        if (suggested.length < 10 && Number((suggestedWeight + weight).toFixed(2)) <= 200) {
          suggested.push(order.order_id);
          suggestedWeight += weight;
        }
      }

      // A robot that is already out on a trip can't be picked again
      const busyRobots = {};

      for (const trip of trips) {
        if (trip.delivery_status === 'Out for Delivery' && trip.robot) {
          busyRobots[trip.robot] = trip.delivery_id;
        }
      }

      const robotOptions = ['Robot 1', 'Robot 2', 'Robot 3']
        .map((robot) =>
          busyRobots[robot]
            ? `<option value="${robot}" disabled>${robot} (out on trip #${busyRobots[robot]})</option>`
            : `<option value="${robot}">${robot}</option>`
        )
        .join('');

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
                    ${suggested.includes(order.order_id) ? 'checked' : ''}
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
            ${robotOptions}
          </select>

          <button
            id="dispatch-button"
            class="button primary"
            disabled
          >
            Dispatch Robot
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
        } else if (Number(weight.toFixed(2)) > 200) {
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

      // Show the count and weight for the orders that start checked
      updateSummary();

      dispatchButton.addEventListener('click', async () => {
        const orderIds = [
          ...app.querySelectorAll(
            '.shipping-order-checkbox:checked'
          ),
        ].map((checkbox) => Number(checkbox.dataset.id));

        dispatchButton.disabled = true;
        message.textContent = '';

        try {
          const dispatchResponse = await fetch('/deliveries/batches', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              robot: robotSelect.value,
              orderIds,
            }),
          });

          const trip = await dispatchResponse.json();

          if (!dispatchResponse.ok) {
            throw new Error(
              trip.error || 'Could not dispatch the robot.'
            );
          }

          content.innerHTML = `
            <h2>Robot Dispatched</h2>

            <p>
              ${trip.robot} is out on trip
              <strong>#${trip.delivery_id}</strong>
              with ${trip.order_count}
              order${trip.order_count === 1 ? '' : 's'}
              (${Number(trip.total_weight).toFixed(2)} lb).
            </p>

            <div id="dispatched-trip-map" style="margin: 16px 0;"></div>

            <a class="button primary" href="#/employee">
              Return to Dashboard
            </a>
          `;

          const mapContainer = content.querySelector('#dispatched-trip-map');
          if (mapContainer) {
            renderRouteMap(mapContainer, trip);
          }
        } catch (error) {
          message.textContent = error.message;
          message.className = 'shipping-message error';
          dispatchButton.disabled = false;
        }
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