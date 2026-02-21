"use client";

import { useState, useEffect } from "react";
import { api, Lead, WSMessage } from "@/lib/api";

interface DashboardProps {
  onSelectLead: (id: number) => void;
}

const DEMO_LEADS: Lead[] = [
  {
    id: 1,
    company_name: "Acme Corp",
    company_url: "acme.com",
    industry: "Manufacturing",
    employees: 2500,
    revenue: "$500M - $1B",
    best_match_score: 9.0,
    enrichment_status: "complete",
    pitch_deck_generated: true,
    email_generated: true,
  },
  {
    id: 2,
    company_name: "Stratos AI",
    company_url: "stratos.ai",
    industry: "Technology",
    employees: 120,
    revenue: "$10M - $50M",
    best_match_score: 8.2,
    enrichment_status: "in_progress",
    pitch_deck_generated: false,
    email_generated: true,
  },
  {
    id: 3,
    company_name: "Global Logistics",
    company_url: "globallog.co",
    industry: "Transportation",
    employees: 12000,
    revenue: "$2B+",
    best_match_score: 7.5,
    enrichment_status: "pending",
    pitch_deck_generated: false,
    email_generated: false,
  },
  {
    id: 4,
    company_name: "Nexus Tech",
    company_url: "nexustech.io",
    industry: "Software",
    employees: 350,
    revenue: "$50M - $100M",
    best_match_score: 5.4,
    enrichment_status: "complete",
    pitch_deck_generated: true,
    email_generated: true,
  },
  {
    id: 5,
    company_name: "Cyberdyne Systems",
    company_url: "cyberdyne.net",
    industry: "Defense",
    employees: 6000,
    revenue: "$2.5B",
    best_match_score: 2.5,
    enrichment_status: "failed",
    pitch_deck_generated: false,
    email_generated: false,
  },
] as Lead[];

const ROW_ICONS = [
  "business",
  "science",
  "local_shipping",
  "terminal",
  "shield",
];

function empRange(n?: number) {
  if (!n) return "-";
  if (n < 50) return "1 - 50";
  if (n < 200) return "50 - 200";
  if (n < 500) return "200 - 500";
  if (n < 1000) return "500 - 1,000";
  if (n < 5000) return "1,000 - 5,000";
  if (n < 10000) return "5,000+";
  return "10,000+";
}

function statusDot(s: string) {
  if (s === "complete") return "bg-slate-400";
  if (s === "in_progress") return "bg-slate-300 animate-pulse";
  if (s === "failed") return "bg-slate-400 opacity-30";
  return "border border-slate-300";
}

function statusLabel(s: string) {
  if (s === "complete") return "Complete";
  if (s === "in_progress") return "In Progress";
  if (s === "failed") return "Failed";
  return "Pending";
}

function barColor(score: number) {
  if (score >= 8) return "bg-slate-800";
  if (score >= 6) return "bg-slate-600";
  if (score >= 4) return "bg-slate-500";
  return "bg-slate-300";
}

export default function Dashboard({ onSelectLead }: DashboardProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchLeads = () => {
    api
      .getLeads()
      .then(setLeads)
      .catch(() => setLeads(DEMO_LEADS))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();

    // Connect WebSocket for live updates
    api.connectWebSocket();
    const unsubscribe = api.onMessage((msg: WSMessage) => {
      if (msg.type === "cell_update") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === msg.lead_id ? { ...l, [msg.field]: msg.value } : l,
          ),
        );
      } else if (msg.type === "enrichment_complete") {
        // Re-fetch to get the full updated lead
        api
          .getLead(msg.lead_id)
          .then((updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l)),
            );
          })
          .catch(() => {});
      } else if (msg.type === "enrichment_start") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === msg.lead_id
              ? { ...l, enrichment_status: "in_progress" }
              : l,
          ),
        );
      } else if (msg.type === "enrichment_error") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === msg.lead_id ? { ...l, enrichment_status: "failed" } : l,
          ),
        );
      } else if (msg.type === "match_update") {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === msg.lead_id
              ? {
                  ...l,
                  best_match_score: msg.match_score,
                  best_match_product: msg.product_name,
                }
              : l,
          ),
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.runDiscovery();
      // After discovery starts, periodically refresh leads as they come in
      const interval = setInterval(() => {
        api
          .getLeads()
          .then((newLeads) => {
            if (newLeads.length > 0) setLeads(newLeads);
          })
          .catch(() => {});
      }, 3000);
      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(interval), 120000);
    } catch (err) {
      console.error("Discovery failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const filtered = leads.filter((l) =>
    l.company_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Leads &amp; Enrichment
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Track enrichment status and AI match scores.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              filter_list
            </span>
            Filter
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${generating ? "animate-spin" : ""}`}
            >
              {generating ? "progress_activity" : "bolt"}
            </span>
            {generating ? "Generating..." : "Generate"}
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">
              search
            </span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border-0 bg-transparent text-slate-900 placeholder-slate-400 focus:ring-0 sm:text-sm"
            placeholder="Search companies..."
          />
        </div>
        <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto px-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap">
            <span>Match Score</span>
            <span className="material-symbols-outlined text-[16px] text-slate-400">
              arrow_downward
            </span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap">
            <span>Status</span>
            <span className="material-symbols-outlined text-[16px] text-slate-400">
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                {[
                  "Company Name",
                  "Industry",
                  "Employees",
                  "Revenue",
                  "Match",
                  "Status",
                  "Assets",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide ${i === 0 ? "w-[25%]" : ""}`}
                  >
                    {h}
                  </th>
                ))}
                <th className="relative px-6 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Loading leads...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    No leads yet. Press generate to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                          <span className="material-symbols-outlined text-[18px]">
                            {ROW_ICONS[idx % ROW_ICONS.length]}
                          </span>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-900">
                            {lead.company_name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {lead.company_url || "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-500">
                      {lead.industry || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-500">
                      {empRange(lead.employees)}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-sm text-slate-500">
                      {lead.revenue || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      {lead.best_match_score ? (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-700 w-6 text-right">
                            {lead.best_match_score.toFixed(1)}
                          </span>
                          <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden">
                            <div
                              className={`${barColor(lead.best_match_score)} h-1 rounded-full`}
                              style={{
                                width: `${lead.best_match_score * 10}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${statusDot(lead.enrichment_status)}`}
                        />
                        <span className="text-xs font-medium text-slate-600">
                          {statusLabel(lead.enrichment_status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                        <span
                          className={`material-symbols-outlined text-[16px] ${lead.pitch_deck_generated ? "text-slate-800" : "text-slate-300"}`}
                          title={
                            lead.pitch_deck_generated
                              ? "Pitch Deck Generated"
                              : "Pending"
                          }
                        >
                          slideshow
                        </span>
                        <span
                          className={`material-symbols-outlined text-[16px] ${lead.email_generated ? "text-slate-800" : "text-slate-300"}`}
                          title={
                            lead.email_generated ? "Email Generated" : "Pending"
                          }
                        >
                          mail
                        </span>
                        <span
                          className="material-symbols-outlined text-[16px] text-slate-300"
                          title="Pending"
                        >
                          mic
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-slate-300 hover:text-slate-600 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">
                          more_horiz
                        </span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-slate-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">1</span> to{" "}
              <span className="font-medium text-slate-700">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">
                {filtered.length}
              </span>{" "}
              results
            </p>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-200 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>
              <button className="z-10 bg-slate-100 border-slate-200 text-slate-700 relative inline-flex items-center px-4 py-2 border text-sm font-medium">
                1
              </button>
              <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-200 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
