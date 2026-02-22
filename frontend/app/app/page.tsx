"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
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
function serializeView(view: AppView): string {
  switch (view.page) {
    case "lead-detail":
      return view.runId ? `#lead-detail/${view.leadId}/${view.runId}` : `#lead-detail/${view.leadId}`;
    case "pitch-editor":
      return view.productId ? `#pitch-editor/${view.leadId}/${view.productId}` : `#pitch-editor/${view.leadId}`;
    case "product-edit":
      return view.productId ? `#product-edit/${view.productId}` : `#product-edit`;
    case "generation-run-detail":
      return `#generation-run-detail/${view.runId}`;
    default:
      return `#${view.page}`;
  }
}

function parseHash(hash: string): AppView | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) return null;
  const parts = raw.split("/");
  const page = parts[0];
  switch (page) {
    case "dashboard":
    case "products":
    case "billing":
    case "analytics":
    case "linkedin-import":
    case "onboard":
      return { page };
    case "product-edit":
      return { page: "product-edit", productId: parts[1] ? Number(parts[1]) : undefined };
    case "generation-run-detail":
      return parts[1] ? { page: "generation-run-detail", runId: Number(parts[1]) } : null;
    case "lead-detail":
      return parts[1] ? { page: "lead-detail", leadId: Number(parts[1]), runId: parts[2] ? Number(parts[2]) : undefined } : null;
    case "pitch-editor":
      return parts[1] ? { page: "pitch-editor", leadId: Number(parts[1]), productId: parts[2] ? Number(parts[2]) : undefined } : null;
    default:
      return null;
  }
}

export default function AppPage() {
  return (
    <Suspense>
      <AppPageInner />
    </Suspense>
  );
}

function AppPageInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const [view, setView] = useState<AppView>(() => {
    if (typeof window !== "undefined") {
      return parseHash(window.location.hash) ?? { page: "dashboard" };
    }
    return { page: "dashboard" };
  });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((v: AppView) => {
    setView(v);
    window.location.hash = serializeView(v);
  }, []);

  // Listen for browser back/forward
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash(window.location.hash);
      if (parsed) setView(parsed);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    if (leadId) {
      goTo({ page: "lead-detail", leadId: Number(leadId) });
    }
  }, [searchParams, goTo]);

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
      <Sidebar view={view} setView={goTo} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} onProfileClick={() => goTo({ page: "onboard" })} />
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <Header contentRef={contentRef} />
        <div ref={contentRef} className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          {view.page === "dashboard" && (
            <div className="p-6 md:p-8">
              <Dashboard
                onSelectRun={(id) =>
                  goTo({ page: "generation-run-detail", runId: id })
                }
              />
            </div>
          )}
          {view.page === "generation-run-detail" && (
            <div className="p-6 md:p-8">
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
            <div className="p-6 md:p-8">
              <Onboard />
            </div>
          )}
          {view.page === "products" && (
            <div className="p-6 md:p-8">
              <Products
                onEdit={(id) => goTo({ page: "product-edit", productId: id })}
              />
            </div>
          )}
          {view.page === "product-edit" && (
            <div className="p-6 md:p-8">
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
            <div className="p-6 md:p-8">
              <LinkedInImport />
            </div>
          )}
          {view.page === "analytics" && (
            <div className="p-6 md:p-8">
              <Analytics onSelectLead={(id) => goTo({ page: "lead-detail", leadId: id })} />
            </div>
          )}
          {view.page === "billing" && (
            <div className="p-6 md:p-8">
              <Billing />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
