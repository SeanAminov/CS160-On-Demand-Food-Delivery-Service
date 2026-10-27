// Interactive Visual Route Map for Delivery Trips & Customer Order Tracking
// Supports Google Maps JavaScript API when GOOGLE_MAPS_API_KEY is configured.
// Provides a seamless interactive OpenStreetMap / Leaflet fallback when key is not yet set.

const STORE_HUB = {
  name: 'OFS Downtown San Jose Hub',
  address: '1 Washington Sq, San Jose, CA 95192',
  lat: 37.3352,
  lng: -121.8811
};

// Polyline decoder for Google Maps encoded polylines
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

// Fetch Google Maps API key from the server
let cachedApiKey = undefined;
async function fetchMapsKey() {
  if (cachedApiKey !== undefined) return cachedApiKey;
  try {
    const res = await fetch('/maps-key');
    if (res.ok) {
      const data = await res.json();
      cachedApiKey = data.apiKey || null;
      return cachedApiKey;
    }
  } catch {
    // If route fails, treat as no key
  }
  cachedApiKey = null;
  return null;
}

// Dynamically load Google Maps JavaScript API
let googleMapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (googleMapsPromise) {
    return googleMapsPromise;
  }
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error('Failed to load Google Maps JavaScript API.'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
}

// Dynamically load Leaflet for key-free interactive map fallback
let leafletPromise = null;
function loadLeaflet() {
  if (window.L) {
    return Promise.resolve(window.L);
  }
  if (leafletPromise) {
    return leafletPromise;
  }
  leafletPromise = new Promise((resolve, reject) => {
    // Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inject Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Failed to load interactive map engine.'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

/**
 * Renders an interactive visual route map inside containerElement for a trip.
 * @param {HTMLElement} containerElement - DOM node to host the map
 * @param {Object} trip - The trip object containing route_parsed/route_information, orders, delivery_id, etc.
 * @param {Object} options - Optional configuration { focusOrderId: number }
 */
export async function renderRouteMap(containerElement, trip, options = {}) {
  if (!containerElement) return;

  const focusOrderId = options.focusOrderId ? Number(options.focusOrderId) : null;
  const orders = Array.isArray(trip.orders) ? [...trip.orders].sort((a, b) => a.stop_sequence - b.stop_sequence) : [];
  const routeData = trip.route_parsed || (typeof trip.route_information === 'string' ? JSON.parse(trip.route_information || '{}') : (trip.route_information || {}));
  const hub = routeData.store_hub || STORE_HUB;

  const mapCanvasId = `map-canvas-${trip.delivery_id || 'order'}-${Math.floor(Math.random() * 10000)}`;

  containerElement.innerHTML = `
    <div class="route-map-wrapper">
      <div class="route-map-header">
        <div>
          <h3 style="margin: 0 0 4px; font-size: 16px;">
            <i class='bx bx-map-pin' style="color: #2f6f3e;"></i>
            Trip #${trip.delivery_id} Route Map &bull; ${trip.robot || 'Autonomous Robot'}
          </h3>
          <span class="muted" style="font-size: 13px;">
            Store Hub: <b>${hub.name}</b> &bull; Round Trip Circuit (${orders.length} stops)
          </span>
        </div>
        <div style="font-size: 13px; text-align: right;">
          <div>Est. Distance: <b>${trip.total_distance || 0} mi</b></div>
          <div>Est. Duration: <b>${trip.estimated_duration || 0} mins</b> (with traffic)</div>
        </div>
      </div>

      <div id="${mapCanvasId}" class="route-map-canvas" style="height: 380px; width: 100%; border-radius: 6px; margin: 12px 0;">
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
          <i class='bx bx-loader-alt bx-spin' style="font-size: 24px; margin-right: 8px;"></i> Loading route map...
        </div>
      </div>

      <div class="route-map-status-bar" id="status-${mapCanvasId}"></div>

      <!-- Stop Sequence Itinerary -->
      <div class="route-stops-container">
        <h4 style="margin: 8px 0; font-size: 14px;">Optimized Delivery Itinerary (Departure Traffic Applied):</h4>
        <div class="route-stops-timeline">
          <div class="route-stop-card hub-card">
            <span class="stop-badge hub-badge">Hub</span>
            <div class="stop-info">
              <strong>${hub.name} (Departure Point)</strong>
              <div class="muted" style="font-size: 12px;">${hub.address}</div>
            </div>
            <div class="stop-eta" style="color: #2f6f3e; font-weight: bold; font-size: 13px;">Departed</div>
          </div>

          ${orders.map((o) => {
            const isFocus = focusOrderId && Number(o.order_id) === focusOrderId;
            return `
              <div class="route-stop-card ${isFocus ? 'focus-card' : ''}" style="${isFocus ? 'border: 2px solid #047857; background: #eef7f0;' : ''}">
                <span class="stop-badge ${isFocus ? 'focus-badge' : ''}" style="${isFocus ? 'background: #047857;' : ''}">#${o.stop_sequence}</span>
                <div class="stop-info">
                  <strong>Order #${o.order_id} &mdash; ${o.customer_name || 'Customer'}${isFocus ? ' <span style="background: #047857; color: white; padding: 2px 7px; border-radius: 10px; font-size: 11px; margin-left: 6px;">Your Delivery</span>' : ''}</strong>
                  <div class="muted" style="font-size: 12px;">${o.delivery_address} &bull; ${Number(o.total_weight).toFixed(2)} lb</div>
                </div>
                <div class="stop-eta" style="font-size: 13px;">
                  ${o.estimated_arrival ? `ETA: <b>${new Date(o.estimated_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b>` : 'In Transit'}
                </div>
              </div>
            `;
          }).join('')}

          <div class="route-stop-card hub-card">
            <span class="stop-badge hub-badge">Hub</span>
            <div class="stop-info">
              <strong>${hub.name} (Return to Base)</strong>
              <div class="muted" style="font-size: 12px;">Robot returns to station to recharge & restock</div>
            </div>
            <div class="stop-eta" style="color: #2f6f3e; font-weight: bold; font-size: 13px;">Round Trip Completed</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = document.getElementById(mapCanvasId);
  const statusBar = document.getElementById(`status-${mapCanvasId}`);
  const apiKey = await fetchMapsKey();

  if (apiKey) {
    try {
      await loadGoogleMaps(apiKey);
      statusBar.innerHTML = `<span style="color: #166534; font-size: 12px;"><i class='bx bx-check-shield'></i> Google Maps Platform active (Traffic & Routing API)</span>`;
      renderWithGoogleMaps(canvas, hub, orders, routeData, focusOrderId);
      return;
    } catch (err) {
      console.warn('Google Maps script load failed, falling back to Leaflet:', err);
    }
  }

  // Fallback to Leaflet interactive map
  try {
    await loadLeaflet();
    statusBar.innerHTML = `
      <div style="background: #fefce8; border: 1px solid #fef08a; padding: 6px 10px; border-radius: 4px; font-size: 12px; color: #854d0e; display: flex; align-items: center; gap: 6px;">
        <i class='bx bx-info-circle' style="font-size: 16px;"></i>
        <span><b>Interactive Map:</b> Add <code>GOOGLE_MAPS_API_KEY</code> to <code>.env</code> to activate Google Maps tiles. Displaying route with downtown street coordinates.</span>
      </div>
    `;
    renderWithLeaflet(canvas, hub, orders, routeData, focusOrderId);
  } catch (err) {
    canvas.innerHTML = `<div class="message error">Could not load map: ${err.message}</div>`;
  }
}

/**
 * Customer Order Tracking Map:
 * If the order is dispatched in a delivery trip, renders the full traffic route and highlights their stop.
 * If the order is still Pending, Preparing, or Staged, displays the delivery destination & Hub map.
 */
export async function renderOrderTrackingMap(containerElement, order) {
  if (!containerElement || !order) return;

  // 1. If order is dispatched or delivered with an active trip, render the full multi-stop route
  if (order.delivery_id) {
    try {
      const res = await fetch(`/deliveries/${order.delivery_id}`);
      if (res.ok) {
        const tripDetails = await res.json();
        await renderRouteMap(containerElement, tripDetails, { focusOrderId: order.order_id });
        return;
      }
    } catch (e) {
      console.warn('Could not load full trip details, falling back to destination map:', e);
    }
  }

  // 2. If not yet assigned to a trip, render destination map with Store Hub
  await renderDestinationMap(containerElement, order);
}

// Destination Map for orders waiting for packing/staging
async function renderDestinationMap(containerElement, order) {
  const hub = STORE_HUB;
  const lat = Number(order.delivery_lat) || hub.lat;
  const lng = Number(order.delivery_lng) || hub.lng;
  const mapCanvasId = `order-dest-map-${order.order_id}-${Math.floor(Math.random() * 10000)}`;

  containerElement.innerHTML = `
    <div class="route-map-wrapper">
      <div class="route-map-header">
        <div>
          <h3 style="margin: 0 0 4px; font-size: 16px;">
            <i class='bx bx-map-pin' style="color: #2f6f3e;"></i>
            Order #${order.order_id} Delivery Destination &bull; Status: <span style="color: #1d4ed8;">${order.status}</span>
          </h3>
          <span class="muted" style="font-size: 13px;">
            Departing from <b>${hub.name}</b> to <b>${order.delivery_address}</b>
          </span>
        </div>
      </div>

      <div id="${mapCanvasId}" class="route-map-canvas" style="height: 340px; width: 100%; border-radius: 6px; margin: 12px 0;">
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
          <i class='bx bx-loader-alt bx-spin' style="font-size: 24px; margin-right: 8px;"></i> Loading delivery location...
        </div>
      </div>

      <div class="route-map-status-bar" id="status-${mapCanvasId}"></div>

      <div style="background: #fafcfa; border: 1px solid #e2ece2; padding: 12px; border-radius: 6px; font-size: 13px; color: #2d5a36;">
        <i class='bx bx-bot' style="font-size: 18px; vertical-align: middle; margin-right: 4px;"></i>
        ${
          order.status === 'Preparing' || order.status === 'Pending'
            ? 'Your groceries are currently being packed at the Downtown Hub. Once packed and staged, our autonomous delivery robot will be dispatched on the optimal route.'
            : 'Your order is staged and waiting for robot assignment. Real-time traffic routing and live arrival estimates will activate when the robot departs.'
        }
      </div>
    </div>
  `;

  const canvas = document.getElementById(mapCanvasId);
  const statusBar = document.getElementById(`status-${mapCanvasId}`);
  const apiKey = await fetchMapsKey();

  const singleOrderMock = [{
    order_id: order.order_id,
    stop_sequence: 1,
    delivery_address: order.delivery_address,
    delivery_lat: lat,
    delivery_lng: lng,
    customer_name: 'You'
  }];

  if (apiKey) {
    try {
      await loadGoogleMaps(apiKey);
      statusBar.innerHTML = `<span style="color: #166534; font-size: 12px;"><i class='bx bx-check-shield'></i> Google Maps Platform active</span>`;
      renderWithGoogleMaps(canvas, hub, singleOrderMock, null, order.order_id);
      return;
    } catch (err) {
      console.warn('Google Maps load failed:', err);
    }
  }

  try {
    await loadLeaflet();
    renderWithLeaflet(canvas, hub, singleOrderMock, null, order.order_id);
  } catch (err) {
    canvas.innerHTML = `<div class="message error">Could not load map: ${err.message}</div>`;
  }
}

// Render using official Google Maps JavaScript API
function renderWithGoogleMaps(canvas, hub, orders, routeData, focusOrderId = null) {
  canvas.innerHTML = '';
  const map = new google.maps.Map(canvas, {
    zoom: 14,
    center: { lat: hub.lat, lng: hub.lng },
    mapTypeId: 'roadmap',
    streetViewControl: false,
    mapTypeControl: false
  });

  const bounds = new google.maps.LatLngBounds();
  bounds.extend({ lat: hub.lat, lng: hub.lng });

  // Store Hub marker
  const hubMarker = new google.maps.Marker({
    position: { lat: hub.lat, lng: hub.lng },
    map,
    title: hub.name,
    label: { text: 'H', color: '#ffffff', fontWeight: 'bold' },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: '#1b5e20',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2
    }
  });

  const hubInfo = new google.maps.InfoWindow({
    content: `<div style="padding: 4px;"><strong>${hub.name}</strong><br/>${hub.address}<br/><span style="color: #2f6f3e;">Trip Departure & Return Point</span></div>`
  });
  hubMarker.addListener('click', () => hubInfo.open(map, hubMarker));

  // Stop markers
  orders.forEach((o) => {
    const lat = Number(o.delivery_lat);
    const lng = Number(o.delivery_lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      bounds.extend({ lat, lng });

      const isFocus = focusOrderId && Number(o.order_id) === focusOrderId;
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: `Stop #${o.stop_sequence}: Order #${o.order_id}${isFocus ? ' (Your Order)' : ''}`,
        label: { text: String(o.stop_sequence), color: '#ffffff', fontWeight: 'bold' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isFocus ? 16 : 13,
          fillColor: isFocus ? '#047857' : '#2563eb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: isFocus ? 3 : 2
        }
      });

      const info = new google.maps.InfoWindow({
        content: `
          <div style="padding: 4px;">
            <strong>Stop #${o.stop_sequence}: Order #${o.order_id}</strong>${isFocus ? ' <b style="color: #047857;">(Your Order)</b>' : ''}<br/>
            ${o.delivery_address}<br/>
            ${o.customer_name ? `Customer: ${o.customer_name}<br/>` : ''}
            ${o.estimated_arrival ? `ETA: <b>${new Date(o.estimated_arrival).toLocaleTimeString()}</b>` : ''}
          </div>
        `
      });
      marker.addListener('click', () => info.open(map, marker));

      // Automatically open info window for customer's own order
      if (isFocus) {
        info.open(map, marker);
      }
    }
  });

  // Polyline path: Decode Google overview polyline if available, or connect hub and stops
  let pathPoints = [];
  if (routeData && routeData.overview_polyline) {
    pathPoints = decodePolyline(routeData.overview_polyline);
  }

  if (pathPoints.length === 0) {
    pathPoints.push({ lat: hub.lat, lng: hub.lng });
    orders.forEach((o) => {
      const lat = Number(o.delivery_lat);
      const lng = Number(o.delivery_lng);
      if (!isNaN(lat) && !isNaN(lng)) pathPoints.push({ lat, lng });
    });
    pathPoints.push({ lat: hub.lat, lng: hub.lng });
  }

  new google.maps.Polyline({
    path: pathPoints,
    geodesic: true,
    strokeColor: '#16a34a',
    strokeOpacity: 0.85,
    strokeWeight: 5,
    map
  });

  map.fitBounds(bounds);
}

