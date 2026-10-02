// Service area: Bhubaneswar bounding box (v1 covers Bhubaneswar only).
export const BBSR_BBOX = Object.freeze({ south: 20.18, west: 85.70, north: 20.40, east: 85.95 });

export const insideBbox = ({ lat, lng }, { south, west, north, east } = BBSR_BBOX) =>
  lat >= south && lat <= north && lng >= west && lng <= east;

// Great-circle distance in metres (re-measuring cached search results from the user's own point)
export const distanceM = (a, b) => {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ~500 m grid for search cache keys (otherwise every GPS point is a new key)
export const gridKey = ({ lat, lng }) => `${(Math.round(lat / 0.0045) * 0.0045).toFixed(4)}:${(Math.round(lng / 0.0048) * 0.0048).toFixed(4)}`;
