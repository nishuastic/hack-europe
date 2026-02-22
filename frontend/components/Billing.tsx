"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

interface TierPlan {
  label: string;
  price_id: string;
  credits: number;
  eur_display: string;
  per_credit: string;
}

interface PaygPack {
  label: string;
  price_id: string;
  credits: number;
  eur_display: string;
  per_credit: string;
}

interface BillingData {
  currency: string;
  credits_remaining: number;
  costs: Record<string, number>;
  tiers: Record<string, TierPlan>;
  payg_packs: Record<string, PaygPack>;
  subscription?: {
    active_tier: string | null;
    status: string | null;
    subscription_id: string | null;
  } | null;
}

const USAGE_COSTS = [
  { name: "Enrich Lead", key: "enrichment", credits: 5, description: "Deep web research per company" },
  { name: "ICP Discovery", key: "icp_research", credits: 3, description: "AI discovers target companies" },
  { name: "Matching", key: "matching", credits: 2, description: "AI product-to-lead matching" },
  { name: "Pitch Deck", key: "pitch_deck", credits: 10, description: "7-slide personalized deck" },
  { name: "Email", key: "email", credits: 1, description: "Personalized outreach email" },
  { name: "LinkedIn Outreach", key: "linkedin_outreach", credits: 0, description: "Warm intro plans — free" },
];

function BillingContent() {
  const searchParams = useSearchParams();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "credits">("subscriptions");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadBillingData = () => {
    setLoading(true);
    api.getBillingCredits()
      .then(setBillingData)
      .catch((err) => console.error("Failed to load billing:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBillingData();

    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      setMessage({ type: "success", text: "Payment successful! Your credits have been added." });
    } else if (canceled === "true") {
      setMessage({ type: "error", text: "Payment was canceled." });
    }
  }, [searchParams]);

  const handlePurchase = async (type: "tier" | "payg", id: string) => {
    setPurchasing(type === "tier" ? `tier-${id}` : `payg-${id}`);
    try {
      const url = type === "tier"
        ? await api.createTierCheckout(id)
        : await api.createPaygCheckout(id);
      
      if (!url) {
        setMessage({ type: "error", text: "Failed to create checkout. Please check Stripe configuration." });
        setPurchasing(null);
        return;
      }
      
      window.location.href = url;
    } catch (err: any) {
      console.error("Failed to create checkout:", err);
      setMessage({ type: "error", text: err.message || "Failed to create checkout. Please try again." });
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    );
  }

  const tiers = billingData?.tiers || {};
  const packs = billingData?.payg_packs || {};

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Billing & Credits
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage your Stick Credits and subscription plans.
        </p>
      </div>

      {/* Message banner */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === "success" 
            ? "bg-green-50 border border-green-200 text-green-800" 
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          <span className="material-symbols-outlined">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="text-sm">{message.text}</span>
          <button 
            onClick={() => setMessage(null)} 
            className="ml-auto text-current opacity-60 hover:opacity-100"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Current Balance */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Available Credits</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {billingData?.credits_remaining.toLocaleString() || 0} SC
            </p>
            {billingData?.subscription?.active_tier && (
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  billingData.subscription.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    billingData.subscription.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></span>
                  {billingData.tiers[billingData.subscription.active_tier]?.label || billingData.subscription.active_tier} - {billingData.subscription.status}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-4xl text-slate-200">
              account_balance_wallet
            </span>
          </div>
        </div>
      </div>

      {/* Usage Costs */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Usage Costs</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {USAGE_COSTS.map((usage) => (
            <div key={usage.key} className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-sm font-medium text-slate-900">{usage.name}</p>
              <p className="text-2xl font-bold text-slate-800 mt-2">{usage.credits} SC</p>
              <p className="text-xs text-slate-500 mt-1">{usage.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "subscriptions"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setActiveTab("credits")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "credits"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Buy Credits
        </button>
      </div>

      {/* Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="grid md:grid-cols-3 gap-6">
          {Object.entries(tiers).map(([key, tier]) => (
            <div
              key={key}
              className={`bg-white border rounded-xl p-6 shadow-sm flex flex-col ${
                key === "growth"
                  ? "border-slate-800 ring-1 ring-slate-800"
                  : "border-slate-200"
              }`}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{tier.label}</h3>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-slate-900">{tier.eur_display}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {tier.credits.toLocaleString()} credits/month
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {tier.per_credit} per credit
                </div>

                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-[18px] text-green-600">check</span>
                    {tier.credits} credits/month
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-[18px] text-green-600">check</span>
                    Auto-renewal
                  </li>
                  <li className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="material-symbols-outlined text-[18px] text-green-600">check</span>
                    Cancel anytime
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handlePurchase("tier", key)}
                disabled={purchasing === `tier-${key}`}
                className={`mt-6 w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  key === "growth"
                    ? "bg-slate-800 hover:bg-slate-700 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                } disabled:opacity-50`}
              >
                {purchasing === `tier-${key}` ? "Processing..." : "Subscribe"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Credit Packs */}
      {activeTab === "credits" && (
        <div className="grid md:grid-cols-4 gap-6">
          {Object.entries(packs).map(([key, pack]) => (
            <div
              key={key}
              className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col"
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">{pack.label}</h3>
                <div className="mt-4">
                  <span className="text-2xl font-bold text-slate-900">{pack.eur_display}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {pack.credits.toLocaleString()} credits
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {pack.per_credit} per credit
                </div>
              </div>

              <button
                onClick={() => handlePurchase("payg", key)}
                disabled={purchasing === `payg-${key}`}
                className="mt-6 w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50"
              >
                {purchasing === `payg-${key}` ? "Processing..." : "Buy Now"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}
