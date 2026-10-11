const packingOrders = [
  {
    id: 'ORD-001',
    customerName: 'Maria Garcia',
    address: '123 Market Street, San Jose',
    placedAt: 'Today at 9:42 AM',
    packageType: '',
    status: 'Needs Packing',
    items: [
      {
        itemNumber: 'APL-001',
        name: 'Organic Apples',
        quantity: 2,
        scannedQuantity: 0,
      },
      {
        itemNumber: 'MLK-002',
        name: 'Whole Milk',
        quantity: 1,
        scannedQuantity: 0,
      },
      {
        itemNumber: 'BRD-003',
        name: 'Sourdough Bread',
        quantity: 1,
        scannedQuantity: 0,
      },
    ],
  },

  {
    id: 'ORD-1002',
    customerName: 'James Wilson',
    address: '456 Santa Clara Street, San Jose',
    placedAt: 'Today at 9:55 AM',
    packageType: '',
    status: 'Needs Packing',
    items: [
      {
        itemNumber: 'BAN-004',
        name: 'Bananas',
        quantity: 1,
        scannedQuantity: 0,
      },
      {
        itemNumber: 'EGG-005',
        name: 'Organic Eggs',
        quantity: 1,
        scannedQuantity: 0,
      },
    ],
  },

  {
    id: 'ORD-1006',
    customerName: 'Sofia Nguyen',
    address: '789 First Street, San Jose',
    placedAt: 'Today at 10:18 AM',
    packageType: '',
    status: 'Needs Packing',
    items: [
      {
        itemNumber: 'CAR-006',
        name: 'Organic Carrots',
        quantity: 2,
        scannedQuantity: 0,
      },
      {
        itemNumber: 'RCE-007',
        name: 'White Rice',
        quantity: 1,
        scannedQuantity: 0,
      },
      {
        itemNumber: 'JCE-008',
        name: 'Orange Juice',
        quantity: 1,
        scannedQuantity: 0,
      },
    ],
  },
];


function getSelectedOrder() {
    const queryString = window.location.hash.split('?')[1];
    const params = new URLSearchParams(queryString);
    const orderId = params.get('order') || 'ORD-001';

    return (
        packingOrders.find((order) => order.id === orderId) || packingOrders[0]

    );
}

function getTotalItems(order) {
    return order.items.reduce((total, item) => total + item.quantity, 0);
}

function getConfirmedItems(order) {
    return order.items.reduce((total, item) => total + item.scannedQuantity, 0);
}

function orderIsComplete(order) {
  return order.items.every((item) => item.scannedQuantity >= item.quantity);
}

