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

      <div class="card" style="max-width: 560px; margin-top: 20px;">
        <h2 style="margin-top: 0;">Delete Account</h2>
        <p class="muted">
          You won't be able to log in anymore, and orders that haven't shipped yet are
          cancelled and refunded. Your past orders stay in our records.
        </p>
        <button class="button account-delete-button" id="delete-account" type="button">Delete My Account</button>
        <p class="message" id="delete-message"></p>
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

    app.querySelector('#delete-account').addEventListener('click', async () => {
      const confirmed = window.confirm(
        "Are you sure you want to delete your account? You won't be able to log in again, and orders that haven't shipped will be cancelled and refunded."
      );
      if (!confirmed) return;

      const deleteMessage = app.querySelector('#delete-message');
      try {
        await cartRequest('DELETE', '/profile');
        // The login page says the account was deleted, and the header shows it's logged out
        window.location.hash = '#/login?deleted';
      } catch (err) {
        deleteMessage.textContent = err.message;
        deleteMessage.className = 'message';
      }
    });
  },
};
