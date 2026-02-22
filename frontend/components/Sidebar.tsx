"use client";

import { AppView } from "@/lib/types";
import { useAuth } from "./AuthContext";

interface SidebarProps {
  view: AppView;
  setView: (v: AppView) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

const navItems: { icon: string; label: string; page: AppView["page"] }[] = [
  { icon: "dashboard", label: "Dashboard", page: "dashboard" },
  { icon: "inventory_2", label: "Products", page: "products" },
  { icon: "group", label: "LinkedIn", page: "linkedin-import" },
  { icon: "wallet", label: "Billing", page: "billing" },
  { icon: "settings", label: "Setup", page: "onboard" },
];

export default function Sidebar({ view, setView, collapsed = false, onToggle }: SidebarProps) {
  const { user } = useAuth();

  return (
    <aside className={`bg-white border-r border-slate-200/60 flex-col z-20 hidden md:flex shrink-0 h-screen transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo & Toggle */}
      <div className="px-4 py-5 flex items-center gap-3 relative">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
          <span
            className="w-7 h-7 bg-black"
            style={{
              WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
              mask: "url('/stick_2.svg') center / contain no-repeat",
            }}
            aria-label="Stick logo"
          />
        </div>
        {!collapsed && (
          <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900">
            Stick
          </h2>
        )}
        {onToggle && (
          <button
            onClick={onToggle}
            className={`ml-auto p-1 rounded hover:bg-slate-100 transition-colors ${collapsed ? 'absolute right-2' : ''}`}
          >
            <span className="material-symbols-outlined text-[18px] text-slate-400">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const active = view.page === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setView({ page: item.page } as AppView)}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group w-full text-left ${
                active
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] transition-colors shrink-0 ${
                  active
                    ? "text-gray-700"
                    : "text-gray-400 group-hover:text-gray-700"
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-200/60">
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
          <div className="size-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center border border-white shadow-sm text-xs font-bold text-slate-600 shrink-0">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
