import { getUser } from '../user.js';

export default {
  title: 'Home',
  async show(app) {
    // The login button is only for people who aren't logged in,
    // and the dashboard buttons are only for staff
    const user = await getUser();
    const role = user ? user.role : '';

    app.innerHTML = `
     <div class="hero-slide">
        <img id="slide-body"
          src="/images/OFS_Homepage_2.jpg"
          alt="Organic Foods"
        />
        <button class="slide-arrow left"
          id="prev-slide"
          aria-label="Previous image">&#10094;
        </button>
        <button class="slide-arrow right"
          id="next-slide"
          aria-label="Next image">&#10095;
        </button>
     </div>
      <section class="hero">
        <h1>Organic groceries delivered in downtown San Jose</h1>
        <p>Order fresh fruit, vegetables, and pantry staples online. Delivery is free on orders under 20 pounds.</p>
        <div class="buttons">
          <a class="button primary" href="#/catalog">Shop Now</a>
          ${user ? '' : '<a class="button" href="#/login">Log In or Register</a>'}
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

      ${role === 'employee' || role === 'manager' ? `
        <h2>Store staff</h2>
        <div class="buttons">
          <a class="button" href="#/employee">Employee Dashboard</a>
          ${role === 'manager' ? '<a class="button" href="#/manager">Manager Dashboard</a>' : ''}
        </div>
      ` : ''}
    `;
    const images = [
      '/images/OFS_Homepage_2.jpg',
      '/images/OFS_Homepage.webp',
      '/images/OFS_Homepage_3.jpg'
    ];

    let currentSlide = 0;

    const slide = app.querySelector('#slide-body');

    function showSlide(index) {
      currentSlide = (index + images.length) % images.length;
      slide.src = images[currentSlide];
    }

    app.querySelector('#prev-slide').addEventListener('click', () => {
      showSlide(currentSlide - 1);
    });

    app.querySelector('#next-slide').addEventListener('click', () => {
      showSlide(currentSlide + 1);
    });
  },
};
