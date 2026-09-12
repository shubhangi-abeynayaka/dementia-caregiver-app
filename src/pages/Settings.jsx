import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/lib/DeviceContext";
import { DEFAULT_BOUNDARY } from "@/lib/geofence";

const EXPANDED_PROPERTY = [
  [6.9300, 79.8575],
  [6.9315, 79.8650],
  [6.9240, 79.8660],
  [6.9225, 79.8580],
];

function ToggleButton({ checked, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={onClick}
      className={`relative inline-flex h-7 w-12 cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const {
    isDemoMode,
    setIsDemoMode,
    pushNotifications,
    setPushNotifications,
    audibleAlarm,
    setAudibleAlarm,
    telemetry,
    geofenceBoundary,
    updateGeofence,
    simulateSafeZoneBreach,
    resetToSafe,
  } = useDevice();

  const applyPreset = (boundary) => {
    updateGeofence(boundary);
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

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        <p className="font-semibold">Alert Preferences</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p>Push Notifications</p>
            <ToggleButton
              label="Push Notifications"
              checked={pushNotifications}
              onClick={() => setPushNotifications(!pushNotifications)}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p>Audible Emergency Alarm</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Play a sound on your device during breaches
              </p>
            </div>
            <ToggleButton
              label="Audible Emergency Alarm"
              checked={audibleAlarm}
              onClick={() => setAudibleAlarm(!audibleAlarm)}
            />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Demo Mode</p>
            <p className="text-sm text-muted-foreground">
              Test app alerts without physical device
            </p>
          </div>
          <ToggleButton
            label="Demo Mode"
            checked={isDemoMode}
            onClick={() => setIsDemoMode(!isDemoMode)}
          />
        </div>
      </div>

      {isDemoMode && (
        <div className="rounded-2xl border border-blue-100 bg-card p-4 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Demo Testing Suite</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                telemetry.status === "ALERT"
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {telemetry.status === "ALERT" ? "ALERT" : "Safe"}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">Simulation Triggers</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="destructive"
                onClick={simulateSafeZoneBreach}
                className="rounded-xl"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Simulate Outside Breach
              </Button>
              <Button
                onClick={resetToSafe}
                className="rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Safe
              </Button>
            </div>
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Geofence Safe Zone Settings</p>
            <div className="space-y-1.5">
              <label htmlFor="geofence-preset" className="text-sm font-medium">Property Presets</label>
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
                <option value="default">Home Yard</option>
                <option value="expanded">Neighborhood Zone</option>
              </select>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Boundary Points</p>
                <p className="text-xs text-muted-foreground">Adjust the active [lat, lng] anchors to test polygon shapes live.</p>
              </div>
              <div className="space-y-2">
                {geofenceBoundary.map(([lat, lng], index) => (
                  <div key={`boundary-point-${index}`} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
                    <span className="w-6 text-sm font-medium text-muted-foreground">{index + 1}</span>
                    <input
                      aria-label={`Boundary point ${index + 1} latitude`}
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(event) => {
                        const nextLat = Number(event.target.value);
                        if (Number.isFinite(nextLat)) {
                          updateGeofence(geofenceBoundary.map((point, pointIndex) => (
                            pointIndex === index ? [nextLat, point[1]] : point
                          )));
                        }
                      }}
                      className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                    />
                    <input
                      aria-label={`Boundary point ${index + 1} longitude`}
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(event) => {
                        const nextLng = Number(event.target.value);
                        if (Number.isFinite(nextLng)) {
                          updateGeofence(geofenceBoundary.map((point, pointIndex) => (
                            pointIndex === index ? [point[0], nextLng] : point
                          )));
                        }
                      }}
                      className="h-9 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isDemoMode && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
          <p className="font-semibold">Hardware Device Status</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Boundary status</span>
              <span className="text-right font-medium">Active (Mapped via Walk &amp; Pin)</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Device status</span>
              <span className="font-medium text-emerald-600">Device Connected</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
        <p className="font-semibold">About OrbitCare</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          OrbitCare pairs with your patient tracking device to deliver real-time
          geofence monitoring, dynamic live mapping, and instant emergency alerts.
        </p>
      </div>
    </div>
  );
}