"use client";

import { useState, useEffect, RefObject } from "react";
import { useAuth } from "./AuthContext";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  { icon: "dashboard", label: "Dashboard", href: "/dashboard" },
  { icon: "inventory_2", label: "Products", href: "/products" },
  { icon: "analytics", label: "Analytics", href: "/analytics" },
  { icon: "group", label: "LinkedIn", href: "/linkedin-import" },
];

interface HeaderProps {
  contentRef?: RefObject<HTMLDivElement | null>;
}

export default function Header({ contentRef }: HeaderProps) {
  const { logout, user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const el = contentRef?.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 0);
    onScroll(); // check initial state
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [contentRef]);

  return (
    <>
      <header
        className={`h-14 flex items-center justify-between px-4 sm:px-6 md:px-8 border-b shrink-0 transition-all duration-300 z-50 relative -mb-14 ${scrolled
          ? "bg-gradient-to-b from-white/60 to-white/10 backdrop-blur-md border-slate-200/60 shadow-md"
          : "bg-transparent border-transparent shadow-none"
          }`}
      >
        {/* Mobile hamburger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden text-slate-600 hover:text-slate-900 transition-colors p-1"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Spacer for desktop (sidebar handles nav) */}
        <div className="hidden md:block" />

        {/* Empty spacer — logout moved to sidebar */}
        <div />
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col">
            {/* Drawer header */}
            <div className="px-4 py-5 flex items-center justify-between border-b border-slate-200/60">
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                  <span
                    className="w-7 h-7 bg-black"
                    style={{
                      WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                      mask: "url('/stick_2.svg') center / contain no-repeat",
                    }}
                    aria-label="Stick logo"
                  />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Stick</h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded hover:bg-slate-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-slate-400">close</span>
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => {
                      router.push(item.href);
                      setDrawerOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors w-full text-left ${active
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[20px] ${active ? "text-slate-700" : "text-slate-400"
                        }`}
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* User + Logout */}
            <div className="p-4 border-t border-slate-200/60">
              <div className="flex items-center gap-3 p-2">
                <div className="size-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center border border-white shadow-sm text-xs font-bold text-slate-600">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  logout();
                }}
                className="flex items-center gap-3 px-3 py-2.5 mt-2 text-sm font-medium rounded-lg transition-colors w-full text-left text-red-600 hover:bg-red-50"
              >
                <span className="material-symbols-outlined text-[20px]">logout</span>
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
