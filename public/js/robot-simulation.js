// Shows a robot trip on the map with a timeline you can drag to watch how it would go.
// The robot follows the route that was planned when the trip was sent out, in the same
// stop order, and reaches each stop at the arrival time that was planned for it.
// It only moves the robot on the page. It never changes an order's status.

// Distance between two points in miles. The delivery area is only a few miles
// across, so treating the map as flat is close enough.
function distance(a, b) {
  const milesPerDegree = 69;
  const dLat = (b.lat - a.lat) * milesPerDegree;
  const dLng = (b.lng - a.lng) * milesPerDegree * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Finds the spot on the route where the robot drops off at a stop. The route can pass
// near the same place twice (once on the way out and again on the way back), so this
// takes the first time it gets about as close as it ever does.
function closestIndex(path, start, point) {
  let best = Infinity;
  for (let i = start; i < path.length; i++) {
    best = Math.min(best, distance(path[i], point));
  }
  for (let i = start; i < path.length; i++) {
    if (distance(path[i], point) <= best + 0.02) {
      return i;
    }
  }
  return start;
}

function timeOfDay(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// panel is an empty div under the map. path is the list of points the map drew for
// the route, and placeRobot moves the robot marker to a point.
export function startRobotSimulation(panel, trip, orders, path, placeRobot) {
  if (!panel || path.length === 0) return;

  const tripMinutes = Number(trip.estimated_duration) > 0 ? Number(trip.estimated_duration) : 10;
  const departure = trip.departure_time ? new Date(trip.departure_time) : new Date();

  // How far along the route each point is
  const distanceSoFar = [0];
  for (let i = 1; i < path.length; i++) {
    distanceSoFar.push(distanceSoFar[i - 1] + distance(path[i - 1], path[i]));
  }
  const routeLength = distanceSoFar[distanceSoFar.length - 1];

  // Where each stop is along the route and when the robot gets there, in the trip's
  // stop order. A stop without a planned time gets one from how far along it is.
  let searchFrom = 0;
  let lastMinute = 0;
  const stops = orders.map((order) => {
    const index = closestIndex(path, searchFrom, {
      lat: Number(order.delivery_lat),
      lng: Number(order.delivery_lng),
    });
    searchFrom = index;

    const planned = order.estimated_arrival
      ? (new Date(order.estimated_arrival).getTime() - departure.getTime()) / 60000
      : NaN;
    const steady = routeLength > 0 ? (distanceSoFar[index] / routeLength) * tripMinutes : 0;
    lastMinute = Math.max(lastMinute, Number.isFinite(planned) ? planned : steady);

    return { orderId: order.order_id, distance: distanceSoFar[index], minute: lastMinute };
  });

  // After the last stop the robot heads home at the same pace it made its deliveries,
  // unless the trip's estimate says the whole trip takes longer than that
  const lastStop = stops[stops.length - 1];
  const endMinute = lastStop && lastStop.distance > 0
    ? Math.max(tripMinutes, (lastStop.minute * routeLength) / lastStop.distance)
    : Math.max(tripMinutes, lastMinute);

  // The trip in pieces: hub to stop 1, stop 1 to stop 2, and so on, then back to the hub
  const legs = [];
  let from = { minute: 0, distance: 0 };
  for (const to of [...stops, { minute: endMinute, distance: routeLength }]) {
    legs.push({ from, to });
    from = to;
  }

  // Where the robot is a given number of minutes into the trip
  function pointAt(minute) {
    const leg = legs.find((piece) => minute <= piece.to.minute) || legs[legs.length - 1];
    const legMinutes = leg.to.minute - leg.from.minute;
    const share = legMinutes > 0 ? Math.min(1, Math.max(0, (minute - leg.from.minute) / legMinutes)) : 1;
    return pointAtDistance(leg.from.distance + share * (leg.to.distance - leg.from.distance));
  }

  // The point a given distance along the route
  function pointAtDistance(target) {
    if (path.length < 2 || routeLength === 0) {
      return path[0];
    }
    let i = 1;
    while (i < path.length - 1 && distanceSoFar[i] < target) {
      i++;
    }
    const pieceLength = distanceSoFar[i] - distanceSoFar[i - 1];
    const share = pieceLength > 0
      ? Math.min(1, Math.max(0, (target - distanceSoFar[i - 1]) / pieceLength))
      : 0;
    return {
      lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * share,
      lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * share,
    };
  }

  // On a trip that's out right now, the robot starts where it would be at this moment
  // and keeps moving in real time. A finished trip starts at the end.
  const isLive = trip.delivery_status === 'Out for Delivery';
  let minute = 0;
  if (isLive) {
    minute = Math.min(endMinute, Math.max(0, (Date.now() - departure.getTime()) / 60000));
  } else if (trip.delivery_status === 'Completed' || trip.delivery_status === 'Failed') {
    minute = endMinute;
  }
  let moving = isLive && minute < endMinute;

  panel.className = 'robot-sim';
  panel.innerHTML = `
    <div class="robot-sim-title">
      <strong>Trip Simulation</strong>
      <span class="muted">Drag the timeline to see where ${trip.robot || 'the robot'} is during the trip. It doesn't change any orders.</span>
    </div>
    <input class="robot-sim-slider" type="range" min="0" max="${endMinute}" step="any" aria-label="Trip timeline">
    <div class="robot-sim-ends">
      <span>Leaves ${timeOfDay(departure)}</span>
      <span>Back ${timeOfDay(new Date(departure.getTime() + endMinute * 60000))}</span>
    </div>
    <div class="robot-sim-status">
      <span class="robot-sim-clock"></span>
      <span class="robot-sim-minutes"></span>
      <span class="robot-sim-step"></span>
    </div>
  `;

  const slider = panel.querySelector('.robot-sim-slider');
  const clock = panel.querySelector('.robot-sim-clock');
  const minutesText = panel.querySelector('.robot-sim-minutes');
  const stepText = panel.querySelector('.robot-sim-step');

  // The stop list under the map gets a line saying when the robot got there
  const wrapper = panel.closest('.route-map-wrapper') || panel.parentElement;
  const cards = [
    ...stops.map((stop) => ({ id: String(stop.orderId), minute: stop.minute, label: 'Robot arrived at' })),
    { id: 'hub', minute: endMinute, label: 'Robot got back at' },
  ].map((card) => {
    const element = wrapper.querySelector(`[data-sim-stop="${card.id}"]`);
    if (!element) return null;
    const arrival = document.createElement('div');
    arrival.className = 'sim-arrival';
    (element.querySelector('.stop-eta') || element).appendChild(arrival);
    return { ...card, element, arrival };
  }).filter(Boolean);

  function show() {
    placeRobot(pointAt(minute));

    slider.value = String(minute);
    clock.textContent = timeOfDay(new Date(departure.getTime() + minute * 60000));
    minutesText.textContent = `${Math.round(minute)} of ${Math.round(endMinute)} min`;

    const next = stops.findIndex((stop) => stop.minute > minute);
    if (minute >= endMinute) {
      stepText.textContent = 'Back at the hub. Trip finished.';
    } else if (minute === 0) {
      stepText.textContent = 'At the hub, about to leave.';
    } else if (next === -1) {
      stepText.textContent = 'All stops done. Heading back to the hub.';
    } else {
      stepText.textContent = `Heading to stop ${next + 1} of ${stops.length} (Order #${stops[next].orderId})`;
    }

    for (const card of cards) {
      const reached = minute >= card.minute;
      card.element.classList.toggle('sim-reached', reached);
      card.arrival.textContent = reached
        ? `${card.label} ${timeOfDay(new Date(departure.getTime() + card.minute * 60000))}`
        : '';
    }
  }

  // Dragging the timeline moves the robot to that point in the trip
  slider.addEventListener('input', () => {
    minute = Number(slider.value);
    moving = isLive && minute < endMinute;
    show();
  });

  show();

  // A trip that's out right now keeps moving forward with the clock
  if (isLive) {
    let lastTick = Date.now();
    const timer = setInterval(() => {
      // Stop once the map is closed or the page changes
      if (!panel.isConnected) {
        clearInterval(timer);
        return;
      }
      const now = Date.now();
      if (moving) {
        minute = Math.min(endMinute, minute + (now - lastTick) / 60000);
        moving = minute < endMinute;
        show();
      }
      lastTick = now;
    }, 1000);
  }
}
