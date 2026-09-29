// TODO: current orders and their status (Pending, Preparing, Staged, Out for Delivery, Delivered)
// TODO: order history with receipts
// TODO: map to track orders that are out for delivery

export default {
  title: 'My Orders',
  show(app) {
    app.innerHTML = `
      <h1>My Orders</h1>
      <p class="muted">Coming soon.</p>
    `;
  },
};
