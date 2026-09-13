import { Link } from "react-router-dom";
import { ArrowLeft, Map, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapWidget from "@/components/MapWidget";
import SignalBars from "@/components/ui/SignalBars";
import { useDevice } from "@/lib/DeviceContext";
import { formatCoords } from "@/lib/geofence";

export default function MapView() {
  const {
    telemetry,
    connectionStatus,
    connect,
    geofenceBoundary,
    boundaryDeviceId,
    locationDeviceId,
  } = useDevice();
  const connected = connectionStatus === "connected";
  const coordinatesLabel = Array.isArray(telemetry?.coordinates)
    ? formatCoords(...telemetry.coordinates)
    : "Waiting for GPS fix...";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Live Map</h1>
      </div>

      {connected ? (
        <>
          <MapWidget
            telemetry={telemetry}
            geofenceBoundary={geofenceBoundary}
            height={420}
            interactive={true}
          />

          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Current Boundary Points</span>
              <span className="text-xs text-muted-foreground">
                {geofenceBoundary.length} point{geofenceBoundary.length === 1 ? "" : "s"}
              </span>
            </div>
            {boundaryDeviceId && (
              <p className="text-xs text-muted-foreground">
                Boundary device: <span className="font-semibold text-foreground">{boundaryDeviceId}</span>
              </p>
            )}
            {geofenceBoundary.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {geofenceBoundary.map(([lat, lng], index) => (
                  <div
                    key={`map-boundary-point-${index}`}
                    className="rounded-xl border border-border bg-secondary/40 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      Point {index + 1} · {boundaryDeviceId || "Unknown device"}
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {formatCoords(lat, lng)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No boundary points received yet.
              </p>
            )}
          </div>

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
              <span className="text-sm font-medium">
                {coordinatesLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm font-medium capitalize">
                {telemetry.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Signal</span>
              <SignalBars rssi={parseInt(telemetry.signalStrength, 10)} />
            </div>
            <p className="text-xs text-muted-foreground">
              The shaded area shows the safe geofence. The pin is the patient's
              current location.
            </p>
          </div>
        </>
      ) : (
        <div className="w-full bg-card rounded-2xl p-8 text-center shadow-sm border border-border">
          <Map className="w-10 h-10 mx-auto text-[hsl(var(--accent))]" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold">Device Disconnected</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect to the MQTT telemetry service to view the patient's live location.
          </p>
          <Button onClick={connect} className="w-full mt-5 rounded-xl">
            Connect MQTT Service
          </Button>
        </div>
      )}
    </div>
  );
}