// The address boxes on the checkout and My Account pages.
// We only deliver in downtown San Jose, so the city and state start filled in.
export function addressFields(saved) {
  const parts = saved || {};
  return `
    <div class="address-fields">
      <label for="street">Street Address</label>
      <input id="street" type="text" placeholder="1 Washington Sq" value="${parts.street || ''}">

      <label for="unit">Apt, Suite, or Unit (optional)</label>
      <input id="unit" type="text" placeholder="Apt 4B" value="${parts.unit || ''}">

      <div class="address-row">
        <div class="address-city">
          <label for="city">City</label>
          <input id="city" type="text" value="${parts.city || 'San Jose'}">
        </div>
        <div>
          <label for="state">State</label>
          <input id="state" type="text" maxlength="2" value="${parts.state || 'CA'}">
        </div>
        <div>
          <label for="zip">ZIP Code</label>
          <input id="zip" type="text" inputmode="numeric" maxlength="5" placeholder="95192" value="${parts.zip || ''}">
        </div>
      </div>

      <p class="muted address-note">
        We deliver in downtown San Jose, ZIP codes 95110, 95112, 95113, 95116, and 95192.
      </p>
    </div>
  `;
}

// Reads what was typed into the address boxes. The server checks it and joins it into one line.
export function readAddress(container) {
  return {
    street: container.querySelector('#street').value.trim(),
    unit: container.querySelector('#unit').value.trim(),
    city: container.querySelector('#city').value.trim(),
    state: container.querySelector('#state').value.trim(),
    zip: container.querySelector('#zip').value.trim(),
  };
}
