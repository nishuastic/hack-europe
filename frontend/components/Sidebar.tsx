"use client";

import { AppView } from "@/lib/types";

interface SidebarProps {
  view: AppView;
  setView: (v: AppView) => void;
}

export default function Sidebar({ view, setView }: SidebarProps) {
  const navItems: { icon: string; label: string; page: AppView["page"] }[] = [
    { icon: "dashboard", label: "Dashboard", page: "dashboard" },
    { icon: "inventory_2", label: "Products", page: "products" },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/60 flex flex-col z-20 hidden md:flex shrink-0 h-screen">
      {/* Logo */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div className="size-8 text-primary flex items-center justify-center bg-primary/5 rounded-lg border border-primary/10">
          <span className="material-symbols-outlined text-[20px]">
            auto_graph
          </span>
        </div>
        <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900">
          SalesForge
        </h2>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const isActive = view.page === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setView({ page: item.page } as AppView)}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group w-full text-left ${
                isActive
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-slate-400 group-hover:text-primary"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          );
        })}

        <div className="pt-4 mt-4 border-t border-slate-100">
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Configuration
          </p>
          <button
            onClick={() => setView({ page: "onboard" })}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors w-full text-left ${
              view.page === "onboard"
                ? "bg-primary/5 text-primary"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${view.page === "onboard" ? "" : "text-slate-400"}`}
            >
              settings
            </span>
            Setup
          </button>
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-slate-200/60">
        <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors text-left">
          <div className="size-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center border border-white shadow-sm text-xs font-bold text-slate-600">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              Acme Admin
            </p>
            <p className="text-xs text-slate-500 truncate">admin@acme.io</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[18px]">
            more_vert
          </span>
        </button>
      </div>
    </aside>
  );
}
