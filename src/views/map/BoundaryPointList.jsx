/**
 * @fileoverview BoundaryPointList — displays the grid of active geofence
 * boundary points. Pure presentational component.
 */

import { formatCoords } from '@/lib/geofence'

/**
 * @param {{
 *   geofenceBoundary: [number, number][],
 *   boundaryDeviceId: string | null,
 * }} props
 */
export default function BoundaryPointList({ geofenceBoundary, boundaryDeviceId }) {
  const validPoints = (geofenceBoundary || []).filter(
    ([lat, lng]) => Number(lat) !== 0 && Number(lng) !== 0,
  )

  if (validPoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No boundary points received yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {validPoints.map(([lat, lng], index) => (
        <div
          key={`boundary-point-${index}`}
          className="rounded-xl border border-border bg-secondary/40 px-3 py-2"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Point {index + 1} · {boundaryDeviceId || 'Unknown device'}
          </p>
          <p className="mt-1 text-sm font-medium">{formatCoords(lat, lng)}</p>
        </div>
      ))}
    </div>
  )
}
