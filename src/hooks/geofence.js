const KEY = "dementiaguard.geofence";

export const DEFAULT_POLYGON = [
  { lat: 24.7130, lng: 46.6750 },
  { lat: 24.7130, lng: 46.6760 },
  { lat: 24.7140, lng: 46.6760 },
  { lat: 24.7140, lng: 46.6750 },
];

export function loadGeofence() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function saveGeofence(points) {
  localStorage.setItem(KEY, JSON.stringify(points));
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return "—";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}