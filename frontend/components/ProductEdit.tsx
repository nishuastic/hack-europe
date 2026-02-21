'use client';

import { useState } from 'react';

interface ProductEditProps {
  productId?: number;
  onBack: () => void;
}

export default function ProductEdit({ productId, onBack }: ProductEditProps) {
  const isNew = !productId;
  const [name, setName] = useState(isNew ? '' : 'ChurnPredict');
  const [description, setDescription] = useState(
    isNew ? '' : 'An AI-powered analytics dashboard that predicts which customers are likely to cancel their subscription in the next 30 days.'
  );
  const [features, setFeatures] = useState(
    isNew ? [''] : ['Real-time usage tracking', 'Automated email triggers', '']
  );
  const [differentiator, setDifferentiator] = useState(
    isNew ? '' : 'Unlike traditional analytics that just show historical data, ChurnPredict uses predictive modeling to flag at-risk accounts before they leave, with 94% accuracy.'
  );

  const updateFeature = (idx: number, val: string) => {
    const next = [...features];
    next[idx] = val;
    setFeatures(next);
  };

  const addFeatureSlot = () => setFeatures([...features, '']);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 text-slate-400 hover:text-slate-900 transition-colors rounded hover:bg-slate-100">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-1">
              {isNew ? 'Add New Product' : `Edit: ${name}`}
            </h1>
            <p className="text-slate-500 text-sm">
              {isNew ? 'Fill in your product details so our AI can create tailored pitches.' : 'Update your product details below.'}
            </p>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={onBack} className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check</span> {isNew ? 'Create Product' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="clay-card rounded-2xl overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="size-6 rounded bg-purple-100 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
          </div>
          <h2 className="font-bold text-slate-800">Product Details</h2>
          {!isNew && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">Primary</span>
          )}
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Product Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
              placeholder="e.g. ChurnPredict"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Product Description</label>
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
              <label className="block text-sm font-semibold text-slate-700 mb-3">Key Features</label>
              <div className="space-y-2">
                {features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <span className={`material-symbols-outlined mt-2 text-[18px] ${f ? 'text-slate-400' : 'text-slate-300'}`}>
                      {f ? 'check_circle' : 'add_circle'}
                    </span>
                    <input
                      value={f}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && i === features.length - 1 && f) addFeatureSlot();
                      }}
                      className={`w-full rounded-lg border border-slate-200 text-slate-900 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all ${
                        f ? 'bg-white' : 'bg-slate-50 placeholder:text-slate-400'
                      }`}
                      placeholder="Add another feature"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Main Differentiator</label>
              <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 h-full flex flex-col">
                <textarea
                  value={differentiator}
                  onChange={(e) => setDifferentiator(e.target.value)}
                  className="w-full bg-transparent border-none p-0 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 resize-none leading-relaxed flex-grow"
                  placeholder="Why do customers choose this over competitors?"
                  rows={4}
                />
                <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600">
                  <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
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
