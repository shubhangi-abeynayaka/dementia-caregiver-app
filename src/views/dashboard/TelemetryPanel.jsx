/**
 * @fileoverview TelemetryPanel — displays last update, coordinates, and signal
 * strength. Pure presentational component.
 */

import SignalBars from '@/components/ui/SignalBars'

/**
 * @param {{ coordinatesLabel: string, signalStrength: string }} props
 */
export default function TelemetryPanel({ coordinatesLabel, signalStrength }) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Last update</span>
        <span className="text-sm font-medium">Live packet</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Coordinates</span>
        <span className="text-sm font-medium">{coordinatesLabel}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Signal strength</span>
        <SignalBars rssi={parseInt(signalStrength, 10)} />
      </div>
    </div>
  )
}