function renderOrder(app, order) {
    const totalItems = getTotalItems(order);
    const confirmedItems = getConfirmedItems(order);
    const progress = Math.round((confirmedItems / totalItems) * 100);

app.innerHTML = `
    <section class="hero">
      <h1>Begin Packing</h1>

      <p>
        <strong>${order.id}</strong>
        · ${order.customerName}
      </p>

      <p class="muted">
        ${order.address}
      </p>

      <p class="muted">
        Placed ${order.placedAt}
      </p>
    </section>

    <nav class="buttons employee-navigation">
      <a class="button" href="#/employee">
        Dashboard
      </a>

      <a class="button primary" href="#/employee-packing">
        Orders to Pack
      </a>
    </nav>

    <div class="packing-layout">
      <section class="card">
        <h2>Order Items</h2>

        <p class="muted">
          Scan or manually enter each item in the order.
        </p>

        <p>
          <strong>${confirmedItems} / ${totalItems}</strong>
          items confirmed
        </p>

        <div class="packing-progress">
          <div style="width: ${progress}%"></div>
        </div>

        <div class="packing-items">
          ${order.items
            .map(
              (item) => `
                <div class="packing-item ${
                  item.scannedQuantity >= item.quantity
                    ? 'confirmed'
                    : ''
                }">
                  <span class="packing-check">
                    ${
                      item.scannedQuantity >= item.quantity
                        ? '✓'
                        : ''
                    }
                  </span>

                  <div>
                    <strong>${item.name}</strong>

                    <p class="muted">
                      Item Number: ${item.itemNumber}
                    </p>

                    <p class="muted">
                      Required Quantity: ${item.quantity}
                    </p>
                  </div>

                  <small>
                    ${item.scannedQuantity} / ${item.quantity}
                  </small>
                </div>
              `
            )
            .join('')}
        </div>

        <form id="scan-form" class="scan-form">
          <label for="item-number">
            Scan or manually enter an item number
          </label>

          <div class="scan-controls">
            <input
              id="item-number"
              type="text"
              placeholder="Example: APL-001"
              autocomplete="off"
            />

            <button class="button primary" type="submit">
              Add Item
            </button>
          </div>

          <p id="scan-message" class="scan-message"></p>
        </form>
      </section>

      <section class="card">
        <h2>Package Confirmation</h2>

        <p class="muted">
          Select the package used for this order.
        </p>

        <div class="package-options">
          <label>
            <input
              type="radio"
              name="packageType"
              value="Box"
              ${order.packageType === 'Box' ? 'checked' : ''}
            />
            Box
          </label>

          <label>
            <input
              type="radio"
              name="packageType"
              value="Bag"
              ${order.packageType === 'Bag' ? 'checked' : ''}
            />
            Bag
          </label>
        </div>

        <p class="packing-note">
          ${
            orderIsComplete(order)
              ? 'All items have been confirmed.'
              : 'Every item must be confirmed before shipping.'
          }
        </p>

        <button
          id="ready-button"
          class="button primary full-width"
          ${
            orderIsComplete(order) && order.packageType
              ? ''
              : 'disabled'
          }
        >
          Mark Ready to Ship
        </button>
      </section>
    </div>
  `;

  bindPackingEvents(app, order);
}


function bindPackingEvents(app, order) {
  const scanForm = app.querySelector('#scan-form');
  const input = app.querySelector('#item-number');
  const message = app.querySelector('#scan-message');

  scanForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const enteredItemNumber = input.value.trim().toUpperCase();

    if (!enteredItemNumber) {
      message.textContent =
        'Please enter or scan an item number.';
      message.className = 'scan-message error';
      return;
    }

    const item = order.items.find(
      (currentItem) =>
        currentItem.itemNumber.toUpperCase() ===
        enteredItemNumber
    );

    if (!item) {
      message.textContent =
        'This item does not belong to this order.';
      message.className = 'scan-message error';
      input.select();
      return;
    }

    if (item.scannedQuantity >= item.quantity) {
      message.textContent =
        'This item has already been fully confirmed.';
      message.className = 'scan-message error';
      input.select();
      return;
    }

    item.scannedQuantity += 1;

    renderOrder(app, order);
  }
);

  app
    .querySelectorAll('input[name="packageType"]')
    .forEach((radio) => {
      radio.addEventListener('change', () => {
        order.packageType = radio.value;

        const readyButton =
          app.querySelector('#ready-button');

        readyButton.disabled = !(
          orderIsComplete(order) &&
          order.packageType
        );
      });
    });

  app
    .querySelector('#ready-button')
    .addEventListener('click', () => {
      if (!orderIsComplete(order) || !order.packageType) {
        return;
      }

      order.status = 'Ready to Ship';

      app.innerHTML = `
        <section class="hero">
          <h1>Order Ready to Ship</h1>

          <p>
            Order <strong>${order.id}</strong>
            has been packed successfully.
          </p>

          <p class="muted">
            Package type: ${order.packageType}
          </p>

          <a
            class="button primary"
            href="#/employee-packing"
          >
            Return to Orders to Pack
          </a>
        </section>
      `;
    });
}

export default {
  title: 'Begin Packing',

  show(app) {
    const order = getSelectedOrder();
    renderOrder(app, order);
  },
};