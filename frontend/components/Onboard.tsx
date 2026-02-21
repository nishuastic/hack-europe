'use client';

import { useState } from 'react';

export default function Onboard() {
  const [companyName, setCompanyName] = useState('Acme Analytics');
  const [website, setWebsite] = useState('acmeanalytics.io');
  const [stage, setStage] = useState('Series A');
  const [geography, setGeography] = useState('San Francisco, CA');
  const [valueProp, setValueProp] = useState(
    'We help SaaS companies reduce churn by analyzing user behavior patterns and triggering automated re-engagement workflows.'
  );

  const stages = ['Pre-Seed', 'Seed', 'Series A', 'Series B+', 'Public'];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Company &amp; Product Setup</h1>
          <p className="text-slate-500 text-sm md:text-base max-w-2xl leading-relaxed">
            Define your company profile and product details to train our AI for personalized outreach.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check</span> Save Changes
          </button>
        </div>
      </div>

      {/* Company Profile */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px] text-black">business</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800">Company Profile</h2>
        </div>
        <div className="clay-card rounded-2xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name</label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="e.g. Stick"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Website URL</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-sm">https://</span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-r-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="www.example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Growth Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              >
                {stages.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Geography / HQ</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">location_on</span>
                <input
                  value={geography}
                  onChange={(e) => setGeography(e.target.value)}
                  className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="City, Country"
                />
              </div>
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Value Proposition</label>
              <textarea
                value={valueProp}
                onChange={(e) => setValueProp(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="Briefly describe what your company does..."
                rows={3}
              />
              <p className="mt-1.5 text-xs text-slate-500">This helps our AI understand your core offering.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
