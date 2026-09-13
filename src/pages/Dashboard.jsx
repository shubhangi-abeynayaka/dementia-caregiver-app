import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadioTower,
  MapPin,
  Info,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/lib/DeviceContext";
import StatusCard from "@/components/ui/StatusCard";
import SignalBars from "@/components/ui/SignalBars";
import MapWidget from "@/components/MapWidget";
import { formatCoords } from "@/lib/geofence";

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
  } = useDevice();

  const connected = connectionStatus === "connected";
  const showActiveTracking = isDemoMode || connected;
  const connecting = ["connecting", "searching"].includes(connectionStatus);
  const coordinatesLabel = Array.isArray(telemetry?.coordinates)
    ? formatCoords(...telemetry.coordinates)
    : "Waiting for GPS fix...";
  const deviceStatus = isDemoMode
    ? "Active - Demo Mode"
    : connectionStatus === "connected"
    ? "Device Connected"
    : "Disconnected";
  const boundaryStatus = isDemoMode
    ? "Active (Demo Geofence)"
    : boundaryWarning || geofenceBoundary.length < 3
    ? "Not Set (Add 3+ Points)"
    : "Active (Hardware Geofence)";
  const deviceStatusClass = isDemoMode
    ? "bg-blue-100 text-blue-700"
    : connected
    ? "bg-emerald-100 text-emerald-700"
    : "bg-red-100 text-red-700";
  const boundaryStatusClass = isDemoMode
    ? "bg-blue-100 text-blue-700"
    : boundaryStatus.startsWith("Not Set")
    ? "bg-orange-100 text-orange-700"
    : "bg-emerald-100 text-emerald-700";

  return (
    <div className="space-y-4">
      {/* connection pill */}
      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            connected
              ? "bg-[hsl(var(--safe))]/15 text-[hsl(var(--safe))]"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-[hsl(var(--safe))]" : "bg-muted-foreground"
            }`}
          />
          {connected
            ? `Connected${isDemoMode ? " · Demo" : ""}`
            : isDemoMode
            ? "Demo Mode"
            : connectionStatus === "searching"
            ? "Connecting to MQTT broker..."
            : connecting
            ? "Connecting…"
            : "Disconnected"}
        </div>
      </div>

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
            {connectionStatus === "searching"
              ? "Connecting to MQTT broker..."
              : connecting
              ? "Connecting…"
              : "Connect Device"}
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
          <AnimatePresence>
            {telemetry.status === "ALERT" ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-2xl bg-[#DC2626] p-4 text-white shadow-lg"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-lg">
                      Patient outside safe zone!
                    </p>
                    <p className="text-white/90 text-sm">
                      {coordinatesLabel}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : telemetry.status === "Safe" ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-emerald-600 p-4 text-white shadow-lg"
              >
                <p className="font-bold text-lg">Patient is inside the safe zone</p>
                <p className="text-white/90 text-sm">Monitoring live location</p>
              </motion.div>
            ) : null}
          </AnimatePresence>

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

          {/* live data */}
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Last update
              </span>
              <span className="text-sm font-medium">
                Live packet
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coordinates</span>
              <span className="text-sm font-medium">
                {coordinatesLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Signal strength
              </span>
              <SignalBars rssi={parseInt(telemetry.signalStrength, 10)} />
            </div>
          </div>

          {/* map preview */}
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
  );
}