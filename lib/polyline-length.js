// Compute the length of an OSM way's geometry (an array of {lat, lon}) in meters.
// Uses the haversine formula.

export default function polylineLength(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < geometry.length; i++) {
    total += haversineMeters(geometry[i - 1], geometry[i]);
  }
  return total;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
