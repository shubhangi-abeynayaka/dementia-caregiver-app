import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsController } from '@/controllers/useSettingsController'

// Views
import ToggleRow       from '@/views/settings/ToggleRow'
import DemoTestingSuite from '@/views/settings/DemoTestingSuite'

export default function Settings() {
  const {
    isDemoMode,
    toggleDemoMode,
    pushNotifications,
    togglePushNotifications,
    audibleAlarm,
    toggleAudibleAlarm,
    mqttBrokerUrl,
    updateMqttBrokerUrl,
    backendUrl,
    updateBackendUrl,
    telemetryStatus,
    geofenceBoundary,
    applyGeofencePreset,
    updateBoundaryPoint,
    simulateSafeZoneBreach,
    simulateSOS,
    resetToSafe,
  } = useSettingsController()

  const [brokerUrlDraft, setBrokerUrlDraft] = useState(mqttBrokerUrl)
  const [backendUrlDraft, setBackendUrlDraft] = useState(backendUrl)

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

      {/* Alert preferences */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        <p className="font-semibold">Alert Preferences</p>
        <div className="space-y-3">
          <ToggleRow
            label="Push Notifications"
            checked={pushNotifications}
            onToggle={togglePushNotifications}
          />
          <ToggleRow
            label="Audible Emergency Alarm"
            description="Play a sound on your device during breaches"
            checked={audibleAlarm}
            onToggle={toggleAudibleAlarm}
          />
        </div>
      </div>

      {/* Demo mode */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <ToggleRow
          label="Demo Mode"
          description="Test app alerts without physical device"
          checked={isDemoMode}
          onToggle={toggleDemoMode}
        />
      </div>

      {/* MQTT broker address */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <div>
          <p className="font-semibold">MQTT Broker Address</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the broker WebSocket address provided by the local service.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            aria-label="MQTT broker WebSocket address"
            value={brokerUrlDraft}
            onChange={(e) => setBrokerUrlDraft(e.target.value)}
            placeholder="ws://10.45.32.10:9001"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button
            type="button"
            onClick={() => updateMqttBrokerUrl(brokerUrlDraft)}
            className="rounded-xl"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Backend server address */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
        <div>
          <p className="font-semibold">Backend Server Address</p>
          <p className="mt-1 text-sm text-muted-foreground">
            IP and port of the backend server (REST&nbsp;&amp;&nbsp;Socket.IO).
            Applying reconnects the device stream automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            id="backend-url-input"
            aria-label="Backend server address"
            value={backendUrlDraft}
            onChange={(e) => setBackendUrlDraft(e.target.value)}
            placeholder="http://192.168.1.42:5000"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
          />
          <Button
            type="button"
            onClick={() => updateBackendUrl(backendUrlDraft)}
            className="rounded-xl"
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Demo testing suite */}
      {isDemoMode && (
        <DemoTestingSuite
          telemetryStatus={telemetryStatus}
          geofenceBoundary={geofenceBoundary}
          onSimulateBreach={simulateSafeZoneBreach}
          onSimulateSOS={simulateSOS}
          onResetToSafe={resetToSafe}
          onApplyPreset={applyGeofencePreset}
          onUpdateBoundaryPoint={updateBoundaryPoint}
        />
      )}

      {/* Hardware device status (non-demo only) */}
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

      {/* About */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
        <p className="font-semibold">About OrbitCare</p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          OrbitCare pairs with your patient tracking device to deliver real-time
          geofence monitoring, dynamic live mapping, and instant emergency alerts.
        </p>
      </div>
    </div>
  )
}