import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LayoutDashboard, Upload, CheckSquare, TrendingUp, LogOut } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/import", icon: Upload, label: "Import" },
  { to: "/review", icon: CheckSquare, label: "Review" },
  { to: "/forecast", icon: TrendingUp, label: "Forecast" },
];

export function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex bg-stone-50">
      <aside className="w-[52px] bg-stone-950 flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <div className="w-7 h-7 bg-stone-800 rounded-md mb-2" />
        <nav className="flex-1 flex flex-col items-center gap-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              title={label}
              className={({ isActive }) =>
                cn(
                  "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                  isActive ? "bg-white text-stone-950" : "text-stone-400 hover:text-white hover:bg-stone-800"
                )
              }
            >
              <Icon size={18} />
            </NavLink>
          ))}
        </nav>
        <button
          onClick={logout}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-800"
        >
          <LogOut size={16} />
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
