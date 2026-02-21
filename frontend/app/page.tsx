"use client";

import { useState, useCallback } from "react";
import { AppView } from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import AuthPage from "@/components/AuthPage";
import LandingPage from "@/components/LandingPage";
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
  const [showAuth, setShowAuth] = useState(false);

  const goTo = useCallback((v: AppView) => setView(v), []);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing or auth page if not authenticated
  if (!isAuthenticated) {
    if (!showAuth) {
      return <LandingPage onGetStarted={() => setShowAuth(true)} />;
    }
    return (
      <AuthPage
        mode={authMode}
        onSwitchMode={() =>
          setAuthMode(authMode === "login" ? "register" : "login")
        }
      />
    );
  }

  // Pitch editor is full-screen (no sidebar)
  if (view.page === "pitch-editor") {
    return (
      <PitchDeckEditor
        leadId={view.leadId}
        onBack={() => goTo({ page: "lead-detail", leadId: view.leadId })}
      />
    );
  }

  return (
    <>
      <Sidebar view={view} setView={goTo} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
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
    </>
  );
}
