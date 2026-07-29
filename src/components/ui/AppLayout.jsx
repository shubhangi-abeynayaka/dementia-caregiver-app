import { Outlet, Link } from "react-router-dom";
import { ShieldCheck, Settings as SettingsIcon, Bluetooth, BluetoothConnected } from "lucide-react";
import BottomNav from "./BottomNav";
import { useDevice } from "@/lib/DeviceContext";

export default function AppLayout() {
  const { connectionStatus, demoMode } = useDevice();
  const connected = connectionStatus === "connected";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-md mx-auto flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[hsl(var(--accent))] flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <span className="font-bold text-lg block">DementiaGuard</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {connected ? <BluetoothConnected className="h-3.5 w-3.5 text-[hsl(var(--safe))]" /> : <Bluetooth className="h-3.5 w-3.5" />}
              <span>{connected ? `Connected${demoMode ? " · Demo" : ""}` : "Disconnected"}</span>
            </div>
          </div>
        </div>
        <Link
          to="/settings"
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary"
          aria-label="Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </Link>
      </header>
      <main className="max-w-md mx-auto px-4 pb-24 pt-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}