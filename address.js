const { geocodeAddress, approximateLocation } = require('./maps');

// Address rules shared by checkout and the My Account page.
// We only deliver in downtown San Jose, so the city has to be San Jose,
// the state has to be CA, and the ZIP code has to be one of these.
const DOWNTOWN_ZIPS = ['95110', '95112', '95113', '95116', '95192'];

// Letters (accents are fine), numbers, spaces, and the punctuation addresses use.
// This also keeps HTML out of the pages that show addresses to employees.
const ADDRESS_TEXT = /^[\p{L}\d ,.#'\/-]+$/u;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Checks the address boxes someone filled in. If something is wrong, this gives back
// the status code and error to send. If it's fine, it gives back the cleaned up parts,
// the whole address on one line for the order, and its map location.
async function checkAddress(input) {
  const fields = input || {};
  const parts = {
    street: clean(fields.street),
    unit: clean(fields.unit),
    city: clean(fields.city),
    state: clean(fields.state).toUpperCase(),
    zip: clean(fields.zip)
  };

  if (!parts.street) {
    return { status: 400, error: 'Please enter your street address.' };
  }
  if (parts.street.length > 150 || parts.unit.length > 50) {
    return { status: 400, error: 'That address is too long.' };
  }
  if (!ADDRESS_TEXT.test(parts.street) || (parts.unit && !ADDRESS_TEXT.test(parts.unit))) {
    return { status: 400, error: 'Please only use letters, numbers, spaces, and basic punctuation in the address.' };
  }
  if (!/^\d{5}$/.test(parts.zip)) {
    return { status: 400, error: 'Please enter a 5 digit ZIP code.' };
  }
  if (parts.city.toLowerCase() !== 'san jose' || parts.state !== 'CA' || !DOWNTOWN_ZIPS.includes(parts.zip)) {
    return {
      status: 422,
      error: `Sorry, we only deliver in downtown San Jose, CA (ZIP codes ${DOWNTOWN_ZIPS.join(', ')}).`
    };
  }
  parts.city = 'San Jose';

  // The database keeps the whole address on one line
  const unitText = parts.unit ? `, ${parts.unit}` : '';
  const address = `${parts.street}${unitText}, San Jose, CA ${parts.zip}`;

  try {
    const coords = await geocodeAddress(address);
    return { parts, address, lat: coords.lat, lng: coords.lng };
  } catch (err) {
    return { status: err.status || 422, error: err.message || 'Could not verify address location.' };
  }
}

// Splits a saved address line back into the boxes on the page. Every line is
// built the same way above (street, unit, San Jose, CA zip), so it comes apart cleanly.
function splitAddress(line) {
  if (!line) {
    return null;
  }
  const match = /^(.*), San Jose, CA (\d{5})$/.exec(line);
  if (!match) {
    // Not in our usual format, so put it all in the street box to be fixed
    return { street: line, unit: '', city: 'San Jose', state: 'CA', zip: '' };
  }
  const [street, ...unit] = match[1].split(', ');
  return { street, unit: unit.join(', '), city: 'San Jose', state: 'CA', zip: match[2] };
}

module.exports = { checkAddress, splitAddress };
