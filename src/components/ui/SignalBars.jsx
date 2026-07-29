import { Radio } from "lucide-react";

export default function SignalBars({ rssi }) {
  // rssi typically -40 (great) to -120 (weak)
  const level =
    rssi == null || isNaN(rssi)
      ? 0
      : rssi > -60
      ? 4
      : rssi > -75
      ? 3
      : rssi > -90
      ? 2
      : 1;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-0.5 h-4">
        {[1, 2, 3, 4].map((b) => (
          <span
            key={b}
            className={`w-1 rounded-full ${
              b <= level ? "bg-[hsl(var(--accent))]" : "bg-muted"
            }`}
            style={{ height: `${b * 4}px` }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {rssi == null ? "—" : `${rssi} dBm`}
      </span>
    </div>
  );
}