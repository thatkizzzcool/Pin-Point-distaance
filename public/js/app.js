const map = L.map('map', { zoomControl: false }).setView([6.5244, 3.3792], 12);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const destIcon = L.divIcon({ className: 'pin', html: '<span></span>', iconSize: [32, 38], iconAnchor: [16, 36] });
const userIcon = L.divIcon({ className: 'me', html: '<span></span>', iconSize: [24, 24], iconAnchor: [12, 12] });

let userPos = null, userMarker = null, destMarker = null, routeGroup = null;
let currentDest = null;

const $ = id => document.getElementById(id);
const card = $('result');
const statusEl = $('status');
const destNameEl = $('dest-name');
const statsEl = $('stats');
const saveBtn = $('save-btn');
const locateBtn = $('locate-btn');
const placesList = $('places-list');

const fmtDistance = km => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);
const fmtTime = min => {
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
  statusEl.hidden = false;
}

function showStats({ road, straight, time }) {
  $('stat-road').textContent = road;
  $('stat-straight').textContent = straight;
  $('stat-time').textContent = time;
  statsEl.hidden = false;
  statusEl.hidden = true;
}

function hideStats() {
  statsEl.hidden = true;
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function locateUser() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser does not support location.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('Location blocked. Allow location access and try again.')),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function setUser() {
  locateBtn.classList.add('loading');
  setStatus('Finding your location...');
  try {
    userPos = await locateUser();
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker(userPos, { icon: userIcon, keyboard: false }).addTo(map).bindPopup('You are here');
    map.setView(userPos, 14);
    setStatus('Location found. Search or click the map to pick a destination.');
    if (currentDest) await setDestination(currentDest.latlng, currentDest.name);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    locateBtn.classList.remove('loading');
  }
}

async function setDestination(latlng, name = 'Pinned location') {
  const point = { lat: latlng.lat, lng: latlng.lng };
  currentDest = { latlng: point, name };

  destNameEl.textContent = name;
  destNameEl.hidden = false;
  saveBtn.hidden = false;

  if (destMarker) map.removeLayer(destMarker);
  if (routeGroup) map.removeLayer(routeGroup);
  routeGroup = null;
  destMarker = L.marker(point, { icon: destIcon, keyboard: false }).addTo(map);

  if (!userPos) {
    hideStats();
    setStatus('Pin dropped. Press "Use my location" to get the distance.');
    return;
  }

  card.classList.add('loading');
  try {
    const data = await api('/api/distance', {
      method: 'POST',
      body: JSON.stringify({ from: userPos, to: point })
    });

    const layers = [
      L.polyline([userPos, point], { color: '#1c2620', weight: 2, dashArray: '4 8', opacity: 0.6 })
    ];
    if (data.route) {
      layers.push(L.geoJSON(data.route.geometry, {
        style: { color: '#c2410c', weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }
      }));
      showStats({
        road: fmtDistance(data.route.distanceKm),
        straight: fmtDistance(data.straightKm),
        time: fmtTime(data.route.durationMin)
      });
    } else {
      showStats({ road: 'No road route', straight: fmtDistance(data.straightKm), time: '-' });
    }
    routeGroup = L.featureGroup(layers).addTo(map);
    map.fitBounds(routeGroup.getBounds(), { padding: [70, 70] });
  } catch (err) {
    hideStats();
    setStatus(err.message, true);
  } finally {
    card.classList.remove('loading');
  }
}

async function loadPlaces() {
  try {
    const places = await api('/api/places');
    placesList.replaceChildren();
    if (!places.length) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Nothing saved yet. Pin a place and press Save.';
      placesList.append(empty);
      return;
    }
    for (const p of places) {
      const li = document.createElement('li');

      const go = document.createElement('button');
      go.className = 'go';
      go.type = 'button';
      go.textContent = p.name;
      go.title = p.name;
      go.addEventListener('click', () => {
        map.setView([p.lat, p.lng], 14);
        setDestination({ lat: p.lat, lng: p.lng }, p.name);
      });

      const del = document.createElement('button');
      del.className = 'del';
      del.type = 'button';
      del.textContent = '\u00d7';
      del.setAttribute('aria-label', `Remove ${p.name}`);
      del.addEventListener('click', async () => {
        try {
          await api(`/api/places/${p.id}`, { method: 'DELETE' });
          loadPlaces();
        } catch (err) {
          setStatus(err.message, true);
        }
      });

      li.append(go, del);
      placesList.append(li);
    }
  } catch (err) {
    placesList.textContent = err.message;
  }
}

map.on('click', e => setDestination(e.latlng));

locateBtn.addEventListener('click', setUser);

saveBtn.addEventListener('click', async () => {
  if (!currentDest) return;
  try {
    await api('/api/places', {
      method: 'POST',
      body: JSON.stringify({ name: currentDest.name, ...currentDest.latlng })
    });
    saveBtn.textContent = 'Saved \u2713';
    setTimeout(() => { saveBtn.textContent = 'Save this place'; }, 1500);
    loadPlaces();
  } catch (err) {
    setStatus(err.message, true);
  }
});

$('search-form').addEventListener('submit', async e => {
  e.preventDefault();
  const query = $('search-input').value.trim();
  if (!query) return;
  setStatus('Searching...');
  hideStats();
  try {
    const place = await api(`/api/geocode?q=${encodeURIComponent(query)}`);
    map.setView([place.lat, place.lng], 14);
    await setDestination({ lat: place.lat, lng: place.lng }, place.name);
  } catch (err) {
    setStatus(err.message, true);
  }
});

loadPlaces();
