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
  const [activeTab] = useState<"subscriptions">("subscriptions");
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);

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

  const handleBuyCredits = async () => {
    if (creditAmount < 100 || creditAmount > 100000) return;
    setPurchasing("custom-credits");
    try {
      const url = await api.createCustomCreditCheckout(creditAmount);
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

  return (
    <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Billing & Credits
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Manage your Stick Credits and subscription plans.
        </p>
      </div>

      {/* Available Credits — centered */}
      <div className="flex flex-col items-center gap-3 -mt-2">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl text-slate-300 mt-5">
            account_balance_wallet
          </span>
          <div>
            <p className="text-sm text-slate-500">Available Credits</p>
            <p className="text-5xl font-bold text-slate-900">
              {billingData?.credits_remaining.toLocaleString() || 0} SC
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddCredits(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Credits
        </button>
      </div>

      {/* Try a Subscription heading */}
      <h2 className="text-xl font-semibold text-slate-900 text-center">Try a Subscription</h2>

      {/* Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
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
                  {key === "growth" && (
                    <p className="text-xs font-medium text-slate-400 mb-1">Best value</p>
                  )}
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

      {/* Usage Costs */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight mb-5">Usage Costs</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {USAGE_COSTS.map((usage) => (
            <div key={usage.key}>
              <p className="text-base font-medium text-slate-900">{usage.name}</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{usage.credits} SC</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Credits Modal */}
      {showAddCredits && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Add Credits</h3>
              <button
                onClick={() => setShowAddCredits(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                How many credits do you want to buy?
              </label>
              <input
                type="number"
                min={100}
                max={100000}
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-transparent"
              />
              <div className="flex items-center justify-between mt-2">
                <div>
                  {creditAmount < 100 && (
                    <p className="text-xs text-red-500">Minimum 100 credits</p>
                  )}
                  {creditAmount > 100000 && (
                    <p className="text-xs text-red-500">Maximum 100,000 credits</p>
                  )}
                </div>
                {creditAmount >= 100 && creditAmount <= 100000 && (
                  <p className="text-sm text-slate-500">
                    Total: €{(creditAmount * 0.10).toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddCredits(false)}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBuyCredits}
                disabled={creditAmount < 100 || creditAmount > 100000 || purchasing === "custom-credits"}
                className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white transition-colors disabled:opacity-50"
              >
                {purchasing === "custom-credits" ? "Processing..." : `Buy ${creditAmount} Credits`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
