"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface ProductEditProps {
  productId?: number;
  onBack: () => void;
}

export default function ProductEdit({ productId, onBack }: ProductEditProps) {
  const isNew = !productId;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [features, setFeatures] = useState([""]);
  const [differentiator, setDifferentiator] = useState("");
  const [industryFocus, setIndustryFocus] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [companySizeTarget, setCompanySizeTarget] = useState("");
  const [geography, setGeography] = useState("");
  const [stage, setStage] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [exampleClients, setExampleClients] = useState([""]);
  const [currentClients, setCurrentClients] = useState<{name: string; website: string}[]>([{name: "", website: ""}]);
  const [loadingProduct, setLoadingProduct] = useState(!isNew);

  useEffect(() => {
    if (!productId) return;
    api.getProducts().then((products) => {
      const product = products.find((p) => p.id === productId);
      if (product) {
        setName(product.name);
        setDescription(product.description);
        setFeatures(product.features?.length ? [...product.features, ""] : [""]);
        setDifferentiator(product.differentiator || "");
        setIndustryFocus(product.industry_focus || "");
        setPricingModel(product.pricing_model || "");
        setCompanySizeTarget(product.company_size_target || "");
        setGeography(product.geography || "");
        setStage(product.stage || "");
        setCompanyName(product.company_name || "");
        setWebsite(product.website || "");
        setExampleClients(product.example_clients?.length ? [...product.example_clients, ""] : [""]);
        setCurrentClients((product as any).current_clients?.length ? [...(product as any).current_clients, {name: "", website: ""}] : [{name: "", website: ""}]);
      }
    }).finally(() => setLoadingProduct(false));
  }, [productId]);

  const updateFeature = (idx: number, val: string) => {
    const next = [...features];
    next[idx] = val;
    setFeatures(next);
    // Auto-add a new empty slot if the last feature is filled and it's the last one
    if (idx === features.length - 1 && val.trim() !== "" && features.length < 10) { // Limit to prevent too many
      setFeatures([...next, ""]);
    }
  };

  const addFeatureSlot = () => setFeatures([...features, ""]);

  const removeFeature = (idx: number) => {
    if (features.length > 1) {
      const next = features.filter((_, i) => i !== idx);
      setFeatures(next);
    }
  };

  const [saving, setSaving] = useState(false);

  const updateExampleClient = (idx: number, val: string) => {
    const next = [...exampleClients];
    next[idx] = val;
    setExampleClients(next);
    if (idx === exampleClients.length - 1 && val.trim() !== "" && exampleClients.length < 10) {
      setExampleClients([...next, ""]);
    }
  };

  const removeExampleClient = (idx: number) => {
    if (exampleClients.length > 1) {
      setExampleClients(exampleClients.filter((_, i) => i !== idx));
    }
  };

  const updateCurrentClient = (idx: number, field: "name" | "website", val: string) => {
    const next = [...currentClients];
    next[idx] = { ...next[idx], [field]: val };
    setCurrentClients(next);
    if (idx === currentClients.length - 1 && val.trim() !== "" && currentClients.length < 10) {
      setCurrentClients([...next, {name: "", website: ""}]);
    }
  };

  const removeCurrentClient = (idx: number) => {
    if (currentClients.length > 1) {
      setCurrentClients(currentClients.filter((_, i) => i !== idx));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cleanFeatures = features.filter((f) => f.trim());
      const cleanClients = exampleClients.filter((c) => c.trim());
      const cleanCurrentClients = currentClients.filter((c) => c.name.trim() || c.website.trim());
      const productData = {
        name,
        description,
        features: cleanFeatures,
        differentiator: differentiator || undefined,
        industry_focus: industryFocus || undefined,
        pricing_model: pricingModel || undefined,
        company_size_target: companySizeTarget || undefined,
        geography: geography || undefined,
        stage: stage || undefined,
        example_clients: cleanClients.length ? cleanClients : undefined,
        current_clients: cleanCurrentClients.length ? cleanCurrentClients : undefined,
      };
      if (isNew) {
        await api.createProduct(productData);
      } else {
        await api.updateProduct(productId!, productData);
      }
      onBack();
    } catch (e) {
      console.error("Failed to save product:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors rounded hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">
              {isNew ? "Add New Product" : `Edit: ${name}`}
            </h1>
            <p className="text-slate-500 text-sm">
              {isNew
                ? "Fill in your product details so our AI can create tailored pitches."
                : "Update your product details below."}
            </p>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saving ? "progress_activity" : "check"}
            </span>{" "}
            {saving ? "Saving..." : isNew ? "Create Product" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="clay-card rounded-2xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="size-6 rounded bg-grey-100 text-grey-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">
              inventory_2
            </span>
          </div>
          <h2 className="font-bold text-slate-800">Product Details</h2>
          {!isNew && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">
              Primary
            </span>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Product Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
              placeholder="e.g. ChurnPredict"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Product Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm placeholder:text-slate-400"
              placeholder="What does this product do?"
              rows={2}
            />
          </div>

          {/* Two-column: Features + Differentiator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Key Features
              </label>
              <div className="space-y-2">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(idx, e.target.value)}
                      placeholder={`Key Feature ${idx + 1}`}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    {features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="px-2 py-1 text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Main Differentiator
              </label>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full flex flex-col pb-4">
                <textarea
                  value={differentiator}
                  onChange={(e) => setDifferentiator(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-sm text-gray-700 placeholder:text-gray-400 focus:ring-0 resize-none leading-relaxed flex-grow"
                  placeholder="Why do customers choose this over competitors?"
                  rows={4}
                />
                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="material-symbols-outlined text-[14px]">
                    auto_awesome
                  </span>
                  <span>Crucial for pitch generation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Targeting & Market */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Targeting &amp; Market</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Industry Focus</label>
                <input
                  value={industryFocus}
                  onChange={(e) => setIndustryFocus(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400 text-sm"
                  placeholder="e.g. FinTech, Healthcare"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Pricing Model</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                >
                  <option value="">Select...</option>
                  <option value="SaaS">SaaS</option>
                  <option value="project-based">Project-based</option>
                  <option value="retainer">Retainer</option>
                  <option value="usage-based">Usage-based</option>
                  <option value="license">License</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Company Size Target</label>
                <select
                  value={companySizeTarget}
                  onChange={(e) => setCompanySizeTarget(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                >
                  <option value="">Select...</option>
                  <option value="SMB">SMB</option>
                  <option value="mid-market">Mid-market</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Geography</label>
                <input
                  value={geography}
                  onChange={(e) => setGeography(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400 text-sm"
                  placeholder="e.g. US, Europe, Global"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all text-sm"
                >
                  <option value="">Select...</option>
                  <option value="startup">Startup</option>
                  <option value="scaling">Scaling</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Example Clients */}
          <div className="border-t border-slate-100 pt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Example Clients
            </label>
            <div className="space-y-2">
              {exampleClients.map((client, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => updateExampleClient(idx, e.target.value)}
                    placeholder={`Client ${idx + 1}`}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  {exampleClients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeExampleClient(idx)}
                      className="px-2 py-1 text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Clients */}
          <div className="border-t border-slate-100 pt-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Current Clients (with website)
            </label>
            <div className="space-y-2">
              {currentClients.map((client, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={client.name}
                    onChange={(e) => updateCurrentClient(idx, "name", e.target.value)}
                    placeholder={`Client ${idx + 1} name`}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <input
                    type="text"
                    value={client.website}
                    onChange={(e) => updateCurrentClient(idx, "website", e.target.value)}
                    placeholder="Website URL"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  {currentClients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCurrentClient(idx)}
                      className="px-2 py-1 text-red-600 hover:text-red-800"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
