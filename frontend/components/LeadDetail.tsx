'use client';

import { useState, useEffect } from 'react';
import { api, Lead } from '@/lib/api';

interface LeadDetailProps {
  leadId: number;
  onBack: () => void;
  onOpenPitchEditor: () => void;
}

const DEMO_LEAD: Lead = {
  id: 1,
  company_name: 'Acme Global Tech',
  company_url: 'acmeglobal.com',
  description: 'Leading provider of scalable cloud architecture for Fortune 500 companies. Recently expanded into Southeast Asia markets.',
  funding: '$142M (Series C)',
  industry: 'Cloud Infrastructure',
  revenue: '$50M - $100M',
  employees: 850,
  contacts: [
    { name: 'Sarah Jenkins', role: 'VP of Growth' },
    { name: 'David Chen', role: 'Director of IT' },
  ],
  buying_signals: [
    { signal_type: 'recent_funding', description: 'Recent Funding Round', strength: 'strong' },
    { signal_type: 'new_hire', description: 'New CMO Hired', strength: 'moderate' },
    { signal_type: 'ad_spend', description: 'Increased Ad Spend', strength: 'weak' },
  ],
  enrichment_status: 'complete',
  best_match_score: 9.2,
  pitch_deck_generated: true,
  email_generated: true,
} as Lead;

function signalBadge(strength: string) {
  if (strength === 'strong') return 'bg-green-50 text-green-600 border border-green-200';
  if (strength === 'moderate') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-500';
}

function signalLabel(strength: string) {
  if (strength === 'strong') return 'STRONG';
  if (strength === 'moderate') return 'MEDIUM';
  return 'LOW';
}

function signalIcon(type: string) {
  if (type === 'recent_funding') return 'payments';
  if (type === 'new_hire') return 'person_add';
  if (type === 'ad_spend') return 'campaign';
  return 'trending_up';
}

