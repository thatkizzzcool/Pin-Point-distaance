const EARTH_RADIUS_KM = 6371;
const toRad = deg => (deg * Math.PI) / 180;

function isValidPoint(p) {
  return (
    p &&
    typeof p.lat === 'number' && typeof p.lng === 'number' &&
    p.lat >= -90 && p.lat <= 90 &&
    p.lng >= -180 && p.lng <= 180
  );
}

function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'pinpoint-distance-app/1.0' } });
  if (!res.ok) throw new Error('Geocoding service error');
  const hits = await res.json();
  if (!hits.length) return null;
  return { lat: parseFloat(hits[0].lat), lng: parseFloat(hits[0].lon), name: hits[0].display_name };
}

async function drivingRoute(a, b) {
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Routing service error');
  const data = await res.json();
  if (!data.routes || !data.routes.length) return null;
  const r = data.routes[0];
  return {
    distanceKm: r.distance / 1000,
    durationMin: r.duration / 60,
    geometry: r.geometry
  };
}

module.exports = { isValidPoint, haversine, geocode, drivingRoute };