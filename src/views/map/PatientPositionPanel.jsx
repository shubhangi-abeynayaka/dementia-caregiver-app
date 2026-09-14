/**
 * @fileoverview PatientPositionPanel — displays patient coordinates, status,
 * signal, and device ID. Pure presentational component.
 */

import { ShieldCheck } from 'lucide-react'
import SignalBars from '@/components/ui/SignalBars'

/**
 * @param {{
 *   coordinatesLabel: string,
 *   status: string,
 *   signalStrength: string,
 *   locationDeviceId: string | null,
 * }} props
 */
export default function PatientPositionPanel({
  coordinatesLabel,
  status,
  signalStrength,
  locationDeviceId,
}) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[hsl(var(--accent))]" />
        <span className="font-semibold">Patient position</span>
      </div>
      {locationDeviceId && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Device ID</span>
          <span className="text-sm font-medium">{locationDeviceId}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Coordinates</span>
        <span className="text-sm font-medium">{coordinatesLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Status</span>
        <span className="text-sm font-medium capitalize">{status}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Signal</span>
        <SignalBars rssi={parseInt(signalStrength, 10)} />
      </div>
      <p className="text-xs text-muted-foreground">
        The shaded area shows the safe geofence. The pin is the patient's
        current location.
      </p>
    </div>
  )
}
