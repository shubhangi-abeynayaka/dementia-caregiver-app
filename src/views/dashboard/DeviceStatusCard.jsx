/**
 * @fileoverview DeviceStatusCard — displays device connection + boundary status rows.
 * Pure presentational component.
 */

import { RadioTower } from 'lucide-react'

/**
 * @param {{
 *   connectionStatus: string,
 *   isDemoMode: boolean,
 *   boundaryWarning: boolean,
 *   geofenceBoundaryLength: number,
 * }} props
 */
export default function DeviceStatusCard({
  connectionStatus,
  isDemoMode,
  boundaryWarning,
  geofenceBoundaryLength,
}) {
  const connected = connectionStatus === 'connected'

  const deviceStatus = isDemoMode
    ? 'Active - Demo Mode'
    : connected
      ? 'Device Connected'
      : 'Disconnected'

  const boundaryStatus = isDemoMode
    ? 'Active (Demo Geofence)'
    : boundaryWarning || geofenceBoundaryLength < 3
      ? 'Not Set (Add 3+ Points)'
      : 'Active (Hardware Geofence)'

  const deviceStatusClass = isDemoMode
    ? 'bg-blue-100 text-blue-700'
    : connected
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-red-100 text-red-700'

  const boundaryStatusClass = isDemoMode
    ? 'bg-blue-100 text-blue-700'
    : boundaryStatus.startsWith('Not Set')
      ? 'bg-orange-100 text-orange-700'
      : 'bg-emerald-100 text-emerald-700'

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <RadioTower className="w-5 h-5 text-[hsl(var(--accent))]" aria-hidden="true" />
        <h2 className="font-semibold">Hardware Device Status</h2>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Device Status</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${deviceStatusClass}`}>
          {deviceStatus}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">Boundary Status</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-right ${boundaryStatusClass}`}>
          {boundaryStatus}
        </span>
      </div>
    </div>
  )
}
