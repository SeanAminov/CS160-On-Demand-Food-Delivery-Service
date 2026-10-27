// Service for Google Maps API integration:
// 1. Geocoding delivery addresses into real coordinates
// 2. Multi-stop route optimization using Google Maps Routes API (with live departure traffic)
// 3. Round-trip robot dispatch from the OFS Store Hub

const STORE_HUB = {
  name: 'OFS Downtown San Jose Hub',
  address: '1 Washington Sq, San Jose, CA 95192',
  lat: 37.3352,
  lng: -121.8811
};

// Deterministic coordinate calculation used as a fallback when GOOGLE_MAPS_API_KEY is not set.
// Keeps development and testing seamless for team members without an API key.
function approximateLocation(address) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash << 5) - hash + address.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 1000) / 50000) * (hash % 2 === 0 ? 1 : -1);
  const lngOffset = ((Math.abs(hash >> 3) % 1000) / 50000) * (hash % 2 === 0 ? 1 : -1);

  return {
    lat: Number((STORE_HUB.lat + latOffset).toFixed(6)),
    lng: Number((STORE_HUB.lng + lngOffset).toFixed(6))
  };
}

// Converts a street address into coordinates using Google Maps Geocoding API.
// Falls back to approximate coordinates if GOOGLE_MAPS_API_KEY is missing.
async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // When no API key is provided, use deterministic Downtown San Jose coordinates
    return approximateLocation(address);
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Geocoding HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status === 'ZERO_RESULTS') {
    const error = new Error('Could not find that address on Google Maps. Please check your street and ZIP code.');
    error.status = 422;
    throw error;
  }

  if (data.status !== 'OK') {
    console.error('[Google Geocoding Error]:', data.status, data.error_message || '');
    const error = new Error(`Google Maps Geocoding failed: ${data.status} ${data.error_message || ''}`.trim());
    error.status = 502;
    throw error;
  }

  const location = data.results[0]?.geometry?.location;
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    throw new Error('Google Geocoding returned an invalid location.');
  }

  return {
    lat: Number(location.lat.toFixed(6)),
    lng: Number(location.lng.toFixed(6)),
    formattedAddress: data.results[0].formatted_address
  };
}

// Parses duration string from Google Routes API (e.g. "360s" -> 360 seconds)
function parseSeconds(durationStr) {
  if (!durationStr) return 0;
  if (typeof durationStr === 'number') return durationStr;
  return parseInt(String(durationStr).replace('s', ''), 10) || 0;
}

