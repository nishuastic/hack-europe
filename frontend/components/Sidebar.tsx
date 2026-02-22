"use client";

import { AppView } from "@/lib/types";
import { useAuth } from "./AuthContext";

interface SidebarProps {
  view: AppView;
  setView: (v: AppView) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  onProfileClick?: () => void;
}

export default function Sidebar({ view, setView, collapsed = false, onToggle, onProfileClick }: SidebarProps) {
  const { user } = useAuth();

  const navItems: { icon: string; label: string; page: AppView["page"] }[] = [
    { icon: "dashboard", label: "Dashboard", page: "dashboard" },
    { icon: "inventory_2", label: "Products", page: "products" },
    { icon: "analytics", label: "Analytics", page: "analytics" },
    { icon: "wallet", label: "Billing", page: "billing" },
    { icon: "group", label: "LinkedIn", page: "linkedin-import" },
  ];

  const isActive = (page: AppView["page"]) => view.page === page;

  return (
    <aside className={`hidden md:flex flex-col bg-white border-r border-slate-200/60 z-20 shrink-0 h-screen transition-all duration-300 ease-in-out ${collapsed ? 'w-[60px]' : 'w-52'}`}>
      {/* Logo & Toggle */}
      <div className={`py-5 flex items-center shrink-0 overflow-visible ${collapsed ? 'flex-col gap-1 px-0' : 'px-3 gap-0'}`}>
        {collapsed ? (
          /* Collapsed: show chevron button to expand */
          <button
            onClick={onToggle}
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors mx-auto"
            title="Expand sidebar"
          >
            <span className="material-symbols-outlined text-[22px] text-slate-500">
              chevron_right
            </span>
          </button>
        ) : (
          /* Expanded: logo + title + collapse chevron */
          <>
            <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0">
              <span
                className="w-14 h-14 bg-black"
                style={{
                  WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                  mask: "url('/stick_2.svg') center / contain no-repeat",
                }}
                aria-label="Stick logo"
              />
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 flex-1 min-w-0" style={{ fontFamily: "'Playfair Display', serif" }}>
              Stick
            </h2>
            {onToggle && (
              <button
                onClick={onToggle}
                className="p-1.5 rounded-md hover:bg-slate-100 transition-colors shrink-0 mt-2.5"
                title="Collapse sidebar"
              >
                <span className="material-symbols-outlined text-[20px] text-slate-500">
                  chevron_left
                </span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 py-4 space-y-1 overflow-y-auto scrollbar-hide ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {navItems.map((item) => {
          const active = isActive(item.page);
          return (
            <button
              key={item.page}
              onClick={() => setView({ page: item.page } as AppView)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-2 text-sm font-medium rounded-lg transition-colors group w-full ${
                collapsed ? 'justify-center px-0' : 'text-left px-3'
              } ${
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
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className={`border-t border-slate-200/60 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={onProfileClick}
          title={collapsed ? (user?.name || "Profile") : undefined}
          className={`flex items-center w-full rounded-lg hover:bg-slate-50 transition-colors ${
            collapsed ? 'justify-center p-1.5' : 'gap-3 p-2 text-left'
          }`}
        >
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
