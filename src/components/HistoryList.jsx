import { Clock3, ShieldCheck, AlertTriangle, Siren, Wifi, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const iconMap = {
  SAFE: ShieldCheck,
  Safe: ShieldCheck,
  ALERT: AlertTriangle,
  SOS: Siren,
};

export default function HistoryList({ history = [], onDelete }) {
  if (!history.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm space-y-3">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Clock3 className="h-6 w-6 text-muted-foreground" />
        </div>
 feature/map-updates
        <p className="font-semibold">No recent events recorded.</p>

        <p className="font-semibold">No events yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Alerts will appear here as soon as the receiver sends packets.
        </p>
        <Button variant="ghost" onClick={onClear} className="rounded-xl text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All History
        </Button>
 main
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {history.map((entry) => {
          const isAlert = entry.type === "danger" || entry.status === "ALERT";
          const isConnection = entry.type === "connection";
          const Icon = isConnection ? Wifi : iconMap[entry.status] || ShieldCheck;
          const badgeLabel = isConnection ? "Connection" : isAlert ? "ALERT" : "Safe";
          const badgeClass = isConnection
            ? "bg-gray-100 text-gray-700"
            : isAlert
            ? "bg-red-100 text-red-700"
            : "bg-green-100 text-green-700";
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
                    <p className="font-semibold">{entry.event || entry.status}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.date || format(new Date(entry.timestamp), "PP")} · {entry.timestamp}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>
                    {badgeLabel}
                  </span>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(entry.id)}
                      aria-label={`Delete ${entry.event || "history entry"}`}
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-muted-foreground">Coordinates</p>
                    <p className="font-medium">
                      {entry.coordinates || (entry.lat != null && entry.lng != null
                        ? `${entry.lat.toFixed(4)}, ${entry.lng.toFixed(4)}`
                        : "—")}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-2">
                  <p className="text-muted-foreground">Signal</p>
                  <p className="font-medium">{entry.signalStrength || (entry.rssi == null ? "—" : `${entry.rssi} dBm`)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
