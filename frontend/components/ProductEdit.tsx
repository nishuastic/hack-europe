"use client";

import { useState, useEffect } from "react";
import { api, ICPProfile } from "@/lib/api";

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
  
  const [icpProfile, setIcpProfile] = useState<ICPProfile | null>(null);
  const [icpLoading, setIcpLoading] = useState(false);
  const [icpLearning, setIcpLearning] = useState(false);

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

    api.getICPProfile(productId).then((res) => {
      if ("status" in res && res.status === "no_icp") return;
      setIcpProfile(res as ICPProfile);
    });
  }, [productId]);

  const handleLearnICP = async () => {
    if (!productId) return;
    setIcpLearning(true);
    try {
      await api.learnICP(productId);
      const res = await api.getICPProfile(productId);
      if ("status" in res && res.status === "no_icp") return;
      setIcpProfile(res as ICPProfile);
    } catch (err) {
      console.error("Failed to learn ICP:", err);
    } finally {
      setIcpLearning(false);
    }
  };

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
        company_name: companyName || undefined,
        website: website || undefined,
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

          {/* Seller Info */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Seller Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Company Name</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400 text-sm"
                  placeholder="Your company name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Website</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400 text-sm"
                  placeholder="https://yourcompany.com"
                />
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

          {/* ICP Profile */}
          <div className="border-t border-slate-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">AI-Generated ICP</h3>
              {!isNew && (
                <button
                  onClick={handleLearnICP}
                  disabled={icpLearning}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-medium hover:bg-slate-700 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {icpLearning ? "progress_activity" : "auto_awesome"}
                  </span>
                  {icpLearning ? "Learning..." : icpProfile ? "Regenerate ICP" : "Generate ICP"}
                </button>
              )}
            </div>
            
            {icpProfile ? (
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                {icpProfile.icp_summary && (
                  <div className="mb-4">
                    <p className="text-sm text-slate-700 leading-relaxed">{icpProfile.icp_summary}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {icpProfile.target_industries?.length ? (
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">business</span>
                        Target Industries
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {icpProfile.target_industries.map((ind, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  
                  {icpProfile.geographies?.length ? (
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">public</span>
                        Geographies
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {icpProfile.geographies.map((geo, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                            {geo}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  
                  {icpProfile.funding_stages?.length ? (
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        Funding Stages
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {icpProfile.funding_stages.map((stage, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                            {stage}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  
                  {icpProfile.revenue_range ? (
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">attach_money</span>
                        Revenue Range
                      </div>
                      <p className="text-sm text-slate-700">{icpProfile.revenue_range}</p>
                    </div>
                  ) : null}
                  
                  {(icpProfile.employee_range_min || icpProfile.employee_range_max) ? (
                    <div className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                        <span className="material-symbols-outlined text-[14px]">groups</span>
                        Company Size
                      </div>
                      <p className="text-sm text-slate-700">
                        {icpProfile.employee_range_min}-{icpProfile.employee_range_max} employees
                      </p>
                    </div>
                  ) : null}
                </div>
                
                {icpProfile.common_traits?.length ? (
                  <div className="mt-4 bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1.5">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      Common Traits
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {icpProfile.common_traits.map((trait, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                          {trait}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                
                {icpProfile.anti_patterns?.length ? (
                  <div className="mt-4 bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1.5">
                      <span className="material-symbols-outlined text-[14px]">block</span>
                      Anti-Patterns
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {icpProfile.anti_patterns.map((pattern, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                
                <div className="mt-4 text-xs text-slate-500">
                  Based on {icpProfile.customers_researched} companies researched
                </div>
              </div>
            ) : !isNew ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-xl">psychology</span>
                </div>
                <p className="text-sm text-slate-600 mb-1">No ICP generated yet</p>
                <p className="text-xs text-slate-400">
                  Generate an AI-powered ICP based on your product and current clients
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
