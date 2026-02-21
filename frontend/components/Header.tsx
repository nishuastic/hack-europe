"use client";

import { useAuth } from "./AuthContext";

export default function Header() {
  const { logout } = useAuth();

  return (
    <header className="h-16 flex items-center justify-end px-8 border-b border-slate-200/60 bg-white shrink-0">
      <button
        onClick={logout}
        className="text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-sm"
        title="Logout"
      >
        <span className="material-symbols-outlined text-[20px]">
          logout
        </span>
        <span>Logout</span>
      </button>
    </header>
  );
}
