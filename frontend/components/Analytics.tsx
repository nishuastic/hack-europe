"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface AnalyticsData {
  total_leads: number;
  enriched_count: number;
  industry_breakdown: Record<string, number>;
  avg_icp_score_by_product: Record<string, number>;
  top_opportunities: {
    lead_id: number;
    company_name: string;
    product_name: string;
    icp_score: number;
    conversion_likelihood: string | null;
  }[];
  signal_frequency: Record<string, number>;
  score_distribution: Record<string, number>;
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-4">
      <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[20px] text-slate-600">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

function BarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const max = Math.max(...entries.map(([, v]) => v), 1);

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 py-4">No data yet</p>;
  }

  return (
    <div className="space-y-2.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => (
          <div key={label} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 font-medium w-28 truncate shrink-0" title={label}>
              {label}
            </span>
            <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all duration-500"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-8 text-right shrink-0">{value}</span>
          </div>
        ))}
    </div>
  );
}

function conversionBadge(likelihood: string | null) {
  if (!likelihood) return <span className="text-xs text-slate-400">-</span>;
  const cls =
    likelihood === "high"
      ? "bg-slate-900 text-white"
      : likelihood === "medium"
        ? "bg-slate-200 text-slate-800"
        : "bg-slate-100 text-slate-500";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {likelihood.charAt(0).toUpperCase() + likelihood.slice(1)}
    </span>
  );
}

function AnalyticsContent() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAnalytics()
      .then((d) => setData(d as AnalyticsData))
      .catch((err) => console.error("Failed to load analytics:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-4xl text-slate-300 animate-spin">progress_activity</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <span className="material-symbols-outlined text-4xl text-slate-300">error</span>
        <p className="text-sm text-slate-500">Failed to load analytics</p>
      </div>
    );
  }

  const topScore =
    data.top_opportunities.length > 0
      ? `${data.top_opportunities[0].icp_score}/100`
      : "-";

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Analytics</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of your pipeline performance and insights.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={data.total_leads} icon="group" />
        <StatCard label="Enriched" value={data.enriched_count} icon="check_circle" />
        <StatCard
          label="Industries"
          value={Object.keys(data.industry_breakdown).length}
          icon="category"
        />
        <StatCard label="Top ICP Score" value={topScore} icon="star" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Industry breakdown */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500">pie_chart</span>
            Industry Breakdown
          </h3>
          <BarChart data={data.industry_breakdown} />
        </div>

        {/* ICP Score distribution */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500">bar_chart</span>
            ICP Score Distribution
          </h3>
          <BarChart data={data.score_distribution} />
        </div>

        {/* Avg ICP score by product */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500">inventory_2</span>
            Avg ICP Score by Product
          </h3>
          <BarChart data={data.avg_icp_score_by_product} />
        </div>

        {/* Buying signal frequency */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500">sensors</span>
            Buying Signal Frequency
          </h3>
          <BarChart data={data.signal_frequency} />
        </div>
      </div>

      {/* Top opportunities */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-slate-500">trending_up</span>
          Top 5 Opportunities
        </h3>
        {data.top_opportunities.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">No matches yet. Run matching to see top opportunities.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr>
                  {["Company", "Product", "ICP Score", "Conversion"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.top_opportunities.map((opp, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{opp.company_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{opp.product_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-slate-900">
                        {opp.icp_score}/100
                      </span>
                    </td>
                    <td className="px-4 py-3">{conversionBadge(opp.conversion_likelihood)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  return (
    <div className="min-h-full">
      <AnalyticsContent />
    </div>
  );
}
