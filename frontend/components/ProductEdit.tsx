"use client";

import { useState } from "react";
import { api } from "@/lib/api";

interface ProductEditProps {
  productId?: number;
  onBack: () => void;
}

export default function ProductEdit({ productId, onBack }: ProductEditProps) {
  const isNew = !productId;
  const [name, setName] = useState(isNew ? "" : "ChurnPredict");
  const [description, setDescription] = useState(
    isNew
      ? ""
      : "An AI-powered analytics dashboard that predicts which customers are likely to cancel their subscription in the next 30 days.",
  );
  const [features, setFeatures] = useState(
    isNew ? [""] : ["Real-time usage tracking", "Automated email triggers", ""],
  );
  const [differentiator, setDifferentiator] = useState(
    isNew
      ? ""
      : "Unlike traditional analytics that just show historical data, ChurnPredict uses predictive modeling to flag at-risk accounts before they leave, with 94% accuracy.",
  );

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

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cleanFeatures = features.filter((f) => f.trim());
      if (isNew) {
        await api.createProduct({
          name,
          description,
          features: cleanFeatures,
          differentiator,
        });
      } else {
        await api.updateProduct(productId!, {
          name,
          description,
          features: cleanFeatures,
          differentiator,
        });
      }
      onBack();
    } catch (e) {
      console.error("Failed to save product:", e);
    } finally {
      setSaving(false);
    }
  };

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
            <div className="mb-8">  {/* Added margin-bottom for spacing below the grey box */}
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
        </div>
      </div>
    </div>
  );
}
