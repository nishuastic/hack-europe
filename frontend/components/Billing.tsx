"use client";

import { useState, useEffect } from "react";
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
  subscription?: { active_tier: string | null; status: string | null };
}

const USAGE_COSTS = [
  { name: "Enrich Lead", key: "enrichment", credits: 5, description: "Deep web research per company" },
  { name: "Matching", key: "matching", credits: 2, description: "AI product-to-lead matching" },
  { name: "Pitch Deck Generation", key: "pitch_deck", credits: 10, description: "7-slide personalized deck" },
  { name: "Email Generation", key: "email", credits: 1, description: "Personalized outreach email" },
];

export default function Billing() {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "credits">("subscriptions");

  useEffect(() => {
    api.getBillingCredits()
      .then(setBillingData)
      .catch((err) => console.error("Failed to load billing:", err))
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (type: "tier" | "payg", id: string) => {
    setPurchasing(type === "tier" ? `tier-${id}` : `payg-${id}`);
    try {
      const url = type === "tier"
        ? await api.createTierCheckout(id)
        : await api.createPaygCheckout(id);
      window.location.href = url;
    } catch (err) {
      console.error("Failed to create checkout:", err);
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
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Billing & Credits
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage your Stick Credits and subscription plans.
        </p>
      </div>

      {/* Current Balance */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Available Credits</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {billingData?.credits_remaining.toLocaleString() || 0} SC
            </p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          {Object.entries(tiers).map(([key, tier]) => {
            const isCurrentSubscription = billingData?.subscription?.active_tier === key;
            const subscriptionStatus = billingData?.subscription?.status;
            
            return (
              <div
                key={key}
                className={`bg-white border rounded-xl p-6 shadow-sm flex flex-col ${
                  key === "growth"
                    ? "border-slate-800 ring-1 ring-slate-800"
                    : "border-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{tier.label}</h3>
                    {isCurrentSubscription && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-slate-900">{tier.eur_display}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {tier.credits.toLocaleString()} credits/month
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {tier.per_credit} per credit
                  </div>
                  {isCurrentSubscription && subscriptionStatus && (
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        subscriptionStatus === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {subscriptionStatus === 'active' ? (
                          <span className="material-symbols-outlined text-[14px] mr-1">check_circle</span>
                        ) : (
                          <span className="material-symbols-outlined text-[14px] mr-1">pending</span>
                        )}
                        {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                      </span>
                    </div>
                  )}

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
                  {purchasing === `tier-${key}` ? "Processing..." : isCurrentSubscription ? "Current Plan" : "Subscribe"}
                </button>
              </div>
            );
          })}
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
