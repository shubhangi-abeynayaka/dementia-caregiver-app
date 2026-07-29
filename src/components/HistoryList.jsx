import { Clock3, Trash2, ShieldCheck, AlertTriangle, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const iconMap = {
  SAFE: ShieldCheck,
  ALERT: AlertTriangle,
  SOS: Siren,
};

export default function HistoryList({ history = [], onClear }) {
  if (!history.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Clock3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold">No events yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Alerts will appear here as soon as the receiver sends packets.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div>
          <p className="font-semibold">Recent events</p>
          <p className="text-sm text-muted-foreground">Newest entries are shown first.</p>
        </div>
        <Button variant="ghost" onClick={onClear} className="rounded-xl text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All History
        </Button>
      </div>

      <div className="space-y-2">
        {history.map((entry) => {
          const Icon = iconMap[entry.status] || ShieldCheck;
          return (
            <div
              key={entry.id || `${entry.timestamp}-${entry.status}`}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 rounded-full bg-secondary p-2">
                    <Icon className="h-4 w-4 text-[hsl(var(--accent))]" />
                  </div>
                  <div>
                    <p className="font-semibold">{entry.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.timestamp), "PPpp")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {entry.rssi == null ? "—" : `${entry.rssi} dBm`}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-muted-foreground">Coordinates</p>
                  <p className="font-medium">
                    {entry.lat != null && entry.lng != null
                      ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-muted-foreground">RSSI</p>
                  <p className="font-medium">{entry.rssi == null ? "—" : `${entry.rssi} dBm`}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
