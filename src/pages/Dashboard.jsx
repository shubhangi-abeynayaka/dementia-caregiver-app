import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bluetooth,
  BluetoothConnected,
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
    telemetry,
    connect,
    disconnect,
    demoMode,
    geofenceBoundary,
    error,
  } = useDevice();

  const connected = connectionStatus === "connected";
  const connecting = ["connecting", "searching"].includes(connectionStatus);

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
            ? `Connected${demoMode ? " · Demo" : ""}`
            : connectionStatus === "searching"
            ? "Searching for Hardware Receiver..."
            : connecting
            ? "Connecting…"
            : "Disconnected"}
        </div>
      </div>

      {!connected ? (
        <div className="bg-card rounded-3xl p-8 text-center shadow-sm border border-border">
          <div className="w-16 h-16 rounded-full bg-[hsl(var(--accent))]/15 flex items-center justify-center mx-auto mb-4">
            <Bluetooth className="w-8 h-8 text-[hsl(var(--accent))]" />
          </div>
          <h2 className="text-xl font-bold">Connect your receiver</h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Pair with your ESP32 LoRa receiver to start monitoring the patient.
          </p>
          {demoMode && (
            <p className="mt-2 text-xs text-[hsl(var(--accent))] font-medium">
              Demo Mode is on — Connect will simulate packets.
            </p>
          )}
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
            <BluetoothConnected className="w-5 h-5 mr-2" />
            {connectionStatus === "searching"
              ? "Searching for Hardware Receiver..."
              : connecting
              ? "Connecting…"
              : "Connect Device"}
          </Button>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground mt-4 hover:text-foreground"
          >
            <Info className="w-4 h-4" />
            Enable Demo Mode to try without hardware
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
                      {formatCoords(...telemetry.coordinates)}
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
                Status and coordinates will appear when the receiver sends a GPS packet.
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
                {formatCoords(...telemetry.coordinates)}
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
            <Bluetooth className="w-4 h-4 mr-2" />
            Disconnect
          </Button>
        </>
      )}
    </div>
  );
}