export const DEFAULT_BOUNDARY = [
  [6.9285, 79.8590],
  [6.9295, 79.8635],
  [6.9255, 79.8640],
  [6.9245, 79.8595],
]

// Keep the object shape available to older consumers while map state uses coordinate pairs.
export const DEFAULT_POLYGON = DEFAULT_BOUNDARY.map(([lat, lng]) => ({ lat, lng }))

export function formatCoords(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return '—'
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}
