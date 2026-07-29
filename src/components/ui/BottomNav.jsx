import { NavLink } from "react-router-dom";
import { Home, MapPin, Clock } from "lucide-react";

const items = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/map", label: "Map", icon: MapPin },
  { to: "/history", label: "History", icon: Clock },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
      <div className="max-w-md mx-auto grid grid-cols-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                isActive
                  ? "text-[hsl(var(--accent))]"
                  : "text-muted-foreground"
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}