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
    { name: 'Sarah Jenkins', role: 'VP of Growth', email: 'sarah.jenkins@acmeglobal.com' },
    { name: 'David Chen', role: 'Director of IT', email: 'david.chen@acmeglobal.com' },
  ],
  customers: ['Stripe', 'Datadog', 'MongoDB'],
  buying_signals: [
    { signal_type: 'recent_funding', description: 'Recent Funding Round', strength: 'strong' },
    { signal_type: 'hiring_surge', description: 'New CMO Hired', strength: 'moderate' },
    { signal_type: 'expansion', description: 'Expanded to Southeast Asia', strength: 'weak' },
  ],
  enrichment_status: 'complete',
  pitch_deck_generated: true,
  email_generated: true,
  voice_generated: true,
};

function signalBadge(strength: string) {
  if (strength === 'strong') return 'bg-green-50 text-green-600 border border-green-200';
  if (strength === 'moderate') return 'bg-amber-50 text-amber-600 border border-amber-200';
  return 'bg-slate-50 text-slate-500 border border-slate-200';
}

function signalLabel(strength: string) {
  if (strength === 'strong') return 'STRONG';
  if (strength === 'moderate') return 'MEDIUM';
  return 'LOW';
}

function signalIcon(type: string) {
  if (type === 'recent_funding') return 'payments';
  if (type === 'hiring_surge') return 'person_add';
  if (type === 'competitor_mentioned') return 'compare_arrows';
  if (type === 'expansion') return 'public';
  if (type === 'pain_indicator') return 'warning';
  if (type === 'tech_stack_match') return 'memory';
  return 'trending_up';
}

function statusBadge(s: string) {
  if (s === 'complete') return 'bg-green-100 text-green-700 border-green-200';
  if (s === 'in_progress') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (s === 'failed') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function statusText(s: string) {
  if (s === 'complete') return 'Enriched';
  if (s === 'in_progress') return 'In Progress';
  if (s === 'failed') return 'Failed';
  return 'Pending';
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
            {lead.company_url ? (
              <img
                src={`https://www.google.com/s2/favicons?domain=${lead.company_url}&sz=64`}
                alt=""
                className="size-16 rounded bg-slate-50 border border-slate-100"
              />
            ) : (
              <div className="size-16 bg-slate-50 border border-slate-100 rounded flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl text-slate-400">business</span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{lead.company_name}</h1>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusBadge(lead.enrichment_status)}`}>
                  {statusText(lead.enrichment_status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                {lead.industry && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">domain</span>{lead.industry}
                  </span>
                )}
                {lead.company_url && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">link</span>{lead.company_url}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lead.enrichment_status !== 'complete' && lead.enrichment_status !== 'in_progress' && (
              <button
                onClick={() => { api.triggerEnrichment(leadId).catch(() => {}); }}
                className="bg-white border border-slate-200 text-slate-700 px-5 py-2 rounded text-sm font-semibold shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Enrich
              </button>
            )}
            <button
              onClick={onOpenPitchEditor}
              className="bg-slate-900 text-white px-5 py-2 rounded text-sm font-semibold shadow-sm hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">slideshow</span>
              Pitch Deck
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto p-8 space-y-8">

          {/* Company Overview */}
          {lead.description && (
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">info</span> Company Overview
              </h3>
              <div className="bg-white border border-slate-200 rounded p-5">
                <p className="text-sm text-slate-600 leading-relaxed">{lead.description}</p>
              </div>
            </section>
          )}

          {/* Key Metrics */}
          {(lead.funding || lead.revenue || lead.employees) && (
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">analytics</span> Key Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {lead.funding && (
                  <div className="bg-white border border-slate-200 rounded p-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Funding</span>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{lead.funding}</p>
                  </div>
                )}
                {lead.revenue && (
                  <div className="bg-white border border-slate-200 rounded p-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Revenue</span>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{lead.revenue}</p>
                  </div>
                )}
                {lead.employees && (
                  <div className="bg-white border border-slate-200 rounded p-4">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Employees</span>
                    <p className="text-sm font-semibold text-slate-900 mt-1">{lead.employees.toLocaleString()}+</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Buying Signals */}
          {lead.buying_signals && lead.buying_signals.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">sensors</span> Buying Signals
              </h3>
              <div className="space-y-3">
                {lead.buying_signals.map((sig, i) => (
                  <div key={i} className={`bg-white border border-slate-200 rounded px-4 py-3 flex items-center justify-between ${sig.strength === 'weak' ? 'opacity-75' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-slate-400">{signalIcon(sig.signal_type)}</span>
                      <div>
                        <span className="text-sm font-medium">{sig.description}</span>
                        <span className="text-xs text-slate-400 ml-2">{sig.signal_type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 ${signalBadge(sig.strength)} text-[10px] font-bold rounded`}>
                      {signalLabel(sig.strength)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Key Contacts */}
          {lead.contacts && lead.contacts.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">groups</span> Key Contacts
                </span>
                <span className="text-[10px] normal-case font-normal">{lead.contacts.length} Identified</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lead.contacts.map((c, i) => (
                  <div key={i} className="group flex items-center justify-between p-3 bg-white border border-slate-200 rounded hover:border-slate-400 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="size-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[18px]">person</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-[11px] text-slate-500">{c.role}</p>
                        {c.email && <p className="text-[11px] text-slate-400">{c.email}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.email && (
                        <a href={`mailto:${c.email}`} className="p-1.5 text-slate-400 hover:text-slate-700" title={c.email}>
                          <span className="material-symbols-outlined text-[18px]">alternate_email</span>
                        </a>
                      )}
                      {c.linkedin && (
                        <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-blue-600">
                          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Known Customers */}
          {lead.customers && lead.customers.length > 0 && (
            <section>
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base">storefront</span> Known Customers
              </h3>
              <div className="flex flex-wrap gap-2">
                {lead.customers.map((customer, i) => (
                  <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded text-sm text-slate-700 font-medium">
                    {customer}
                  </span>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
