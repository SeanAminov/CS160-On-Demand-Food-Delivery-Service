const ordersToPack = [
  {
    id: 'ORD-001',
    customerName: 'Maria Garcia',
    itemCount: 4,
    placedAt: 'Today at 9:42 AM',
    status: 'Needs Packing',
  },
  {
    id: 'ORD-1002',
    customerName: 'James Wilson',
    itemCount: 2,
    placedAt: 'Today at 9:55 AM',
    status: 'Needs Packing',
  },
  {
    id: 'ORD-1006',
    customerName: 'Sofia Nguyen',
    itemCount: 5,
    placedAt: 'Today at 10:18 AM',
    status: 'Needs Packing',
  },
];

export default {
  title: 'Orders to Pack',

  show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Orders to Pack</h1>

        <p class="muted">
          These orders require employee attention.
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

      <section class="grid employee-stats">
        <div class="card employee-stat-card">
          <p class="muted">Orders to Pack</p>
          <h2>${ordersToPack.length}</h2>
          <small>Orders requiring employee action</small>
        </div>
      </section>

      <section class="employee-orders-section">
        <div class="employee-section-header">
          <div>
            <h2>Orders Waiting to Be Packed</h2>

            <p class="muted">
              Select an order to begin the packing process.
            </p>
          </div>
        </div>

        <div class="employee-order-list">
          ${ordersToPack
            .map(
              (order) => `
                <div class="card employee-order-card">
                  <div>
                    <strong>
                      ${order.id} - ${order.customerName}
                    </strong>

                    <p class="muted">
                      ${order.itemCount} items · ${order.placedAt}
                    </p>
                  </div>

                  <span class="order-status">
                    ${order.status}
                  </span>

                  <a
                    class="button primary" 
                    href="#/employee-order-packing?order=${order.id}">
                    Begin Packing
                  </a>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `;
  },
};