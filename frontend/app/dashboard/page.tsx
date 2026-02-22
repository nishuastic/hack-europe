"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import Dashboard from "@/components/Dashboard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { AppView } from "@/lib/types";

export default function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        view={{ page: "dashboard" }} 
        setView={(v) => {
          if (v.page === "products") router.push("/products");
          if (v.page === "billing") router.push("/billing");
          if (v.page === "onboard") router.push("/?view=onboard");
        }} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-6 md:p-8 w-full min-h-full">
          <Dashboard
            onSelectRun={(id) => router.push(`/run/${id}`)}
          />
        </div>
      </main>
    </div>
  );
}
