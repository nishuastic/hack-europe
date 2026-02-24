"use client";

const USAGE_COSTS = [
  { name: "Enrich Lead", key: "enrichment", credits: 5, description: "Deep web research per company" },
  { name: "Matching", key: "matching", credits: 2, description: "AI product-to-lead matching" },
  { name: "Pitch Deck Generation", key: "pitch_deck", credits: 10, description: "7-slide personalized deck" },
  { name: "Email Generation", key: "email", credits: 1, description: "Personalized outreach email" },
  { name: "LinkedIn Outreach", key: "linkedin_outreach", credits: 0, description: "Warm intro outreach plan" },
  { name: "ICP Research", key: "icp_research", credits: 3, description: "Per customer researched" },
];

export default function Billing() {
  return (
    <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Usage & Costs
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Track your Stick usage. You provide your own API keys — we track usage for analytics.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-amber-600 text-3xl">info</span>
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Bring Your Own Keys (BYOK)</h3>
            <p className="text-amber-800 mt-2 text-sm">
              Stick uses your own API keys for Anthropic (Claude) and LinkUp. 
              You pay the providers directly — we just track usage for analytics and insights.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-amber-800">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check</span>
                No credit purchases needed
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check</span>
                Track your usage history in the Analytics tab
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">check</span>
                See hours and dollars saved vs manual research
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Costs */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 tracking-tight mb-2">Usage Tracking</h2>
        <p className="text-slate-500 mb-6">Each action consumes Stick Credits (SC) for tracking purposes:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {USAGE_COSTS.map((usage) => (
            <div key={usage.key} className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-medium text-slate-900">{usage.name}</p>
              <p className="text-3xl font-bold text-slate-800 mt-2">
                {usage.credits} <span className="text-lg font-medium text-slate-500">SC</span>
              </p>
              <p className="text-xs text-slate-500 mt-2">{usage.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hours Saved Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-slate-600 text-3xl">trending_up</span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Time Saved</h3>
            <p className="text-slate-600 mt-2 text-sm">
              Stick automates hours of manual research and outreach. Based on average SDR rates ($50/hr):
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Enrichment: ~2 hours saved per company
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Pitch Deck: ~3 hours saved per deck
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                Email: ~30 minutes saved per email
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
