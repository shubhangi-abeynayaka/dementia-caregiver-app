/**
 * @fileoverview AlertBanner — animated ALERT / SOS / Safe status banner.
 * Pure presentational component — driven entirely by props.
 */

import { motion, AnimatePresence } from 'framer-motion'

/**
 * @param {{ status: string, coordinatesLabel: string }} props
 */
export default function AlertBanner({ status, coordinatesLabel }) {
  return (
    <AnimatePresence>
      {status === 'SOS' ? (
        <motion.div
          key="sos"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl bg-gradient-to-r from-red-700 to-purple-800 p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">🚨 SOS Emergency!</p>
              <p className="text-white/90 text-sm">{coordinatesLabel}</p>
            </div>
          </div>
        </motion.div>
      ) : status === 'ALERT' ? (
        <motion.div
          key="alert"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl bg-[#DC2626] p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">Patient outside safe zone!</p>
              <p className="text-white/90 text-sm">{coordinatesLabel}</p>
            </div>
          </div>
        </motion.div>
      ) : status === 'NEAR_BOUNDARY' ? (
        <motion.div
          key="near_boundary"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl bg-amber-500 p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">⚠️ Patient is near the boundary line (within 4m)</p>
              <p className="text-white/90 text-sm">{coordinatesLabel}</p>
            </div>
          </div>
        </motion.div>
      ) : status === 'OUTSIDE_ACKNOWLEDGED' ? (
        <motion.div
          key="outside_ack"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-2xl bg-amber-600 p-4 text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-lg">Outside alert silenced — caregiver assisting</p>
              <p className="text-white/90 text-sm">{coordinatesLabel}</p>
            </div>
          </div>
        </motion.div>
      ) : status === 'Safe' ? (
        <motion.div
          key="safe"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-emerald-600 p-4 text-white shadow-lg"
        >
          <p className="font-bold text-lg">Patient is inside the safe zone</p>
          <p className="text-white/90 text-sm">Monitoring live location</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

