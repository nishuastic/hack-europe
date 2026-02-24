"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FEATURES = [
  { name: "Credits per month", starter: "500", growth: "2,500", enterprise: "10,000" },
  { name: "Company enrichment", starter: "100", growth: "500", enterprise: "2,000" },
  { name: "Product matching", starter: "250", growth: "1,250", enterprise: "5,000" },
  { name: "Pitch deck generation", starter: "50", growth: "250", enterprise: "1,000" },
  { name: "Email generation", starter: "500", growth: "2,500", enterprise: "10,000" },
  { name: "Auto-renewal", starter: true, growth: true, enterprise: true },
  { name: "Cancel anytime", starter: true, growth: true, enterprise: true },
  { name: "Priority support", starter: false, growth: true, enterprise: true },
  { name: "Custom integrations", starter: false, growth: false, enterprise: true },
];

export default function PricingPage() {
  const router = useRouter();

  const tiers = {
    starter: {
      label: "Stick Starter",
      price_id: "price_1T3NMyLz0lFEuRtxYy50V3cd",
      credits: 500,
      eur_display: "€29/mo",
      per_credit: "€0.058",
    },
    growth: {
      label: "Stick Growth",
      price_id: "price_1T3NMzLz0lFEuRtxGSokBEtE",
      credits: 2000,
      eur_display: "€89/mo",
      per_credit: "€0.045",
    },
    scale: {
      label: "Stick Scale",
      price_id: "price_1T3NN0Lz0lFEuRtxyQJmvFcm",
      credits: 10000,
      eur_display: "€349/mo",
      per_credit: "€0.035",
    },
  };

  const paygPacks = {
    "100": {
      label: "100 Stick Credits",
      price_id: "price_1T3NN0Lz0lFEuRtxCRPCPrFA",
      credits: 100,
      eur_display: "€9.99",
      per_credit: "€0.100",
    },
    "500": {
      label: "500 Stick Credits",
      price_id: "price_1T3NN1Lz0lFEuRtxBxthtqU0",
      credits: 500,
      eur_display: "€39.99",
      per_credit: "€0.080",
    },
    "2000": {
      label: "2,000 Stick Credits",
      price_id: "price_1T3NN1Lz0lFEuRtxHbKHWIUg",
      credits: 2000,
      eur_display: "€129.99",
      per_credit: "€0.065",
    },
    "5000": {
      label: "5,000 Stick Credits",
      price_id: "price_1T3NN2Lz0lFEuRtxAGJcAHCP",
      credits: 5000,
      eur_display: "€249.99",
      per_credit: "€0.050",
    },
  };

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-0 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-15 h-15 rounded-lg flex items-center justify-center">
              <span
                className="w-14 h-14 bg-amber-800"
                style={{
                  WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                  mask: "url('/stick_2.svg') center / contain no-repeat",
                }}
                aria-label="Stick logo"
              />
            </div>
            <span className="text-5xl font-semibold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Stick
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5">
              Features
            </a>
            <a href="#how-it-works" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5">
              How it works
            </a>
            <a href="/pricing" className="hidden sm:block text-sm text-slate-900 font-medium px-3 py-1.5">
              Pricing
            </a>
            <button
              onClick={() => router.push("/app")}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-md"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Pricing Content */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <p className="text-base font-extrabold text-gray-600 uppercase tracking-widest mb-3">
              Pricing
            </p>
            <h1
              className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              Simple, usage-based pricing
            </h1>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto text-lg" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Start for free. Pay only for what you use. No hidden fees, cancel anytime.
            </p>
          </div>
              {/* Pay-as-you-go - Prominent */}
              <div className="mb-20">
                <div className="text-center mb-8">
                  <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full mb-4">
                    No subscription required
                  </span>
                  <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    Pay-as-you-go
                  </h2>
                  <p className="mt-2 text-slate-500">Buy credits upfront. No expiration. Use anytime.</p>
                </div>
                <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
                  {Object.entries(paygPacks).map(([key, pack]) => (
                    <div
                      key={key}
                      className="bg-white border-2 border-slate-200 rounded-2xl p-8 hover:border-slate-400 transition-colors"
                    >
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-slate-900">{pack.label}</h3>
                        <div className="mt-4">
                          <span className="text-4xl font-bold text-slate-900">{pack.eur_display}</span>
                        </div>
                        <div className="mt-3 text-lg text-slate-600 font-medium">
                          {pack.credits.toLocaleString()} credits
                        </div>
                        <div className="mt-1 text-sm text-slate-400">
                          {pack.per_credit} per credit
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscription Plans */}
              <div className="mb-16">
                <div className="text-center mb-8">
                  <span className="inline-block px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full mb-4">
                    Subscription plans
                  </span>
                  <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                    Monthly Plans
                  </h2>
                  <p className="mt-2 text-slate-500">Auto-renewing plans with better per-credit pricing.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  {Object.entries(tiers).map(([key, tier]) => (
                    <div
                      key={key}
                      className={`bg-white border rounded-2xl p-8 ${
                        key === "growth"
                          ? "border-slate-800 ring-2 ring-slate-800"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-slate-900">{tier.label}</h3>
                        {key === "growth" && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-white">
                            Popular
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-4xl font-bold text-slate-900">{tier.eur_display}</span>
                        <span className="text-slate-500">/month</span>
                      </div>
                      <div className="mt-3 text-sm text-slate-500">
                        {tier.credits.toLocaleString()} credits/month
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {tier.per_credit} per credit
                      </div>
                      <button
                        onClick={() => router.push("/app")}
                        className={`mt-6 w-full py-3 px-4 rounded-xl text-base font-medium transition-all ${
                          key === "growth"
                            ? "bg-slate-800 hover:bg-slate-700 text-white"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-900"
                        }`}
                      >
                        Get started
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comparison Table */}
              <div className="overflow-x-auto mb-20">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-slate-900">Features</th>
                      {Object.entries(tiers).map(([key, tier]) => (
                        <th key={key} className="text-center py-4 px-4 text-sm font-semibold text-slate-900">
                          {tier.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURES.map((feature, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-4 px-4 text-sm text-slate-600">{feature.name}</td>
                        <td className="text-center py-4 px-4">
                          {typeof feature.starter === "boolean" ? (
                            feature.starter ? (
                              <span className="material-symbols-outlined text-green-600">check</span>
                            ) : (
                              <span className="material-symbols-outlined text-slate-300">close</span>
                            )
                          ) : (
                            <span className="text-sm text-slate-900 font-medium">{feature.starter}</span>
                          )}
                        </td>
                        <td className="text-center py-4 px-4">
                          {typeof feature.growth === "boolean" ? (
                            feature.growth ? (
                              <span className="material-symbols-outlined text-green-600">check</span>
                            ) : (
                              <span className="material-symbols-outlined text-slate-300">close</span>
                            )
                          ) : (
                            <span className="text-sm text-slate-900 font-medium">{feature.growth}</span>
                          )}
                        </td>
                        <td className="text-center py-4 px-4">
                          {typeof feature.enterprise === "boolean" ? (
                            feature.enterprise ? (
                              <span className="material-symbols-outlined text-green-600">check</span>
                            ) : (
                              <span className="material-symbols-outlined text-slate-300">close</span>
                            )
                          ) : (
                            <span className="text-sm text-slate-900 font-medium">{feature.enterprise}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Ready to get started?
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Start discovering prospects and generating pitches in minutes.
          </p>
          <button
            onClick={() => router.push("/app")}
            className="mt-8 bg-slate-900 text-white text-base font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg inline-flex items-center gap-2"
          >
            Start for free
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-1">
              <span
                className="w-8 h-8 bg-slate-900"
                style={{
                  WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                  mask: "url('/stick_2.svg') center / contain no-repeat",
                }}
              />
              <span className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                Stick
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <a href="/#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
              <a href="/#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
              <a href="/pricing" className="text-sm text-slate-900 font-medium">Pricing</a>
              <button onClick={() => router.push("/app")} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Get started</button>
            </nav>
          </div>
          <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Stick. Built at HackEurope 2026.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
