"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import Onboard from "@/components/Onboard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function SetupPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
        view={{ page: "onboard" }} 
        setView={(v) => {
          if (v.page === "dashboard") router.push("/dashboard");
          if (v.page === "products") router.push("/products");
          if (v.page === "analytics") router.push("/analytics");
          if (v.page === "linkedin-import") router.push("/app");
        }} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        onProfileClick={() => router.push("/setup")}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header contentRef={contentRef} />
        <div ref={contentRef} className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6 md:p-8 w-full">
          <Onboard />
        </div>
      </main>
    </div>
  );
}
