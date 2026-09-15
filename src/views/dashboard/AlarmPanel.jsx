/**
 * @fileoverview AlarmPanel — driven by the orbitcare/signal MQTT topic.
 *
 * Displays a persistent, visually-distinct alarm banner for each signal state:
 *   ALARM_ON  — patient is outside the geofence boundary (alarm active)
 *   SOS       — emergency button pressed
 *   ALARM_OFF — patient has returned inside the boundary
 *   idle      — nothing rendered
 *
 * Provides a "Reset / Mute Alarm" button that publishes RESET back via the API.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Siren, CheckCircle2, BellOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

const CONFIGS = {
  ALARM_ON: {
    icon: AlertTriangle,
    title: 'Patient Outside Boundary',
    subtitle: 'Alarm is active — patient has left the safe zone.',
    bg: 'from-red-600 to-rose-700',
    pulse: true,
    showReset: true,
  },
  SOS: {
    icon: Siren,
    title: 'SOS Emergency Alert',
    subtitle: 'Patient has pressed the emergency button.',
    bg: 'from-red-700 to-purple-800',
    pulse: true,
    showReset: true,
  },
  ALARM_OFF: {
    icon: CheckCircle2,
    title: 'Patient Returned to Safe Zone',
    subtitle: 'Alarm has been cleared — patient is back inside the boundary.',
    bg: 'from-emerald-600 to-teal-700',
    pulse: false,
    showReset: false,
  },
}

/**
 * @param {{
 *   alarmState: 'idle' | 'ALARM_ON' | 'ALARM_OFF' | 'SOS',
 *   onReset: () => void,
 * }} props
 */
export default function AlarmPanel({ alarmState, onReset }) {
  const cfg = CONFIGS[alarmState]

  return (
    <AnimatePresence>
      {cfg && (
        <motion.div
          key={alarmState}
          initial={{ opacity: 0, scale: 0.97, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${cfg.bg} p-5 text-white shadow-xl`}
        >
          {/* Pulsing ring overlay for active alarms */}
          {cfg.pulse && (
            <span className="pointer-events-none absolute inset-0 rounded-2xl animate-ping opacity-20 bg-white" />
          )}

          <div className="relative flex items-start gap-4">
            <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <cfg.icon className="w-6 h-6" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg leading-tight">{cfg.title}</p>
              <p className="mt-0.5 text-sm text-white/85">{cfg.subtitle}</p>

              {cfg.showReset && (
                <Button
                  id="alarm-panel-reset-btn"
                  onClick={() => onReset()}
                  variant="secondary"
                  className="mt-3 h-9 rounded-xl bg-white/20 hover:bg-white/30 text-white border-white/30 border text-sm font-semibold backdrop-blur-sm gap-2"
                >
                  <BellOff className="w-4 h-4" />
                  Reset / Mute Alarm
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