// Render using Leaflet (OpenStreetMap) fallback
function renderWithLeaflet(canvas, hub, orders, routeData, focusOrderId = null) {
  canvas.innerHTML = '';
  const map = window.L.map(canvas).setView([hub.lat, hub.lng], 14);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const latLngs = [];

  // Hub marker
  const hubIcon = window.L.divIcon({
    className: 'custom-map-pin hub-pin',
    html: '<span>H</span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
  window.L.marker([hub.lat, hub.lng], { icon: hubIcon })
    .bindPopup(`<strong>${hub.name}</strong><br/>${hub.address}<br/><span style="color: #2f6f3e;">Departure & Return Hub</span>`)
    .addTo(map);
  latLngs.push([hub.lat, hub.lng]);

  // Stop markers
  orders.forEach((o) => {
    const lat = Number(o.delivery_lat);
    const lng = Number(o.delivery_lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      const isFocus = focusOrderId && Number(o.order_id) === focusOrderId;
      const stopIcon = window.L.divIcon({
        className: `custom-map-pin stop-pin ${isFocus ? 'focus-pin' : ''}`,
        html: `<span>${o.stop_sequence}</span>`,
        iconSize: [isFocus ? 30 : 26, isFocus ? 30 : 26],
        iconAnchor: [isFocus ? 15 : 13, isFocus ? 15 : 13]
      });

      const marker = window.L.marker([lat, lng], { icon: stopIcon })
        .bindPopup(`
          <strong>Stop #${o.stop_sequence}: Order #${o.order_id}</strong>${isFocus ? ' <b style="color: #047857;">(Your Order)</b>' : ''}<br/>
          ${o.delivery_address}<br/>
          ${o.customer_name ? `Customer: ${o.customer_name}<br/>` : ''}
          ${o.estimated_arrival ? `ETA: <b>${new Date(o.estimated_arrival).toLocaleTimeString()}</b>` : ''}
        `)
        .addTo(map);

      latLngs.push([lat, lng]);

      if (isFocus) {
        marker.openPopup();
      }
    }
  });

  // Route Polyline
  let polylineCoords = [];
  if (routeData && routeData.overview_polyline) {
    const decoded = decodePolyline(routeData.overview_polyline);
    polylineCoords = decoded.map(p => [p.lat, p.lng]);
  }

  if (polylineCoords.length === 0) {
    polylineCoords = [...latLngs, [hub.lat, hub.lng]];
  }

  const polyline = window.L.polyline(polylineCoords, {
    color: '#16a34a',
    weight: 5,
    opacity: 0.85,
    dashArray: routeData && routeData.overview_polyline ? null : '6, 8'
  }).addTo(map);

  map.fitBounds(polyline.getBounds().pad(0.15));
}
