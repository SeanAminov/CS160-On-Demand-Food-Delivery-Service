// Service for Google Maps API integration:
// 1. Geocoding delivery addresses into real coordinates
// 2. Multi-stop route optimization using Google Maps Routes API (WALK mode, since the robots ride on sidewalks)
// 3. Round-trip robot dispatch from the OFS Store Hub

const STORE_HUB = {
  name: 'OFS Downtown San Jose Hub',
  address: '1 Washington Sq, San Jose, CA 95192',
  lat: 37.3352,
  lng: -121.8811
};

// Encodes an array of {lat, lng} points into a standard Google-compatible polyline string
function encodePolyline(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  let prevLat = 0;
  let prevLng = 0;
  let result = '';

  for (const point of points) {
    const lat = Math.round(Number(point.lat) * 1e5);
    const lng = Math.round(Number(point.lng) * 1e5);

    result += encodeSignedNumber(lat - prevLat);
    result += encodeSignedNumber(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }
  return result;
}

function encodeSignedNumber(num) {
  let sgn = num < 0 ? ~(num << 1) : (num << 1);
  let s = '';
  while (sgn >= 0x20) {
    s += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  s += String.fromCharCode(sgn + 63);
  return s;
}

// Decodes a Google-encoded polyline string into an array of {lat, lng} points
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      lat: Number((lat / 1e5).toFixed(6)),
      lng: Number((lng / 1e5).toFixed(6))
    });
  }
  return points;
}

// Generates street-grid aligned path coordinates (turning at street corners rather than diagonal straight chords)
function generateGridPathway(stops) {
  const points = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i + 1];

    if (i === 0) {
      points.push({ lat: start.lat, lng: start.lng });
    }

    // Street corner inflection point (following East-West then North-South street grid)
    const corner = {
      lat: Number(start.lat.toFixed(6)),
      lng: Number(end.lng.toFixed(6))
    };

    points.push(corner);
    points.push({ lat: Number(end.lat.toFixed(6)), lng: Number(end.lng.toFixed(6)) });
  }
  return points;
}

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

// Modern Google Maps Routes API (computeRoutes) using WALK travel mode
// Delivery robots ride on sidewalks, so a walking route is the closest match, and
// walking times are close to how fast the robot goes
async function fetchFromRoutesApi(orders, departureDate, apiKey) {
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

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
    travelMode: 'WALK',
    optimizeWaypointOrder: orders.length > 1
  };

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
  const totalSeconds = parseSeconds(route.duration);

  const totalDistanceMiles = Number((totalMeters / 1609.344).toFixed(2));
  const totalDurationMinutes = Math.max(1, Math.round(totalSeconds / 60));

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
    travel_mode: 'WALK',
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

