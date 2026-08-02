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