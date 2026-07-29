export const DEFAULT_POLYGON = [
  { lat: 24.7135, lng: 46.6755 },
  { lat: 24.7145, lng: 46.6765 },
  { lat: 24.7125, lng: 46.6745 },
]

export function formatCoords(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return '—'
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
