export default {
  title: 'Home',
  show(app) {
    app.innerHTML = `
      <section class="hero">
        <h1>Organic groceries delivered in downtown San Jose</h1>
        <p>Order fresh fruit, vegetables, and pantry staples online. Delivery is free on orders under 20 pounds.</p>
        <div class="buttons">
          <a class="button primary" href="#/catalog">Shop Now</a>
          <a class="button" href="#/login">Log In or Register</a>
        </div>
      </section>

      <div class="grid">
        <a class="card" href="#/cart">
          <h2>Cart</h2>
          <p class="muted">See your items, total price, and total weight</p>
        </a>
        <a class="card" href="#/checkout">
          <h2>Checkout</h2>
          <p class="muted">Delivery fee, tax, and payment</p>
        </a>
        <a class="card" href="#/orders">
          <h2>My Orders</h2>
          <p class="muted">Track current orders and past purchases</p>
        </a>
      </div>

      <h2>Store staff</h2>
      <div class="buttons">
        <a class="button" href="#/employee">Employee Dashboard</a>
        <a class="button" href="#/manager">Manager Dashboard</a>
      </div>
    `;
  },
};
