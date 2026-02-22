"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppView } from "@/lib/types";
import { useAuth } from "@/components/AuthContext";
import AuthPage from "@/components/AuthPage";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import GenerationRunDetail from "@/components/GenerationRunDetail";
import LeadDetail from "@/components/LeadDetail";
import PitchDeckEditor from "@/components/PitchDeckEditor";
import Onboard from "@/components/Onboard";
import Products from "@/components/Products";
import ProductEdit from "@/components/ProductEdit";
import LinkedInImport from "@/components/LinkedInImport";
import Billing from "@/components/Billing";
import Analytics from "@/components/Analytics";

export default function AppPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [view, setView] = useState<AppView>({ page: "dashboard" });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  const goTo = useCallback((v: AppView) => setView(v), []);

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    if (leadId) {
      setView({ page: "lead-detail", leadId: Number(leadId) });
    }
  }, [searchParams]);

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

  // Show auth page if not authenticated
  if (!isAuthenticated) {
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
        productId={view.productId}
        onBack={() => goTo({ page: "lead-detail", leadId: view.leadId })}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <Sidebar view={view} setView={goTo} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Header />
        <div className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          {view.page === "dashboard" && (
            <div className="p-4 sm:p-6 md:p-8">
              <Dashboard
                onSelectRun={(id) =>
                  goTo({ page: "generation-run-detail", runId: id })
                }
              />
            </div>
          )}
          {view.page === "generation-run-detail" && (
            <div className="p-4 sm:p-6 md:p-8">
              <GenerationRunDetail
                runId={view.runId}
                onBack={() => goTo({ page: "dashboard" })}
                onSelectLead={(id) =>
                  goTo({ page: "lead-detail", leadId: id, runId: view.runId })
                }
              />
            </div>
          )}
          {view.page === "onboard" && (
            <div className="p-4 sm:p-6 md:p-10">
              <Onboard />
            </div>
          )}
          {view.page === "products" && (
            <div className="p-4 sm:p-6 md:p-10">
              <Products
                onEdit={(id) => goTo({ page: "product-edit", productId: id })}
              />
            </div>
          )}
          {view.page === "product-edit" && (
            <div className="p-4 sm:p-6 md:p-10">
              <ProductEdit
                productId={view.productId}
                onBack={() => goTo({ page: "products" })}
              />
            </div>
          )}
          {view.page === "lead-detail" && (
            <LeadDetail
              leadId={view.leadId}
              onBack={() => {
                if (view.runId) {
                  goTo({ page: "generation-run-detail", runId: view.runId });
                } else {
                  goTo({ page: "dashboard" });
                }
              }}
              onOpenPitchEditor={(productId) =>
                goTo({ page: "pitch-editor", leadId: view.leadId, productId })
              }
            />
          )}
          {view.page === "linkedin-import" && (
            <div className="p-4 sm:p-6 md:p-10">
              <LinkedInImport />
            </div>
          )}
          {view.page === "analytics" && (
            <div className="p-4 sm:p-6 md:p-10">
              <Analytics onSelectLead={(id) => goTo({ page: "lead-detail", leadId: id })} />
            </div>
          )}
          {view.page === "billing" && (
            <div className="p-4 sm:p-6 md:p-10">
              <Billing />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
