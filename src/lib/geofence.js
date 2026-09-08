 feature/map-updates
export const DEFAULT_BOUNDARY = [
  [6.9285, 79.8590],
  [6.9295, 79.8635],
  [6.9255, 79.8640],
  [6.9245, 79.8595],
]

// Keep the object shape available to older consumers while the map state uses Leaflet's coordinate shape.
export const DEFAULT_POLYGON = DEFAULT_BOUNDARY.map(([lat, lng]) => ({ lat, lng }))

export function formatCoords(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return '—'

const KEY = "dementiaguard.geofence";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export const DEFAULT_POLYGON = [
  { lat: 24.7130, lng: 46.6750 },
  { lat: 24.7130, lng: 46.6760 },
  { lat: 24.7140, lng: 46.6760 },
  { lat: 24.7140, lng: 46.6750 },
];

export function loadGeofence() {
  const storage = getStorage();
  if (!storage) return [];

  try {
    return JSON.parse(storage.getItem(KEY)) || [];
  } catch {
    return [];
 main
  }
}

export function saveGeofence(points) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify(points));
}

export function formatCoords(lat, lng) {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return "—";
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}