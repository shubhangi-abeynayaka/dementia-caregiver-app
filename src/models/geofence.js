/**
 * @fileoverview Geofence domain model — pure data shapes, validators, and
 * geometry helpers. No React, no side effects.
 */

// Re-export existing constants so consumers can import from one place
export { DEFAULT_BOUNDARY, DEFAULT_POLYGON, formatCoords } from '@/lib/geofence'

/**
 * Returns true if `boundary` is an array of at least 3 finite [lat, lng] pairs.
 * @param {unknown} boundary
 * @returns {boolean}
 */
export function isValidBoundary(boundary) {
  return (
    Array.isArray(boundary) &&
    boundary.length >= 3 &&
    boundary.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        point.every((c) => Number.isFinite(c)),
    )
  )
}

/**
 * Normalise a raw [lat, lng] pair, returning null for invalid input.
 * @param {unknown} point
 * @returns {[number, number] | null}
 */
export function normalizeBoundaryPoint(point) {
  if (!Array.isArray(point) || point.length < 2) return null
  const lat = Number(point[0])
  const lng = Number(point[1])
  return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
}

/**
 * Compute the convex hull (maximum-area boundary) of a set of points.
 * Uses the Andrew monotone chain algorithm.
 * @param {[number, number][]} points
 * @returns {[number, number][]}
 */
export function createMaximumAreaBoundary(points) {
  const unique = points
    .map(normalizeBoundaryPoint)
    .filter(Boolean)
    .filter((p, i, all) => all.findIndex(([a, b]) => a === p[0] && b === p[1]) === i)
    .sort(([a0, a1], [b0, b1]) => a0 - b0 || a1 - b1)

  if (unique.length <= 2) return unique

  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

  const lower = []
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop()
    lower.push(p)
  }

  const upper = []
  for (const p of unique.slice().reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop()
    upper.push(p)
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * Extract boundary points from an arbitrary MQTT payload shape.
 * @param {unknown} payload
 * @param {string} rawString
 * @returns {[number, number][]}
 */
export function extractBoundaryPoints(payload, rawString) {
  const points = []
  const add = (p) => { const n = normalizeBoundaryPoint(p); if (n) points.push(n) }

  if (Array.isArray(payload)) payload.forEach(add)
  if (Array.isArray(payload?.boundary)) payload.boundary.forEach(add)
  if (Array.isArray(payload?.boundaryPoints)) payload.boundaryPoints.forEach(add)
  if (payload?.point) add(payload.point)
  if (payload?.corner) add(payload.corner)
  if (payload?.boundaryLat != null && payload?.boundaryLng != null) {
    add([payload.boundaryLat, payload.boundaryLng])
  }
  if (Array.isArray(payload?.points)) {
    payload.points
      .filter((p) => p?.latitude !== '' && p?.longitude !== '')
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((p) => add([p.latitude, p.longitude]))
  }

  const m = rawString.match(/(?:POINT(?:_ADDED)?|BOUNDARY)[\s\S]*?Lat:\s*([0-9.-]+),\s*Lng:\s*([0-9.-]+)/i)
  if (m) add([m[1], m[2]])

  return points
}

/**
 * Returns true if the payload looks like a boundary snapshot (has a `points` array).
 * @param {unknown} payload
 * @returns {boolean}
 */
export function isBoundarySnapshot(payload) {
  return payload != null && typeof payload === 'object' && Array.isArray(payload.points)
}
