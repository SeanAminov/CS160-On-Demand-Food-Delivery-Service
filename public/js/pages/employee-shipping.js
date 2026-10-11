const shippingOrders = [
  {
    id: 'ORD-1003',
    customerName: 'Priya Patel',
    itemCount: 6,
    packageType: 'Box',
    address: '789 First Street, San Jose',
    status: 'Ready to Ship',
    assignedRobot: '',
  },
  {
    id: 'ORD-1004',
    customerName: 'Daniel Lee',
    itemCount: 3,
    packageType: 'Bag',
    address: '321 Japantown Boulevard, San Jose',
    status: 'Ready to Ship',
    assignedRobot: '',
  },
  {
    id: 'ORD-1005',
    customerName: 'Sofia Nguyen',
    itemCount: 5,
    packageType: 'Box',
    address: '456 Willow Street, San Jose',
    status: 'Ready to Ship',
    assignedRobot: '',
  },
];

const robots = [
  'Robot R-01',
  'Robot R-02',
  'Robot R-03',
];

function renderShippingPage(app) {
  app.innerHTML = `
    <section class="hero">
      <h1>Waiting to Ship</h1>

      <p class="muted">
        Package shipments and assign a robot for delivery.
      </p>
    </section>

    <nav class="buttons employee-navigation">
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

    <section class="grid employee-stats">
      <div class="card employee-stat-card">
        <p class="muted">Packed Orders</p>
        <h2>${shippingOrders.length}</h2>
        <small>Ready for robot assignment</small>
      </div>

      <div class="card employee-stat-card">
        <p class="muted">Available Robots</p>
        <h2>${robots.length}</h2>
        <small>Robots available for delivery</small>
      </div>

      <div class="card employee-stat-card">
        <p class="muted">Out for Delivery</p>
        <h2>0</h2>
        <small>Orders dispatched this session</small>
      </div>
    </section>

    <section class="employee-orders-section">
      <div class="employee-section-header">
        <div>
          <h2>Assign Delivery Orders</h2>

          <p class="muted">
            Select a robot before sending an order for delivery.
          </p>
        </div>
      </div>

      <div class="shipping-order-list">
        ${shippingOrders
          .map(
            (order) => `
              <div class="card shipping-order-card">
                <div class="shipping-order-information">
                  <strong>
                    ${order.id} - ${order.customerName}
                  </strong>

                  <p class="muted">
                    ${order.itemCount} items ·
                    ${order.packageType} ·
                    ${order.address}
                  </p>

                  <span class="shipping-status">
                    ${order.status}
                  </span>
                </div>

                <div class="shipping-order-actions">
                  <label for="robot-${order.id}">
                    Assign Robot
                  </label>

                  <select
                    id="robot-${order.id}"
                    class="robot-select"
                    data-order-id="${order.id}"
                  >
                    <option value="">
                      Select a robot
                    </option>

                    ${robots
                      .map(
                        (robot) => `
                          <option value="${robot}">
                            ${robot}
                          </option>
                        `
                      )
                      .join('')}
                  </select>

                  <button
                    class="button primary send-delivery-button"
                    data-send-order="${order.id}"
                    disabled
                  >
                    Send for Delivery
                  </button>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;

  bindShippingEvents(app);
}

function bindShippingEvents(app) {
  app
    .querySelectorAll('.robot-select')
    .forEach((select) => {
      select.addEventListener('change', () => {
        const orderId = select.dataset.orderId;
        const selectedRobot = select.value;

        const order = shippingOrders.find(
          (currentOrder) => currentOrder.id === orderId
        );

        const sendButton = app.querySelector(
          `[data-send-order="${orderId}"]`
        );

        order.assignedRobot = selectedRobot;
        sendButton.disabled = !selectedRobot;
      });
    });

  app
    .querySelectorAll('.send-delivery-button')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const orderId = button.dataset.sendOrder;

        const order = shippingOrders.find(
          (currentOrder) => currentOrder.id === orderId
        );

        if (!order.assignedRobot) {
          return;
        }

        order.status = 'Out for Delivery';

        alert(
          `${order.id} has been assigned to ${order.assignedRobot}.`
        );

        renderShippingPage(app);
      });
    });
}

export default {
  title: 'Waiting to Ship',

  show(app) {
    renderShippingPage(app);
  },
};