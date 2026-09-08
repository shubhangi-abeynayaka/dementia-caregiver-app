import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, Siren } from "lucide-react";

const MAP = {
  SAFE: {
    color: "var(--safe)",
    label: "Safe",
    sub: "Patient is inside the safe zone",
    Icon: ShieldCheck,
  },
  ALERT: {
    color: "var(--alert)",
    label: "Outside Alert",
    sub: "Patient has left the safe zone",
    Icon: AlertTriangle,
  },
  SOS: {
    color: "var(--sos)",
    label: "SOS Emergency",
    sub: "Emergency button pressed",
    Icon: Siren,
  },
};

export default function StatusCard({ status }) {
  const cfg = MAP[status] || MAP.SAFE;
  return (
    <motion.div
      key={status}
      initial={{ scale: 0.96, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className="rounded-3xl p-6 text-center shadow-lg shadow-black/5"
      style={{ background: `hsl(${cfg.color})` }}
    >
      <motion.div
        animate={status === "SAFE" ? {} : { scale: [1, 1.08, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="mx-auto w-20 h-20 rounded-full bg-white/30 flex items-center justify-center mb-3"
      >
        <cfg.Icon className="w-10 h-10 text-white" strokeWidth={2.2} />
      </motion.div>
      <h2 className="text-2xl font-bold text-white">{cfg.label}</h2>
      <p className="text-white/90 mt-1">{cfg.sub}</p>
    </motion.div>
  );
}