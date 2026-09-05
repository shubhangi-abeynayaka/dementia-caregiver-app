import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/lib/DeviceContext";
import { DEFAULT_BOUNDARY } from "@/lib/geofence";

const EXPANDED_PROPERTY = [
  [6.9300, 79.8575],
  [6.9315, 79.8650],
  [6.9240, 79.8660],
  [6.9225, 79.8580],
];

const toDraftPoints = (boundary) =>
  boundary.map(([lat, lng]) => ({ lat, lng }));

export default function Settings() {
  const {
    isDemoMode,
    toggleDemoMode,
    geofenceBoundary,
    updateGeofence,
  } = useDevice();
  const [points, setPoints] = useState(
    toDraftPoints(geofenceBoundary)
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPoints(toDraftPoints(geofenceBoundary));
  }, [geofenceBoundary]);

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
      .map((p) => [parseFloat(p.lat), parseFloat(p.lng)]);
    if (cleaned.length >= 3) {
      updateGeofence(cleaned);
      setSaved(true);
    }
  };

  const applyPreset = (boundary) => {
    setPoints(toDraftPoints(boundary));
    updateGeofence(boundary);
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
            <Switch checked={isDemoMode} onCheckedChange={toggleDemoMode} />
        </div>
      </div>

      {/* Geofence editor */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border space-y-3">
        <div className="flex items-center gap-2">
          <MapPinned className="w-5 h-5 text-[hsl(var(--accent))]" />
          <p className="font-semibold">Geofence Safe Zone Settings</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the corner points of the patient's safe boundary (at least 3).
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="geofence-preset">Boundary preset</Label>
          <select
            id="geofence-preset"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value === "default") applyPreset(DEFAULT_BOUNDARY);
              if (event.target.value === "expanded") applyPreset(EXPANDED_PROPERTY);
              event.target.value = "";
            }}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>Select a preset</option>
            <option value="default">Default Colombo Perimeter</option>
            <option value="expanded">Expanded Property</option>
          </select>
        </div>

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