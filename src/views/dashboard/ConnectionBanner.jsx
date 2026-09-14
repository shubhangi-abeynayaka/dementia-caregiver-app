/**
 * @fileoverview ConnectionBanner — displays the current connection status pill.
 * Pure presentational component — receives only props, zero business logic.
 */

/**
 * @param {{ connectionStatus: string, isDemoMode: boolean }} props
 */
export default function ConnectionBanner({ connectionStatus, isDemoMode }) {
  const connected  = connectionStatus === 'connected'
  const connecting = ['connecting', 'searching'].includes(connectionStatus)

  const label = connected
    ? `Connected${isDemoMode ? ' · Demo' : ''}`
    : isDemoMode
      ? 'Demo Mode'
      : connectionStatus === 'searching'
        ? 'Connecting to MQTT broker...'
        : connecting
          ? 'Connecting…'
          : 'Disconnected'

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
        connected
          ? 'bg-[hsl(var(--safe))]/15 text-[hsl(var(--safe))]'
          : 'bg-secondary text-muted-foreground'
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full ${
          connected ? 'bg-[hsl(var(--safe))]' : 'bg-muted-foreground'
        }`}
      />
      {label}
    </div>
  )
}
