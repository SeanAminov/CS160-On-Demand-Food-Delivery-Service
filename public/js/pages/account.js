import { cartRequest } from '../cart-api.js';
import { getUser } from '../user.js';
import { addressFields, readAddress } from '../address-form.js';

export default {
  title: 'My Account',
  async show(app) {
    const user = await getUser();
    if (!user) {
      app.innerHTML = `
        <h1>My Account</h1>
        <p class="muted">Please log in to see your account.</p>
        <a class="button primary" href="#/login">Log In</a>
      `;
      return;
    }

    let saved = null;
    try {
      const data = await cartRequest('GET', '/profile/address');
      saved = data.parts;
    } catch (err) {
      app.innerHTML = `<h1>My Account</h1><p class="message">${err.message}</p>`;
      return;
    }

    app.innerHTML = `
      <h1>My Account</h1>
      <p>Logged in as <b id="account-name"></b></p>

      <div class="card" style="max-width: 560px;">
        <h2 style="margin-top: 0;">Delivery Address</h2>
        <p class="muted" style="margin-bottom: 0;">Checkout fills this in for you.</p>
        <form id="address-form">
          ${addressFields(saved)}
          <div class="buttons">
            <button class="button primary" type="submit">Save Address</button>
          </div>
        </form>
        <p class="message" id="address-message"></p>
      </div>
    `;

    // textContent shows the name as plain text, even if it has symbols in it
    app.querySelector('#account-name').textContent = user.name;

    const form = app.querySelector('#address-form');
    const message = app.querySelector('#address-message');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const data = await cartRequest('PUT', '/profile/address', readAddress(form));
        form.querySelector('#city').value = data.parts.city;
        form.querySelector('#state').value = data.parts.state;
        message.textContent = `Address saved: ${data.address}`;
        message.className = 'message success';
      } catch (err) {
        message.textContent = err.message;
        message.className = 'message';
      }
    });
  },
};
