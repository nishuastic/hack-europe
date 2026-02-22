"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/components/AuthContext";
import ProductEdit from "@/components/ProductEdit";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { AppView } from "@/lib/types";

export default function ProductEditPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const productId = params.id ? parseInt(params.id as string) : undefined;

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
        view={{ page: "products" }} 
        setView={(v) => {
          if (v.page === "dashboard") router.push("/dashboard");
          if (v.page === "billing") router.push("/billing");
          if (v.page === "onboard") router.push("/?view=onboard");
        }} 
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6 md:p-10 w-full">
          <ProductEdit
            productId={productId}
            onBack={() => router.push("/products")}
          />
        </div>
      </main>
    </div>
  );
}
