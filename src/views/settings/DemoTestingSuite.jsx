/**
 * @fileoverview DemoTestingSuite — simulation controls + geofence preset picker.
 * Pure presentational component — all actions are passed as props.
 */

import { AlertTriangle, RotateCcw, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DEFAULT_BOUNDARY } from '@/lib/geofence'

const EXPANDED_PROPERTY = [
  [6.9300, 79.8575],
  [6.9315, 79.8650],
  [6.9240, 79.8660],
  [6.9225, 79.8580],
]

/**
 * @param {{
 *   telemetryStatus: string,
 *   geofenceBoundary: [number, number][],
 *   onSimulateBreach: () => void,
 *   onSimulateSOS: () => void,
 *   onResetToSafe: () => void,
 *   onApplyPreset: (boundary: [number, number][]) => void,
 *   onUpdateBoundaryPoint: (index: number, lat: number, lng: number) => void,
 * }} props
 */
export default function DemoTestingSuite({
  telemetryStatus,
  geofenceBoundary,
  onSimulateBreach,
  onSimulateSOS,
  onResetToSafe,
  onApplyPreset,
  onUpdateBoundaryPoint,
}) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-card p-4 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">Demo Testing Suite</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            telemetryStatus === 'ALERT'
              ? 'bg-red-100 text-red-700'
              : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          {telemetryStatus === 'ALERT' ? 'ALERT' : 'Safe'}
        </span>
      </div>

      {/* Simulation triggers */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Simulation Triggers</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="destructive" onClick={onSimulateBreach} className="rounded-xl">
            <AlertTriangle className="mr-2 h-4 w-4" />
            Simulate Outside Breach
          </Button>
          <Button variant="destructive" onClick={onSimulateSOS} className="rounded-xl">
            <Siren className="mr-2 h-4 w-4" />
            Simulate SOS Alert
          </Button>
          <Button
            onClick={onResetToSafe}
            className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Safe
          </Button>
        </div>
      </div>

      {/* Geofence presets */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm font-semibold">Geofence Safe Zone Settings</p>
        <div className="space-y-1.5">
          <label htmlFor="geofence-preset" className="text-sm font-medium">
            Property Presets
          </label>
          <select
            id="geofence-preset"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value === 'default') onApplyPreset(DEFAULT_BOUNDARY)
              if (e.target.value === 'expanded') onApplyPreset(EXPANDED_PROPERTY)
              e.target.value = ''
            }}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a preset</option>
            <option value="default">Home Yard</option>
            <option value="expanded">Neighborhood Zone</option>
          </select>
        </div>

        {/* Boundary point inputs */}
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">Boundary Points</p>
            <p className="text-xs text-muted-foreground">
              Adjust the active [lat, lng] anchors to test polygon shapes live.
            </p>
          </div>
          <div className="space-y-2">
            {geofenceBoundary.map(([lat, lng], index) => (
              <div
                key={`boundary-point-${index}`}
                className="grid grid-cols-[auto_1fr_1fr] items-center gap-2"
              >
                <span className="w-6 text-sm font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <input
                  aria-label={`Boundary point ${index + 1} latitude`}
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) onUpdateBoundaryPoint(index, v, lng)
                  }}
                  className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                />
                <input
                  aria-label={`Boundary point ${index + 1} longitude`}
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) onUpdateBoundaryPoint(index, lat, v)
                  }}
                  className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
