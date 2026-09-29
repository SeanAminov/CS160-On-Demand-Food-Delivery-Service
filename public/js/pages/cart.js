// TODO: list the items in the cart with buttons to change the quantity or remove them
// TODO: show the subtotal and total weight, and update them after every change
// TODO: show the delivery fee (free under 20 lbs, $10 at 20 lbs or more)

export default {
  title: 'Cart',
  show(app) {
    app.innerHTML = `
      <h1>Your Cart</h1>
      <p class="muted">Coming soon.</p>
      <div class="buttons">
        <a class="button" href="#/catalog">Keep Shopping</a>
        <a class="button primary" href="#/checkout">Checkout</a>
      </div>
    `;
  },
};