// Modern Google Maps Routes API (computeRoutes) with waypoint optimization and traffic
async function fetchFromRoutesApi(orders, departureDate, apiKey) {
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

  const now = Date.now();
  const isFuture = departureDate && (departureDate.getTime() - now > 60000);

  const requestBody = {
    origin: {
      location: {
        latLng: { latitude: STORE_HUB.lat, longitude: STORE_HUB.lng }
      }
    },
    destination: {
      location: {
        latLng: { latitude: STORE_HUB.lat, longitude: STORE_HUB.lng }
      }
    },
    intermediates: orders.map(o => ({
      location: {
        latLng: { latitude: Number(o.delivery_lat), longitude: Number(o.delivery_lng) }
      }
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    optimizeWaypointOrder: orders.length > 1
  };

  // Google Routes API requires departureTime to be strictly in the future; omitting it defaults to now
  if (isFuture) {
    requestBody.departureTime = departureDate.toISOString();
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimizedIntermediateWaypointIndex'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `Google Routes API HTTP error: ${response.status}`);
  }

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) {
    throw new Error('Google Routes API returned no routes.');
  }

  // Google returns [-1] or undefined for optimizedIntermediateWaypointIndex when orders.length <= 1
  let waypointOrder = orders.map((_, i) => i);
  if (
    orders.length > 1 &&
    Array.isArray(route.optimizedIntermediateWaypointIndex) &&
    route.optimizedIntermediateWaypointIndex.length === orders.length &&
    route.optimizedIntermediateWaypointIndex.every(idx => typeof idx === 'number' && idx >= 0 && idx < orders.length)
  ) {
    waypointOrder = route.optimizedIntermediateWaypointIndex;
  }

  const legs = route.legs || [];

  const totalMeters = route.distanceMeters || 0;
  const totalTrafficSeconds = parseSeconds(route.duration);

  const totalDistanceMiles = Number((totalMeters / 1609.344).toFixed(2));
  const totalDurationMinutes = Math.max(1, Math.round(totalTrafficSeconds / 60));

  let cumulativeSeconds = 0;
  const orderedStops = waypointOrder.map((orderIndex, sequenceIndex) => {
    const order = (typeof orderIndex === 'number' && orders[orderIndex]) ? orders[orderIndex] : orders[sequenceIndex];
    const leg = legs[sequenceIndex];
    const legSeconds = parseSeconds(leg?.duration);
    cumulativeSeconds += legSeconds;

    return {
      order,
      stop_sequence: sequenceIndex + 1,
      estimated_arrival_minutes: Math.max(1, Math.round(cumulativeSeconds / 60)),
      leg_distance_miles: Number(((leg?.distanceMeters || 0) / 1609.344).toFixed(2)),
      leg_duration_minutes: Math.max(1, Math.round(legSeconds / 60))
    };
  });

  const summarizedLegs = legs.map((leg, idx) => ({
    leg_index: idx,
    distance_miles: Number(((leg.distanceMeters || 0) / 1609.344).toFixed(2)),
    duration_minutes: Math.round(parseSeconds(leg.duration) / 60)
  }));

  const routeInformation = {
    store_hub: STORE_HUB,
    round_trip: true,
    departure_time: departureDate.toISOString(),
    total_distance_miles: totalDistanceMiles,
    total_duration_minutes: totalDurationMinutes,
    waypoint_order: waypointOrder,
    overview_polyline: route.polyline?.encodedPolyline || '',
    legs: summarizedLegs,
    stops: orderedStops.map(s => ({
      order_id: s.order.order_id,
      stop_sequence: s.stop_sequence,
      address: s.order.delivery_address,
      lat: s.order.delivery_lat,
      lng: s.order.delivery_lng,
      estimated_arrival_minutes: s.estimated_arrival_minutes
    }))
  };

  return {
    totalDistanceMiles,
    totalDurationMinutes,
    orderedStops,
    routeInformation
  };
}

// Legacy Google Maps Directions API fallback (directions/json)
async function fetchFromDirectionsApi(orders, departureDate, apiKey) {
  const origin = `${STORE_HUB.lat},${STORE_HUB.lng}`;
  const destination = `${STORE_HUB.lat},${STORE_HUB.lng}`;
  const waypoints = `${orders.length > 1 ? 'optimize:true|' : ''}${orders.map(o => `${o.delivery_lat},${o.delivery_lng}`).join('|')}`;
  const departureTimestamp = Math.floor(departureDate.getTime() / 1000);

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&departure_time=${departureTimestamp}&traffic_model=best_guess&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Directions HTTP error: ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== 'OK') {
    throw new Error(`Google Directions API error: ${data.status} ${data.error_message || ''}`.trim());
  }

  const route = data.routes[0];
  let waypointOrder = orders.map((_, i) => i);
  if (
    orders.length > 1 &&
    Array.isArray(route.waypoint_order) &&
    route.waypoint_order.length === orders.length &&
    route.waypoint_order.every(idx => typeof idx === 'number' && idx >= 0 && idx < orders.length)
  ) {
    waypointOrder = route.waypoint_order;
  }
  const legs = route.legs || [];

  let totalMeters = 0;
  let totalTrafficSeconds = 0;
  legs.forEach(leg => {
    totalMeters += leg.distance?.value || 0;
    const legSecs = leg.duration_in_traffic ? leg.duration_in_traffic.value : (leg.duration?.value || 0);
    totalTrafficSeconds += legSecs;
  });

  const totalDistanceMiles = Number((totalMeters / 1609.344).toFixed(2));
  const totalDurationMinutes = Math.max(1, Math.round(totalTrafficSeconds / 60));

  let cumulativeSeconds = 0;
  const orderedStops = waypointOrder.map((orderIndex, sequenceIndex) => {
    const order = (typeof orderIndex === 'number' && orders[orderIndex]) ? orders[orderIndex] : orders[sequenceIndex];
    const leg = legs[sequenceIndex];
    const legSeconds = leg?.duration_in_traffic ? leg.duration_in_traffic.value : (leg?.duration?.value || 0);
    cumulativeSeconds += legSeconds;

    return {
      order,
      stop_sequence: sequenceIndex + 1,
      estimated_arrival_minutes: Math.max(1, Math.round(cumulativeSeconds / 60)),
      leg_distance_miles: Number(((leg?.distance?.value || 0) / 1609.344).toFixed(2)),
      leg_duration_minutes: Math.max(1, Math.round(legSeconds / 60))
    };
  });

  const summarizedLegs = legs.map((leg, idx) => ({
    leg_index: idx,
    start_address: leg.start_address,
    end_address: leg.end_address,
    distance_miles: Number(((leg.distance?.value || 0) / 1609.344).toFixed(2)),
    duration_minutes: Math.round((leg.duration?.value || 0) / 60),
    duration_in_traffic_minutes: leg.duration_in_traffic ? Math.round(leg.duration_in_traffic.value / 60) : null
  }));

  const routeInformation = {
    store_hub: STORE_HUB,
    round_trip: true,
    departure_time: departureDate.toISOString(),
    total_distance_miles: totalDistanceMiles,
    total_duration_minutes: totalDurationMinutes,
    waypoint_order: waypointOrder,
    overview_polyline: route.overview_polyline?.points || '',
    legs: summarizedLegs,
    stops: orderedStops.map(s => ({
      order_id: s.order.order_id,
      stop_sequence: s.stop_sequence,
      address: s.order.delivery_address,
      lat: s.order.delivery_lat,
      lng: s.order.delivery_lng,
      estimated_arrival_minutes: s.estimated_arrival_minutes
    }))
  };

  return {
    totalDistanceMiles,
    totalDurationMinutes,
    orderedStops,
    routeInformation
  };
}

// Requests an optimized multi-stop round-trip route from Google Maps Routes API (or Directions API)
// with departure_time='now' and traffic conditions.
// Returns the optimal stop sequence, traffic-based arrival times, distance, and overview polyline.
async function getOptimizedRoute(orders, departureDate = new Date()) {
  if (!orders || orders.length === 0) {
    throw new Error('No orders provided for route optimization.');
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // Fallback calculation if no API key is present
  if (!apiKey) {
    const estimatedDistance = Number(((orders.length + 1) * 0.75).toFixed(2));
    const estimatedDuration = (orders.length + 1) * 7;

    const orderedStops = orders.map((order, idx) => ({
      order,
      stop_sequence: idx + 1,
      estimated_arrival_minutes: (idx + 1) * 7,
      leg_distance_miles: 0.75,
      leg_duration_minutes: 7
    }));

    return {
      totalDistanceMiles: estimatedDistance,
      totalDurationMinutes: estimatedDuration,
      orderedStops,
      routeInformation: {
        store_hub: STORE_HUB,
        round_trip: true,
        waypoint_order: orders.map((_, idx) => idx),
        total_distance_miles: estimatedDistance,
        total_duration_minutes: estimatedDuration,
        departure_time: departureDate.toISOString(),
        stops: orderedStops.map(s => ({
          order_id: s.order.order_id,
          stop_sequence: s.stop_sequence,
          address: s.order.delivery_address,
          lat: s.order.delivery_lat,
          lng: s.order.delivery_lng,
          estimated_arrival_minutes: s.estimated_arrival_minutes
        }))
      }
    };
  }

  // 1. Primary: Google Maps Routes API (v2 computeRoutes)
  try {
    return await fetchFromRoutesApi(orders, departureDate, apiKey);
  } catch (routesErr) {
    // 2. Secondary fallback: Google Maps Directions API (legacy v1)
    try {
      return await fetchFromDirectionsApi(orders, departureDate, apiKey);
    } catch (directionsErr) {
      console.error('[Google Routing Error - Routes API]:', routesErr.message);
      console.error('[Google Routing Error - Directions API]:', directionsErr.message);
      const error = new Error(`Google route optimization failed: ${routesErr.message || directionsErr.message}`);
      error.status = 502;
      throw error;
    }
  }
}

module.exports = {
  STORE_HUB,
  geocodeAddress,
  getOptimizedRoute,
  approximateLocation
};
