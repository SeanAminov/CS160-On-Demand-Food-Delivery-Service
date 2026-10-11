// TODO: list of orders that need to be packed - Done
// TODO: picking list with item quantities and weights 
// TODO: mark an order as Staged once it is packed
// TODO: send a delivery trip to the robot (up to 10 orders and 200 lbs)

const dashboardOrders = [
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
  title: 'Employee Dashboard',

  show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Employee Dashboard</h1>
      </section>

      <nav class="buttons employee-navigation">
        <a class="button primary" href="#/employee">
          Dashboard
        </a>

        <a class="button" href="#/employee-packing">
          Orders to Pack
        </a>

        <a class="button" href="#/employee-shipping">
          Waiting to Ship
        </a>
      </nav>

      <section class="grid employee-stats">
        <div class="card employee-stat-card">
          <p class="muted">Active Orders</p>
          <h2>24</h2>
          <small>Orders currently being processed</small>
        </div>

        <div class="card employee-stat-card">
          <p class="muted">Orders to Pack</p>
          <h2>8</h2>
          <small>Needs to be packed</small>
        </div>

        <div class="card employee-stat-card">
          <p class="muted">Waiting to Ship</p>
          <h2>5</h2>
          <small>Orders ready for robot shipment</small>
        </div>
      </section>

      <section class="employee-orders-section">
        <div class="employee-section-header">
          <div>
            <h2>Orders Needing Attention</h2>

            <p class="muted">
              These orders still need packing!
            </p>
          </div>

          <a class="button primary" href="#/employee-packing">
            View All Orders to Pack
          </a>
        </div>

        <div class="employee-order-list">
          ${dashboardOrders
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

                  <span class="order-arrow">
                    ›
                  </span>
                </div>
              `
        )
        .join('')}
        </div>
      </section>
    `;
  },
};