export default function LeadDetail({ leadId, onBack, onOpenPitchEditor }: LeadDetailProps) {
  const [lead, setLead] = useState<Lead | null>(null);

  useEffect(() => {
    api.getLead(leadId)
      .then(setLead)
      .catch(() => setLead({ ...DEMO_LEAD, id: leadId }));
  }, [leadId]);

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Company header bar */}
      <section className="bg-white border-b border-slate-200/60 px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <button onClick={onBack} className="mt-1 p-1 text-slate-400 hover:text-slate-900 transition-colors rounded hover:bg-slate-100">
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="size-16 bg-slate-50 border border-slate-100 rounded flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-3xl text-slate-400">business</span>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lead.company_name}</h1>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">Enterprise</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">domain</span>{lead.industry || 'N/A'}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">location_on</span>San Francisco, CA
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Match Score</span>
                <span className="text-lg font-bold text-slate-900">
                  {lead.best_match_score?.toFixed(1) || '-'}<span className="text-slate-400 text-xs">/10</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[240px] text-right leading-relaxed">
                High overlap with your current expansion in SaaS fintech sectors and recent Q3 headcount growth.
              </p>
            </div>
            <div className="h-12 w-px bg-slate-100" />
            <button className="bg-slate-900 text-white px-5 py-2 rounded text-sm font-semibold shadow-sm hover:bg-slate-800 transition-colors">
              Launch Campaign
            </button>
          </div>
        </div>
      </section>

      {/* Two-column content */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left: Research */}
        <aside className="w-[420px] border-r border-slate-200/60 overflow-y-auto custom-scrollbar p-8 space-y-8">
          {/* Enrichment */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span> Company Enrichment
            </h3>
            <div className="bg-white border border-slate-200 rounded p-5 space-y-5">
              <p className="text-sm text-slate-600 leading-relaxed font-light">{lead.description}</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Funding', lead.funding || 'N/A'],
                  ['Revenue', lead.revenue || 'N/A'],
                  ['Employees', lead.employees ? `${lead.employees}+` : 'N/A'],
                  ['Tech Stack', 'AWS, Snowflake'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{label}</span>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Buying Signals */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">sensors</span> Buying Signals
            </h3>
            <div className="space-y-3">
              {(lead.buying_signals || []).map((sig, i) => (
                <div key={i} className={`bg-white border border-slate-200 rounded px-4 py-3 flex items-center justify-between ${sig.strength === 'weak' ? 'opacity-75' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400">{signalIcon(sig.signal_type)}</span>
                    <span className="text-sm font-medium">{sig.description}</span>
                  </div>
                  <span className={`px-2 py-0.5 ${signalBadge(sig.strength)} text-[10px] font-bold rounded`}>
                    {signalLabel(sig.strength)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Contacts */}
          <section>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">groups</span> Key Contacts
              </span>
              <span className="text-[10px] normal-case font-normal">{(lead.contacts || []).length} Identified</span>
            </h3>
            <div className="space-y-2">
              {(lead.contacts || []).map((c, i) => (
                <div key={i} className="group flex items-center justify-between p-3 bg-white border border-slate-200 rounded hover:border-slate-400 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="size-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                      <span className="material-symbols-outlined text-[18px]">person</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-slate-400 hover:text-accent"><span className="material-symbols-outlined text-[18px]">alternate_email</span></button>
                    <button className="p-1.5 text-slate-400 hover:text-blue-600"><span className="material-symbols-outlined text-[18px]">open_in_new</span></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        {/* Right: Pitch Assets */}
        <section className="flex-1 bg-white overflow-y-auto custom-scrollbar p-8 space-y-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold tracking-tight">Pitch Assets</h2>
            <span className="text-xs text-slate-400 font-medium">Generated 4m ago</span>
          </div>

          {/* Deck preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-base">slideshow</span> Pitch Deck Preview
              </label>
              <button onClick={onOpenPitchEditor} className="text-xs font-semibold text-slate-900 hover:underline">Edit Slides</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div onClick={onOpenPitchEditor} className="aspect-slide bg-slate-100 rounded border border-slate-200 overflow-hidden relative group cursor-pointer shadow-sm">
                <div className="p-4 scale-[0.4] origin-top-left w-[250%] h-[250%] flex flex-col justify-between">
                  <h4 className="text-4xl font-bold">Scaling for Growth</h4>
                  <div className="h-2 w-1/2 bg-slate-300" />
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </div>
              <div className="aspect-slide bg-slate-100 rounded border border-slate-200 overflow-hidden relative group cursor-pointer shadow-sm">
                <div className="p-4 scale-[0.4] origin-top-left w-[250%] h-[250%]">
                  <h4 className="text-3xl font-bold mb-4">The Solution</h4>
                  <div className="space-y-2">
                    <div className="h-1 w-full bg-slate-300" />
                    <div className="h-1 w-full bg-slate-300" />
                    <div className="h-1 w-3/4 bg-slate-300" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </div>
              <div className="aspect-slide bg-slate-100 rounded border border-dashed border-slate-300 flex items-center justify-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">+ 6 More</span>
              </div>
            </div>
          </div>

          {/* Voice briefing */}
          <div className="space-y-4">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-base">mic</span> AI Voice Briefing
            </label>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <div className="flex items-center gap-5">
                <button className="size-12 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-3xl">play_arrow</span>
                </button>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-xs font-semibold">{lead.company_name.replace(/\s+/g, '_')}_Briefing_v1.mp3</span>
                    <span className="text-[10px] text-slate-400 font-mono">01:42 / 03:15</span>
                  </div>
                  <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-900 w-[42%]" />
                  </div>
                </div>
              </div>
              <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold">SPEAKER:</span>
                  <span className="text-xs font-medium">Professional Male (Neural)</span>
                </div>
                <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-900 transition-colors">
                  VIEW SCRIPT <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>
              </div>
            </div>
          </div>

          {/* Email */}
          <div className="space-y-4 pb-8">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-base">mail</span> Generated Email
              </label>
              <button className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 hover:text-slate-600 transition-colors">
                <span className="material-symbols-outlined text-[16px]">content_copy</span> COPY TO CLIPBOARD
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-[300px]">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex gap-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-12">Subject:</span>
                  <span className="text-xs font-medium">Accelerating {lead.company_name}&apos;s Q4 Growth</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-12">To:</span>
                  <span className="text-xs font-medium text-slate-500">
                    {lead.contacts?.[0]
                      ? `${lead.contacts[0].name.toLowerCase().replace(' ', '.')}@${lead.company_url || 'company.com'}`
                      : 'contact@company.com'}
                  </span>
                </div>
              </div>
              <div className="flex-1 p-6 text-sm text-slate-700 leading-relaxed font-light space-y-4">
                <p>Hi {lead.contacts?.[0]?.name?.split(' ')[0] || 'there'},</p>
                <p>I noticed {lead.company_name}&apos;s recent {lead.funding ? 'funding round' : 'growth'} and the focus on scaling your {lead.industry?.toLowerCase() || 'operations'}. Huge milestone for the team.</p>
                <p>Given your goal of optimizing operational efficiency by 30%, I thought you&apos;d find our latest benchmark study on Enterprise automation relevant. We&apos;ve helped similar growth-stage teams reduce manual overhead by centralizing their reporting stack.</p>
                <p>Would you be open to a 15-minute chat next Tuesday to see if we can support your Q4 goals?</p>
                <p>Best,<br />Alex</p>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
                <button className="text-xs font-semibold text-slate-400 hover:text-slate-600">Rewrite</button>
                <button className="text-xs font-semibold text-slate-900">Customize</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
