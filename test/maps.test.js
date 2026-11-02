const { test, describe } = require('node:test');
const assert = require('node:assert');
require('dotenv').config();

const {
  STORE_HUB,
  geocodeAddress,
  getOptimizedRoute,
  approximateLocation,
  encodePolyline,
  decodePolyline,
  generateGridPathway
} = require('../maps');

describe('Maps & Delivery Robot Routing', () => {
  describe('Store Hub Configuration', () => {
    test('Hub has valid Downtown San Jose coordinates', () => {
      assert.strictEqual(typeof STORE_HUB.lat, 'number');
      assert.strictEqual(typeof STORE_HUB.lng, 'number');
      assert.ok(STORE_HUB.lat > 37.3 && STORE_HUB.lat < 37.4);
      assert.ok(STORE_HUB.lng < -121.8 && STORE_HUB.lng > -121.9);
      assert.ok(STORE_HUB.name.includes('San Jose'));
    });
  });

  describe('Polyline Encoding and Decoding', () => {
    test('Round-trips coordinates losslessly', () => {
      const originalPoints = [
        { lat: 37.3352, lng: -121.8811 },
        { lat: 37.3352, lng: -121.8863 },
        { lat: 37.3382, lng: -121.8863 },
        { lat: 37.3352, lng: -121.8811 }
      ];

      const encoded = encodePolyline(originalPoints);
      assert.ok(typeof encoded === 'string');
      assert.ok(encoded.length > 0);

      const decoded = decodePolyline(encoded);
      assert.strictEqual(decoded.length, originalPoints.length);

      for (let i = 0; i < originalPoints.length; i++) {
        assert.ok(Math.abs(decoded[i].lat - originalPoints[i].lat) < 0.0001);
        assert.ok(Math.abs(decoded[i].lng - originalPoints[i].lng) < 0.0001);
      }
    });

    test('Handles empty and invalid inputs gracefully', () => {
      assert.strictEqual(encodePolyline([]), '');
      assert.strictEqual(encodePolyline(null), '');
      assert.deepStrictEqual(decodePolyline(''), []);
      assert.deepStrictEqual(decodePolyline(null), []);
    });
  });

  describe('Street Grid Pathway Generation (Avoiding Straight Diagonal Chords)', () => {
    test('Generates intermediate corner turns instead of a single diagonal line', () => {
      const stops = [
        { lat: 37.3352, lng: -121.8811 },
        { lat: 37.3382, lng: -121.8863 }
      ];

      const pathway = generateGridPathway(stops);
      // Must generate intermediate corner turning point(s) rather than just start & end
      assert.ok(pathway.length >= 3);
      assert.strictEqual(pathway[0].lat, stops[0].lat);
      assert.strictEqual(pathway[0].lng, stops[0].lng);
      assert.strictEqual(pathway[pathway.length - 1].lat, stops[1].lat);
      assert.strictEqual(pathway[pathway.length - 1].lng, stops[1].lng);

      // Verify intermediate point is at a grid corner
      const corner = pathway[1];
      assert.ok(corner.lat === stops[0].lat || corner.lng === stops[1].lng);
    });
  });

  describe('Route Optimization & Legal Bike Lane Mode', () => {
    test('Throws error when no orders are provided', async () => {
      await assert.rejects(
        async () => {
          await getOptimizedRoute([]);
        },
        { message: 'No orders provided for route optimization.' }
      );
    });

    test('Generates valid bicycle pathway route with Google Maps or Fallback', async () => {
      const orders = [
        { order_id: 1, delivery_lat: 37.3382, delivery_lng: -121.8863, delivery_address: '100 E San Carlos St' },
        { order_id: 2, delivery_lat: 37.3330, delivery_lng: -121.8790, delivery_address: '400 S 8th St' }
      ];

      const route = await getOptimizedRoute(orders);

      assert.ok(route.totalDistanceMiles > 0);
      assert.ok(route.totalDurationMinutes > 0);
      assert.strictEqual(route.orderedStops.length, 2);
      assert.strictEqual(route.routeInformation.travel_mode, 'BICYCLE');
      assert.ok(typeof route.routeInformation.overview_polyline === 'string');
      assert.ok(route.routeInformation.overview_polyline.length > 0);

      // Verify the overview polyline decodes into legal pathway coordinates
      const decodedPoints = decodePolyline(route.routeInformation.overview_polyline);
      assert.ok(decodedPoints.length > 2, 'Pathway must contain multiple points along legal lanes');

      for (const pt of decodedPoints) {
        assert.ok(!isNaN(pt.lat) && !isNaN(pt.lng));
      }
    });

    test('Fallback routing (without API key) always generates a valid non-empty polyline following streets', async () => {
      const savedKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;

      try {
        const orders = [
          { order_id: 50, delivery_lat: 37.3360, delivery_lng: -121.8820, delivery_address: '200 E Santa Clara St' }
        ];

        const fallbackRoute = await getOptimizedRoute(orders);

        assert.strictEqual(fallbackRoute.routeInformation.travel_mode, 'BICYCLE');
        assert.ok(fallbackRoute.routeInformation.overview_polyline.length > 0);

        const decoded = decodePolyline(fallbackRoute.routeInformation.overview_polyline);
        assert.ok(decoded.length >= 3, 'Fallback must have street turn points, not a direct diagonal line');
      } finally {
        process.env.GOOGLE_MAPS_API_KEY = savedKey;
      }
    });
  });

  describe('Address Geocoding & Approximation', () => {
    test('approximateLocation produces deterministic coordinates around Downtown SJ', () => {
      const loc1 = approximateLocation('123 S 4th St, San Jose, CA 95112');
      const loc2 = approximateLocation('123 S 4th St, San Jose, CA 95112');
      assert.deepStrictEqual(loc1, loc2);
      assert.ok(loc1.lat > 37.3 && loc1.lat < 37.4);
      assert.ok(loc1.lng < -121.8 && loc1.lng > -121.95);
    });

    test('geocodeAddress falls back safely when API key is missing', async () => {
      const savedKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;

      try {
        const loc = await geocodeAddress('500 S 10th St, San Jose, CA 95112');
        assert.ok(typeof loc.lat === 'number');
        assert.ok(typeof loc.lng === 'number');
      } finally {
        process.env.GOOGLE_MAPS_API_KEY = savedKey;
      }
    });
  });
});
