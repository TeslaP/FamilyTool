import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LayoutDashboard, Upload, CheckSquare, TrendingUp, BookOpen, LogOut } from "lucide-react";
import { HorizonLogo } from "./HorizonLogo";
import { AiStatusBar } from "./AiStatusBar";
import { cn, getCurrentMonth, getSeason } from "../lib/utils";
import { useApi } from "../hooks/useApi";
import { api } from "../api/client";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/forecast", icon: TrendingUp, label: "Forecast" },
  { to: "/reflections", icon: BookOpen, label: "Reflections" },
  { to: "/review", icon: CheckSquare, label: "Transactions" },
  { to: "/import", icon: Upload, label: "Import" },
];

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-stone-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none">
        {label}
      </div>
    </div>
  );
}

export function Layout() {
  const location = useLocation();
  const { logout } = useAuth();
  const [showAbout, setShowAbout] = useState(false);
  const { data: reviewItems } = useApi(
    () => api.getTransactions({ month: getCurrentMonth(), needsReview: true }),
    []
  );
  const reviewCount = reviewItems?.length || 0;

  return (
    <div className={cn("h-screen flex overflow-hidden", `season-${getSeason()}`)}>
      <aside className="w-[60px] h-screen bg-stone-950 flex flex-col items-center py-4 gap-2 flex-shrink-0">
        <button onClick={() => setShowAbout(true)} title="About Horizon">
          <HorizonLogo size={36} className="mb-3" />
        </button>
        <nav className="flex-1 flex flex-col items-center gap-1.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavTooltip key={to} label={label}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative w-9 h-9 flex items-center justify-center rounded-md",
                    isActive ? "bg-white text-stone-950" : "text-stone-400 hover:text-white hover:bg-stone-800/80"
                  )
                }
              >
                <Icon size={20} />
                {to === "/review" && reviewCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                )}
              </NavLink>
            </NavTooltip>
          ))}
        </nav>
        <NavTooltip label="Sign out">
          <button
            onClick={logout}
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-400 hover:text-white hover:bg-stone-800/80"
          >
            <LogOut size={18} />
          </button>
        </NavTooltip>
      </aside>
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm" onClick={() => setShowAbout(false)} />
          <div className="relative bg-white rounded-2xl shadow-lg p-8 max-w-sm mx-4 text-center">
            <HorizonLogo size={48} className="mx-auto mb-4" />
            <h2 className="text-xl font-light text-stone-900 mb-1">Horizon</h2>
            <p className="text-sm text-stone-400 mb-6">Small reflections make better months</p>

            <div className="text-sm text-stone-600 space-y-1 mb-6">
              <p>Created by Pavel Teslenko</p>
            </div>

            <div className="border-t border-stone-100 pt-4 text-xs text-stone-400 space-y-1">
              <p>AGPL-3.0 License</p>
              <div className="flex items-center justify-center gap-3">
                <a href="https://github.com/TeslaP/FamilyTool" target="_blank" rel="noopener" className="hover:text-stone-600 transition-colors">GitHub</a>
                <span>·</span>
                <a href="mailto:paveltess@gmail.com" className="hover:text-stone-600 transition-colors">paveltess@gmail.com</a>
              </div>
            </div>

            <button
              onClick={() => setShowAbout(false)}
              className="mt-6 text-sm text-stone-400 hover:text-stone-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
      <main className="flex-1 overflow-auto">
        <div key={location.pathname} className="animate-fadeIn h-full">
          <Outlet />
        </div>
      </main>
      <AiStatusBar />
    </div>
  );
}
