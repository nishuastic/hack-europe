'use client';

import { useState, useEffect } from 'react';
import { api, Lead } from '@/lib/api';

interface LeadDetailProps {
  leadId: number;
  onBack: () => void;
  onOpenPitchEditor: (productId?: number) => void;
}

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
  const [enriching, setEnriching] = useState(false);
  const [generatingDeck, setGeneratingDeck] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailContent, setEmailContent] = useState<{
    subject: string;
    body: string;
    contact_name: string;
    contact_role: string;
  } | null>(null);
  const [emailVersions, setEmailVersions] = useState<
    { id: number; subject: string; body: string; contact_name: string; contact_role: string; created_at: string }[]
  >([]);
  const [versionIndex, setVersionIndex] = useState(0);

  useEffect(() => {
    api.getLead(leadId)
      .then(setLead)
      .catch((err) => {
        console.error("Failed to load lead:", err);
      });
  }, [leadId]);

  // Load existing email versions on mount
  useEffect(() => {
    (async () => {
      try {
        const matches = await api.getMatches(leadId);
        if (matches.length === 0) return;
        const productId = matches[0].product_id;
        const versions = await api.listEmails(leadId, productId);
        if (versions.length > 0) {
          setEmailVersions(versions);
          setVersionIndex(0);
          setEmailContent(versions[0]);
        }
      } catch {
        // no versions yet — that's fine
      }
    })();
  }, [leadId]);

  const handleReEnrich = async () => {
    setEnriching(true);
    try {
      await api.triggerEnrichment(leadId);
      // Poll for updated lead
      const interval = setInterval(async () => {
        try {
          const updated = await api.getLead(leadId);
          setLead(updated);
          if (
            updated.enrichment_status === "complete" ||
            updated.enrichment_status === "failed"
          ) {
            clearInterval(interval);
            setEnriching(false);
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
      setTimeout(() => {
        clearInterval(interval);
        setEnriching(false);
      }, 120000);
    } catch (err) {
      console.error("Re-enrich failed:", err);
      setEnriching(false);
    }
  };

  const handleGenerateDeck = async () => {
    setGeneratingDeck(true);
    try {
      const matches = await api.getMatches(leadId);
      const productId = matches.length > 0 ? matches[0].product_id : undefined;
      if (!productId) {
        console.error("No matched product found for pitch deck generation");
        return;
      }
      await api.generatePitchDeck(leadId, productId);
      const updated = await api.getLead(leadId);
      setLead(updated);
    } catch (err) {
      console.error("Pitch deck generation failed:", err);
    } finally {
      setGeneratingDeck(false);
    }
  };

  const handleGenerateEmail = async () => {
    setGeneratingEmail(true);
    try {
      const matches = await api.getMatches(leadId);
      const productId = matches.length > 0 ? matches[0].product_id : 1;
      const result = await api.generateEmail(leadId, productId);
      setEmailContent(result);
      setEmailVersions((prev) => [{ ...result, id: Date.now(), created_at: new Date().toISOString() }, ...prev]);
      setVersionIndex(0);
      const updated = await api.getLead(leadId);
      setLead(updated);
    } catch (err) {
      console.error("Email generation failed:", err);
    } finally {
      setGeneratingEmail(false);
    }
  };

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
      <section className="bg-white border-b border-slate-200/60 px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <button onClick={onBack} className="mt-1 p-2 text-slate-400 hover:text-slate-900 transition-colors rounded hover:bg-slate-100">
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
              onClick={async () => {
                try {
                  const matches = await api.getMatches(leadId);
                  const productId = matches.length > 0 ? matches[0].product_id : undefined;
                  onOpenPitchEditor(productId);
                } catch {
                  onOpenPitchEditor();
                }
              }}
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
        <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">

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

           {/* Email */}
          <div className="space-y-4 pb-8">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="material-symbols-outlined text-base">mail</span> Generated Email
              </label>
              <div className="flex items-center gap-3">
                {emailVersions.length > 1 && (
                  <div className="flex items-center gap-1.5 mr-2">
                    <button
                      onClick={() => {
                        const next = Math.min(versionIndex + 1, emailVersions.length - 1);
                        setVersionIndex(next);
                        setEmailContent(emailVersions[next]);
                      }}
                      disabled={versionIndex >= emailVersions.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      v{emailVersions.length - versionIndex} of {emailVersions.length}
                    </span>
                    <button
                      onClick={() => {
                        const next = Math.max(versionIndex - 1, 0);
                        setVersionIndex(next);
                        setEmailContent(emailVersions[next]);
                      }}
                      disabled={versionIndex <= 0}
                      className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                )}
                <button
                  onClick={handleGenerateEmail}
                  disabled={generatingEmail}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
                >
                  GENERATE
                </button>
                {emailContent && (
                  <button
                    onClick={() => navigator.clipboard.writeText(`Subject: ${emailContent.subject}\n\n${emailContent.body}`)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 hover:text-slate-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span> COPY
                  </button>
                )}
              </div>
            </div>

            {emailContent ? (
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 space-y-1.5">
                  {emailContent.contact_name && emailContent.contact_name !== "there" && (
                    <div className="flex gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-12">To:</span>
                      <span className="text-xs font-medium">
                        {emailContent.contact_name}
                        {emailContent.contact_role && emailContent.contact_role !== "Decision Maker" && (
                          <span className="text-slate-400 ml-1">({emailContent.contact_role})</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase w-12">Subject:</span>
                    <span className="text-xs font-medium">{emailContent.subject}</span>
                  </div>
                </div>
                <div className="p-6 text-sm text-slate-700 leading-relaxed font-light space-y-4">
                  {emailContent.body.split("\n\n").map((para, i) => <p key={i}>{para}</p>)}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg flex items-center justify-center min-h-[160px] text-slate-400 text-sm">
                {generatingEmail ? (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    Generating email...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">mail</span>
                    Click Generate to create a personalised email
                  </span>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}