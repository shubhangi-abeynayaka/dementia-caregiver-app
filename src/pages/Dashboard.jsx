import { Link } from 'react-router-dom'
import { RadioTower, MapPin, Info, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDevice } from '@/lib/DeviceContext'
import StatusCard from '@/components/ui/StatusCard'
import MapWidget from '@/components/MapWidget'
import { formatCoords } from '@/lib/geofence'

// Views
import ConnectionBanner  from '@/views/dashboard/ConnectionBanner'
import DeviceStatusCard  from '@/views/dashboard/DeviceStatusCard'
import AlertBanner       from '@/views/dashboard/AlertBanner'
import TelemetryPanel    from '@/views/dashboard/TelemetryPanel'

export default function Dashboard() {
  const {
    connectionStatus,
    isDemoMode,
    telemetry,
    connect,
    disconnect,
    geofenceBoundary,
    boundaryWarning,
    error,
  } = useDevice()

  const connected          = connectionStatus === 'connected'
  const connecting         = ['connecting', 'searching'].includes(connectionStatus)
  const showActiveTracking = isDemoMode || connected
  const coordinatesLabel   = Array.isArray(telemetry?.coordinates)
    ? formatCoords(...telemetry.coordinates)
    : 'Waiting for GPS fix...'

  return (
    <div className="space-y-4">
      {/* Connection status pill */}
      <div className="flex items-center justify-between">
        <ConnectionBanner connectionStatus={connectionStatus} isDemoMode={isDemoMode} />
      </div>

      {/* Device + boundary status */}
      <DeviceStatusCard
        connectionStatus={connectionStatus}
        isDemoMode={isDemoMode}
        boundaryWarning={boundaryWarning}
        geofenceBoundaryLength={geofenceBoundary.length}
      />

      {/* Main content — disconnected vs active */}
      {!showActiveTracking ? (
        <div className="bg-card rounded-3xl p-8 text-center shadow-sm border border-border">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--accent))]/15 flex items-center justify-center mx-auto mb-4">
            <RadioTower className="w-8 h-8 text-[hsl(var(--accent))]" />
          </div>
          <h2 className="text-xl font-bold">Connect to telemetry service</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Waiting for the local MQTT broker to provide live patient telemetry.
          </p>
          {error && (
            <p className="mt-3 text-sm text-destructive flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {error}
            </p>
          )}
          <Button
            onClick={connect}
            disabled={connecting}
            className="w-full mt-5 h-12 text-base rounded-xl"
          >
            <RadioTower className="w-5 h-5 mr-2" />
            {connectionStatus === 'searching'
              ? 'Connecting to MQTT broker...'
              : connecting
                ? 'Connecting…'
                : 'Connect Device'}
          </Button>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground"
          >
            <Info className="w-4 h-4" />
            Enable Demo Mode to test without the MQTT service
          </Link>
        </div>
      ) : (
        <>
          <AlertBanner status={telemetry.status} coordinatesLabel={coordinatesLabel} />

          {telemetry ? (
            <StatusCard status={telemetry.status} />
          ) : (
            <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
              <h2 className="text-xl font-bold">Waiting for hardware telemetry</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Status and coordinates will appear when the MQTT service sends a location packet.
              </p>
            </div>
          )}

          <TelemetryPanel
            coordinatesLabel={coordinatesLabel}
            signalStrength={telemetry.signalStrength}
          />

          {/* Map preview */}
          <div className="bg-card rounded-2xl p-3 shadow-sm border border-border">
            <MapWidget
              telemetry={telemetry}
              geofenceBoundary={geofenceBoundary}
              height={180}
              interactive={false}
            />
            <Link to="/map">
              <Button variant="outline" className="w-full mt-3 rounded-xl">
                <MapPin className="w-4 h-4 mr-2" />
                View full map
              </Button>
            </Link>
          </div>

          <Button
            variant="ghost"
            onClick={disconnect}
            className="w-full text-muted-foreground"
          >
            <RadioTower className="w-4 h-4 mr-2" />
            Disconnect MQTT
          </Button>
        </>
      )}
    </div>
  )
}