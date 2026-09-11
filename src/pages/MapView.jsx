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
  } = useDevice();
  const connected = connectionStatus === "connected";

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
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[hsl(var(--accent))]" />
              <span className="font-semibold">Patient position</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coordinates</span>
              <span className="text-sm font-medium">
                {formatCoords(...telemetry.coordinates)}
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
            Connect a hardware receiver to view the patient's live location.
          </p>
          <Button onClick={connect} className="w-full mt-5 rounded-xl">
            Connect Device
          </Button>
        </div>
      )}
    </div>
  );
}