"use client";

import { useState, useEffect } from "react";
import { api, GenerationRun, Product, WSMessage } from "@/lib/api";

interface DashboardProps {
  onSelectRun: (id: number) => void;
}

function statusDot(s: string) {
  if (s === "complete") return "bg-slate-400";
  if (s === "running") return "bg-slate-300 animate-pulse";
  if (s === "failed") return "bg-slate-400 opacity-30";
  return "border border-slate-300";
}

function statusLabel(s: string) {
  if (s === "complete") return "Complete";
  if (s === "running") return "Running";
  if (s === "failed") return "Failed";
  return "Pending";
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Dashboard({ onSelectRun }: DashboardProps) {
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [discoveryPhase, setDiscoveryPhase] = useState<string>("");
  const [discoveryProgress, setDiscoveryProgress] = useState<string>("");
  const [viewingSnapshot, setViewingSnapshot] = useState<GenerationRun | null>(null);

  const fetchRuns = () => {
    api
      .getGenerationRuns()
      .then((data) => setRuns(data))
      .catch((err) => console.error("Failed to fetch runs:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRuns();

    // Poll for updates while any run is still running
    const interval = setInterval(() => {
      api.getGenerationRuns().then((newRuns) => {
        setRuns(newRuns);
        if (!newRuns.some((r) => r.status === "running")) {
          setGenerating(false);
          setDiscoveryPhase("");
          setDiscoveryProgress("");
        }
      }).catch(() => {});
    }, 5000);

    // Listen for discovery progress updates
    api.connectWebSocket();
    const unsubscribe = api.onMessage((msg: WSMessage) => {
      if (msg.type === "discovery_start") {
        setDiscoveryPhase("Starting discovery...");
        setDiscoveryProgress(`Searching for up to ${msg.max_companies} companies across ${msg.product_count} products`);
      } else if (msg.type === "discovery_thinking") {
        const phaseName = msg.iteration === 1 ? "Searching" : "Evaluating";
        setDiscoveryPhase(`${phaseName}...`);
        setDiscoveryProgress(msg.detail);
      } else if (msg.type === "discovery_complete") {
        setGenerating(false);
        setDiscoveryPhase("");
        setDiscoveryProgress("");
        fetchRuns();
      } else if (msg.type === "company_discovered") {
        setDiscoveryPhase("Company found!");
        setDiscoveryProgress(msg.why_good_fit || msg.company_name);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleGenerateClick = async () => {
    // Load products for selection
    try {
      const prods = await api.getProducts();
      setProducts(prods);
      if (prods.length === 0) {
        alert("No products found. Add products before generating.");
        return;
      }
      setSelectedProductIds(new Set(prods.map((p) => p.id)));
      setShowProductModal(true);
    } catch {
      alert("Failed to load products.");
    }
  };

  const toggleProduct = (id: number) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartGeneration = async () => {
    if (selectedProductIds.size === 0) return;
    setShowProductModal(false);
    setGenerating(true);

    try {
      await api.runDiscovery(Array.from(selectedProductIds));
      // Re-fetch runs to show the new one
      fetchRuns();
    } catch (err) {
      console.error("Discovery failed:", err);
      setGenerating(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Generation Runs
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Each run discovers prospects matched to your selected products.
          </p>
        </div>
        <button
          onClick={handleGenerateClick}
          disabled={generating}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">
            {generating ? "hourglass_empty" : "bolt"}
          </span>
          {generating ? "Generating..." : "New Generation"}
        </button>
      </div>

      {/* Generating banner */}
      {generating && (
        <div className="flex items-center gap-4 bg-slate-900 text-white px-5 py-4 rounded-lg animate-fadeIn">
          <div className="size-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">psychology</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{discoveryPhase || "AI Discovery Agent Running"}</p>
            <p className="text-xs text-slate-400 mt-1">{discoveryProgress || "Searching for matching companies and enriching data..."}</p>
          </div>
        </div>
      )}

      {/* Runs list */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                {["Date", "Products", "Params", "Prospects Found", "Status", ""].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="material-symbols-outlined text-[40px] text-slate-300">
                        search
                      </span>
                      <p className="text-slate-500 text-sm">No generation runs yet.</p>
                      <p className="text-slate-400 text-xs">Click &quot;New Generation&quot; to discover prospects.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {new Date(run.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {timeAgo(run.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {run.product_names.map((name, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700"
                          >
                            {name}
                          </span>
                        ))}
                        {run.product_snapshots && run.product_snapshots.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingSnapshot(run);
                            }}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[12px] mr-1">info</span>
                            View
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs text-slate-500">
                        Max: {run.max_companies}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        {run.lead_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${statusDot(run.status)}`} />
                        <span className="text-xs font-medium text-slate-600">
                          {statusLabel(run.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="material-symbols-outlined text-[18px] text-slate-300 group-hover:text-slate-500 transition-colors">
                        chevron_right
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Select Products
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Choose which products to find prospects for.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                {products.map((product) => (
                  <label
                    key={product.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedProductIds.has(product.id)
                        ? "border-slate-800 bg-slate-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {product.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  if (selectedProductIds.size === products.length) {
                    setSelectedProductIds(new Set());
                  } else {
                    setSelectedProductIds(new Set(products.map((p) => p.id)));
                  }
                }}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                {selectedProductIds.size === products.length ? "Deselect all" : "Select all"}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartGeneration}
                  disabled={selectedProductIds.size === 0}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-md text-sm font-medium shadow-sm transition-all disabled:opacity-50"
                >
                  Generate for {selectedProductIds.size} product{selectedProductIds.size !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product Snapshot Modal */}
      {viewingSnapshot && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Product Snapshots
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Showing product data at time of run on {new Date(viewingSnapshot.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setViewingSnapshot(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {viewingSnapshot.product_snapshots?.map((snapshot, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-4">
                    <h3 className="text-base font-semibold text-slate-900">{snapshot.name}</h3>
                    <div className="mt-3 space-y-2 text-sm">
                      {snapshot.description && (
                        <div>
                          <span className="text-slate-500">Description:</span>
                          <p className="text-slate-700 mt-1">{snapshot.description}</p>
                        </div>
                      )}
                      {snapshot.features && snapshot.features.length > 0 && (
                        <div>
                          <span className="text-slate-500">Features:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {snapshot.features.map((f, j) => (
                              <span key={j} className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-600">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {snapshot.industry_focus && (
                          <div>
                            <span className="text-slate-500">Industry:</span>
                            <span className="text-slate-700 ml-1">{snapshot.industry_focus}</span>
                          </div>
                        )}
                        {snapshot.pricing_model && (
                          <div>
                            <span className="text-slate-500">Pricing:</span>
                            <span className="text-slate-700 ml-1">{snapshot.pricing_model}</span>
                          </div>
                        )}
                        {snapshot.company_size_target && (
                          <div>
                            <span className="text-slate-500">Target Size:</span>
                            <span className="text-slate-700 ml-1">{snapshot.company_size_target}</span>
                          </div>
                        )}
                        {snapshot.geography && (
                          <div>
                            <span className="text-slate-500">Geography:</span>
                            <span className="text-slate-700 ml-1">{snapshot.geography}</span>
                          </div>
                        )}
                        {snapshot.stage && (
                          <div>
                            <span className="text-slate-500">Stage:</span>
                            <span className="text-slate-700 ml-1">{snapshot.stage}</span>
                          </div>
                        )}
                        {snapshot.differentiator && (
                          <div className="col-span-2">
                            <span className="text-slate-500">Differentiator:</span>
                            <p className="text-slate-700">{snapshot.differentiator}</p>
                          </div>
                        )}
                        {snapshot.example_clients && snapshot.example_clients.length > 0 && (
                          <div className="col-span-2">
                            <span className="text-slate-500">Example Clients:</span>
                            <span className="text-slate-700 ml-1">{snapshot.example_clients.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
