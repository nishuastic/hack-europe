"use client";

import { useState, useCallback } from "react";
import { AppView } from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import LeadDetail from "@/components/LeadDetail";
import PitchDeckEditor from "@/components/PitchDeckEditor";
import Onboard from "@/components/Onboard";
import Products from "@/components/Products";
import ProductEdit from "@/components/ProductEdit";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const [view, setView] = useState<AppView>({ page: "dashboard" });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const goTo = useCallback((v: AppView) => setView(v), []);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 mb-4">
            <span className="material-symbols-outlined text-3xl text-white animate-pulse">
              auto_awesome
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium">Loading Stick...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!isAuthenticated) {
    return <AuthPage mode={authMode} onSwitchMode={() => setAuthMode(authMode === "login" ? "register" : "login")} />;
  }

  // Authenticated app layout
  return (
    <div className="flex h-screen">
      <Sidebar view={view} setView={goTo} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          {view.page === "dashboard" && (
            <div className="p-8">
              <Dashboard
                onSelectLead={(id) => goTo({ page: "lead-detail", leadId: id })}
              />
            </div>
          )}
          {view.page === "onboard" && (
            <div className="p-6 md:p-10">
              <Onboard />
            </div>
          )}
          {view.page === "products" && (
            <div className="p-6 md:p-10">
              <Products
                onEdit={(id) => goTo({ page: "product-edit", productId: id })}
              />
            </div>
          )}
          {view.page === "product-edit" && (
            <div className="p-6 md:p-10">
              <ProductEdit
                productId={view.productId}
                onBack={() => goTo({ page: "products" })}
              />
            </div>
          )}
          {view.page === "lead-detail" && (
            <LeadDetail
              leadId={view.leadId}
              onBack={() => goTo({ page: "dashboard" })}
              onOpenPitchEditor={() =>
                goTo({ page: "pitch-editor", leadId: view.leadId })
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
