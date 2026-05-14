import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LayoutDashboard, Upload, CheckSquare, TrendingUp, LogOut } from "lucide-react";
import { HorizonLogo } from "./HorizonLogo";
import { AiStatusBar } from "./AiStatusBar";
import { cn, getCurrentMonth } from "../lib/utils";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/import", icon: Upload, label: "Import" },
  { to: "/review", icon: CheckSquare, label: "Review" },
  { to: "/forecast", icon: TrendingUp, label: "Forecast" },
];

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap pointer-events-none">
        {label}
      </div>
    </div>
  );
}

export function Layout() {
  const { logout } = useAuth();
  const { data: reviewItems } = useApi(
    () => api.getTransactions({ month: getCurrentMonth(), needsReview: true }),
    []
  );
  const reviewCount = reviewItems?.length || 0;

  return (
    <div className="h-screen flex bg-stone-50 overflow-hidden">
      <aside className="w-[60px] h-screen bg-stone-950 flex flex-col items-center py-4 gap-2 flex-shrink-0">
        <HorizonLogo size={36} className="mb-3" />
        <nav className="flex-1 flex flex-col items-center gap-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavTooltip key={to} label={label}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative w-9 h-9 flex items-center justify-center rounded-md transition-all duration-150",
                    isActive ? "bg-white text-stone-950" : "text-stone-400 hover:text-white hover:bg-stone-800/80"
                  )
                }
              >
                <Icon size={20} />
                {to === "/review" && reviewCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-medium text-white flex items-center justify-center">
                    {reviewCount > 9 ? "9+" : reviewCount}
                  </span>
                )}
              </NavLink>
            </NavTooltip>
          ))}
        </nav>
        <NavTooltip label="Sign out">
          <button
            onClick={logout}
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-800/80 transition-all duration-150"
          >
            <LogOut size={18} />
          </button>
        </NavTooltip>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <AiStatusBar />
    </div>
  );
}
