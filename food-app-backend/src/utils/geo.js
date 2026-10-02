// Service area: Bhubaneswar bounding box (v1 covers Bhubaneswar only).
export const BBSR_BBOX = Object.freeze({ south: 20.18, west: 85.70, north: 20.40, east: 85.95 });

export const insideBbox = ({ lat, lng }, { south, west, north, east } = BBSR_BBOX) =>
  lat >= south && lat <= north && lng >= west && lng <= east;
