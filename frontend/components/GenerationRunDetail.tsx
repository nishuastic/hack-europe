"use client";

import { useState, useEffect } from "react";
import { api, Lead, GenerationRun, WSMessage } from "@/lib/api";

interface GenerationRunDetailProps {
  runId: number;
  onBack: () => void;
  onSelectLead: (id: number) => void;
}

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

export default function GenerationRunDetail({
  runId,
  onBack,
  onSelectLead,
}: GenerationRunDetailProps) {
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addText, setAddText] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getGenerationRun(runId),
      api.getLeads(runId),
    ])
      .then(([runData, leadsData]) => {
        setRun(runData);
        setLeads(leadsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

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
      }
    });

    // Poll for new leads while run is still running
    const pollInterval = setInterval(() => {
      api.getLeads(runId).then(setLeads).catch(() => {});
      api.getGenerationRun(runId).then(setRun).catch(() => {});
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [runId]);

  const filtered = leads.filter((l) => {
    const matchesSearch = l.company_name
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || l.enrichment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-3"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Back to runs
          </button>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {run
              ? `Generation — ${new Date(run.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
              : "Generation Run"}
          </h1>
          {run && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex flex-wrap gap-1.5">
                {run.product_names.map((name, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${statusDot(run.status)}`}
                />
                <span className="text-xs font-medium text-slate-500">
                  {statusLabel(run.status)}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add companies
          </button>
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all flex items-center gap-2 ${showFilters ? "bg-slate-50 border-slate-300" : ""}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                filter_list
              </span>
              Filter
              {statusFilter !== "all" && (
                <span className="w-2 h-2 bg-primary rounded-full"></span>
              )}
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 py-1">
                {["all", "pending", "in_progress", "complete", "failed"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStatusFilter(s);
                        setShowFilters(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${statusFilter === s ? "bg-slate-100 font-medium" : ""}`}
                    >
                      {s === "all"
                        ? "All Status"
                        : s.charAt(0).toUpperCase() +
                          s.slice(1).replace("_", " ")}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
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
        <div className="flex items-center gap-2 w-full lg:w-auto">
          {statusFilter !== "all" && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              Status: {statusFilter.replace("_", " ")}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-1 hover:text-slate-700"
              >
                x
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="min-w-full divide-y divide-slate-100 table-fixed">
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[200px]">
                  Company Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[150px]">
                  Industry
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[100px]">
                  Employees
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[100px]">
                  Revenue
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[80px]">
                  ICP Fit
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[100px]">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap max-w-[80px]">
                  Assets
                </th>
                <th className="relative px-6 py-4 whitespace-nowrap max-w-[50px]">
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
                    className="px-6 py-12 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[40px] text-slate-300">
                        group
                      </span>
                      <p className="text-slate-500 text-sm">
                        {run?.status === "running"
                          ? "Discovering prospects..."
                          : "No prospects found in this run."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((lead, idx) => (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead.id)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-3.5 whitespace-nowrap max-w-[200px]">
                      <div className="flex items-center">
                        {lead.company_url ? (
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${lead.company_url}&sz=64`}
                            alt=""
                            className="flex-shrink-0 h-8 w-8 rounded bg-slate-100 border border-slate-200"
                          />
                        ) : (
                          <div className="flex-shrink-0 h-8 w-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                            <span className="material-symbols-outlined text-[18px]">
                              {ROW_ICONS[idx % ROW_ICONS.length]}
                            </span>
                          </div>
                        )}
                        <div className="ml-3 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {lead.company_name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 truncate">
                            {lead.company_url || "N/A"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap max-w-[150px] text-sm text-slate-500 truncate">
                      {lead.industry || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap max-w-[100px] text-sm text-slate-500 truncate">
                      {empRange(lead.employees)}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap max-w-[100px] text-sm text-slate-500 truncate">
                      {lead.revenue || "-"}
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap max-w-[80px]">
                      {lead.icp_fit_score != null ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                            lead.icp_fit_score >= 70
                              ? "bg-green-100 text-green-700"
                              : lead.icp_fit_score >= 40
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}
                          title={lead.icp_fit_reasoning || ""}
                        >
                          {Math.round(lead.icp_fit_score)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">--</span>
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

        {/* Footer */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-slate-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">
                {leads.length}
              </span>{" "}
              prospects
            </p>
          </div>
        </div>
      </div>

      {/* Add companies modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Add more companies
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Paste company names, one per line. They will be enriched and
              appear live in the table.
            </p>
            <textarea
              className="w-full border border-slate-200 rounded-lg p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              rows={6}
              placeholder={"Acme Corp\nGlobex Inc\nInitech"}
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddText("");
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={adding || !addText.trim()}
                onClick={async () => {
                  const companies = addText
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  if (!companies.length) return;
                  setAdding(true);
                  try {
                    const result = await api.importLeads(companies, runId);
                    // Optimistically add pending rows
                    const newLeads: Lead[] = result.lead_ids.map((id, i) => ({
                      id,
                      company_name: companies[i],
                      enrichment_status: "pending",
                    }));
                    setLeads((prev) => [...prev, ...newLeads]);
                    // Bump run lead count
                    setRun((prev) =>
                      prev
                        ? {
                            ...prev,
                            lead_count:
                              (prev.lead_count ?? 0) + companies.length,
                          }
                        : prev,
                    );
                    setShowAddModal(false);
                    setAddText("");
                  } catch {
                    // ignore
                  } finally {
                    setAdding(false);
                  }
                }}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-all"
              >
                {adding ? "Adding…" : "Add companies"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