// Legacy Google Maps Directions API fallback (directions/json) using walking mode
async function fetchFromDirectionsApi(orders, departureDate, apiKey) {
  const origin = `${STORE_HUB.lat},${STORE_HUB.lng}`;
  const destination = `${STORE_HUB.lat},${STORE_HUB.lng}`;
  const waypoints = `${orders.length > 1 ? 'optimize:true|' : ''}${orders.map(o => `${o.delivery_lat},${o.delivery_lng}`).join('|')}`;

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}&mode=walking&key=${apiKey}`;

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
  let totalSeconds = 0;
  legs.forEach(leg => {
    totalMeters += leg.distance?.value || 0;
    const legSecs = leg.duration?.value || 0;
    totalSeconds += legSecs;
  });

  const totalDistanceMiles = Number((totalMeters / 1609.344).toFixed(2));
  const totalDurationMinutes = Math.max(1, Math.round(totalSeconds / 60));

  let cumulativeSeconds = 0;
  const orderedStops = waypointOrder.map((orderIndex, sequenceIndex) => {
    const order = (typeof orderIndex === 'number' && orders[orderIndex]) ? orders[orderIndex] : orders[sequenceIndex];
    const leg = legs[sequenceIndex];
    const legSeconds = leg?.duration?.value || 0;
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
    duration_minutes: Math.round((leg.duration?.value || 0) / 60)
  }));

  const routeInformation = {
    store_hub: STORE_HUB,
    round_trip: true,
    travel_mode: 'WALK',
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

// Fallback walking route for when there's no Google key or Google can't be reached:
// 1. Tries the free OpenStreetMap walking route server, which follows sidewalks and footpaths
// 2. If that can't be reached either, draws a path that turns at street corners instead of cutting through blocks
async function fetchFallbackWalkingRoute(orders, departureDate = new Date()) {
  const waypoints = [
    STORE_HUB,
    ...orders.map(o => ({ lat: Number(o.delivery_lat), lng: Number(o.delivery_lng) })),
    STORE_HUB
  ];

  let overviewPolyline = '';
  let totalDistanceMiles = Number(((orders.length + 1) * 0.75).toFixed(2));
  let totalDurationMinutes = (orders.length + 1) * 7;
  let legs = [];

  try {
    const coordStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
    const osrmUrl = `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coordStr}?overview=full&geometries=polyline`;
    // The server asks apps to say who they are
    const res = await fetch(osrmUrl, {
      headers: { 'User-Agent': 'OFS-Food-Delivery (SJSU CS160 class project)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.code === 'Ok' && data.routes && data.routes[0]) {
        const osrmRoute = data.routes[0];
        overviewPolyline = osrmRoute.geometry || '';
        totalDistanceMiles = Number(((osrmRoute.distance || 0) / 1609.344).toFixed(2));
        totalDurationMinutes = Math.max(1, Math.round((osrmRoute.duration || 0) / 60));
        legs = osrmRoute.legs || [];
      }
    }
  } catch {
    // Offline or the server is down, so draw the street corner path below
  }

  // If the route server wasn't reached or returned no geometry, generate a corner-turning grid path
  if (!overviewPolyline) {
    const gridPoints = generateGridPathway(waypoints);
    overviewPolyline = encodePolyline(gridPoints);
  }

  // Each stop's time adds up the legs before it, so the stop times and the total
  // come from the same route and always agree. Without a route, each leg is 7 minutes.
  let minutesSoFar = 0;
  const orderedStops = orders.map((order, idx) => {
    const leg = legs[idx];
    const legMinutes = leg ? leg.duration / 60 : 7;
    minutesSoFar += legMinutes;
    return {
      order,
      stop_sequence: idx + 1,
      estimated_arrival_minutes: Math.max(1, Math.round(minutesSoFar)),
      leg_distance_miles: leg ? Number((leg.distance / 1609.344).toFixed(2)) : 0.75,
      leg_duration_minutes: Math.max(1, Math.round(legMinutes))
    };
  });

  return {
    totalDistanceMiles,
    totalDurationMinutes,
    orderedStops,
    routeInformation: {
      store_hub: STORE_HUB,
      round_trip: true,
      travel_mode: 'WALK',
      waypoint_order: orders.map((_, idx) => idx),
      total_distance_miles: totalDistanceMiles,
      total_duration_minutes: totalDurationMinutes,
      departure_time: departureDate.toISOString(),
      overview_polyline: overviewPolyline,
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

// Requests an optimized multi-stop round-trip walking route.
// Uses Google Maps Routes API (or Directions API) in walking mode.
// Falls back to the OpenStreetMap walking route or a street-grid path when the API key is missing or calls fail.
async function getOptimizedRoute(orders, departureDate = new Date()) {
  if (!orders || orders.length === 0) {
    throw new Error('No orders provided for route optimization.');
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return await fetchFallbackWalkingRoute(orders, departureDate);
  }

  // 1. Primary: Google Maps Routes API (WALK mode)
  try {
    return await fetchFromRoutesApi(orders, departureDate, apiKey);
  } catch (routesErr) {
    // 2. Secondary fallback: Google Maps Directions API (walking mode)
    try {
      return await fetchFromDirectionsApi(orders, departureDate, apiKey);
    } catch (directionsErr) {
      console.warn('[Google Routing Error - Routes API]:', routesErr.message);
      console.warn('[Google Routing Error - Directions API]:', directionsErr.message);
      // 3. Fallback to the OpenStreetMap walking route or street grid so trips never fail completely
      return await fetchFallbackWalkingRoute(orders, departureDate);
    }
  }
}

module.exports = {
  STORE_HUB,
  geocodeAddress,
  getOptimizedRoute,
  approximateLocation,
  encodePolyline,
  decodePolyline,
  generateGridPathway
};
