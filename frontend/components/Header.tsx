"use client";

export default function Header() {
  return (
    <header className="h-16 flex items-center justify-end px-8 border-b border-slate-200/60 bg-white shrink-0">
      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
          <span className="material-symbols-outlined text-[18px]">help</span>
          <span>Documentation</span>
        </div>
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />
        <button className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-[22px]">
            notifications
          </span>
        </button>
      </div>
    </header>
  );
}
