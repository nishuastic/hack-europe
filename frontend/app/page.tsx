"use client";

import { useState, useCallback } from "react";
import { AppView } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import LeadDetail from "@/components/LeadDetail";
import PitchDeckEditor from "@/components/PitchDeckEditor";
import Onboard from "@/components/Onboard";
import Products from "@/components/Products";
import ProductEdit from "@/components/ProductEdit";

export default function Home() {
  const [view, setView] = useState<AppView>({ page: "dashboard" });

  const goTo = useCallback((v: AppView) => setView(v), []);

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
