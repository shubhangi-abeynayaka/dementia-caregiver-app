/**
 * @fileoverview AlertBanner — animated ALERT / Safe status banner.
 * Pure presentational component — driven entirely by props.
 */

import { motion, AnimatePresence } from 'framer-motion'

/**
 * @param {{ status: string, coordinatesLabel: string }} props
 */
export default function AlertBanner({ status, coordinatesLabel }) {
  return (
    <AnimatePresence>
      {status === 'ALERT' ? (
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
