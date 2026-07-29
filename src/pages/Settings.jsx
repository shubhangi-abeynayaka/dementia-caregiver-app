import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/lib/DeviceContext";
import { DEFAULT_POLYGON } from "@/lib/geofence";

export default function Settings() {
  const { demoMode, toggleDemoMode, geofencePoints, updateGeofence } =
    useDevice();
  const [points, setPoints] = useState(
    geofencePoints.map((p) => ({ lat: p.lat ?? "", lng: p.lng ?? "" }))
  );
  const [saved, setSaved] = useState(false);

  const update = (i, field, value) => {
    const next = points.map((p, idx) =>
      idx === i ? { ...p, [field]: value } : p
    );
    setPoints(next);
    setSaved(false);
  };

  const addPoint = () => {
    setPoints([...points, { lat: "", lng: "" }]);
    setSaved(false);
  };

  const removePoint = (i) => {
    setPoints(points.filter((_, idx) => idx !== i));
    setSaved(false);
  };

  const save = () => {
    const cleaned = points
      .filter((p) => p.lat !== "" && p.lng !== "" && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)))
      .map((p) => ({ lat: parseFloat(p.lat), lng: parseFloat(p.lng) }));
    updateGeofence(cleaned);
    setPoints(cleaned);
    setSaved(true);
  };

  const useDefault = () => {
    setPoints(DEFAULT_POLYGON.map((p) => ({ lat: p.lat, lng: p.lng })));
    updateGeofence(DEFAULT_POLYGON);
    setSaved(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      {/* Demo mode */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Demo Mode</p>
            <p className="text-sm text-muted-foreground">
              Simulate packets without hardware
            </p>
          </div>
          <Switch checked={demoMode} onCheckedChange={toggleDemoMode} />
        </div>
      </div>

      {/* Geofence editor */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
        <div className="flex items-center gap-2">
          <MapPinned className="w-5 h-5 text-[hsl(var(--accent))]" />
          <p className="font-semibold">Safe zone geofence</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the corner points of the patient's safe boundary (at least 3).
        </p>

        <div className="space-y-2">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
              <Input
                type="number"
                step="any"
                value={p.lat}
                onChange={(e) => update(i, "lat", e.target.value)}
                placeholder="Latitude"
                className="rounded-xl"
              />
              <Input
                type="number"
                step="any"
                value={p.lng}
                onChange={(e) => update(i, "lng", e.target.value)}
                placeholder="Longitude"
                className="rounded-xl"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePoint(i)}
                disabled={points.length <= 1}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={addPoint}
            className="rounded-xl flex-1"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add point
          </Button>
          <Button onClick={save} className="rounded-xl flex-1">
            {saved ? "Saved ✓" : "Save"}
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={useDefault}
          className="w-full text-sm text-muted-foreground"
        >
          Use demo boundary
        </Button>
      </div>

      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">About.</span> This
          app pairs over Bluetooth with your ESP32 LoRa receiver. It shows the
          patient's status, plays an alarm on alerts, and draws the safe zone on
          the map — all offline.
        </p>
      </div>
    </div>
  );
}