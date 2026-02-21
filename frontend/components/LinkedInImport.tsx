"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, LinkedInMatch, WSMessage } from "@/lib/api";

type Phase = "upload" | "processing" | "results";

interface ProgressState {
  totalConnections: number;
  totalLeads: number;
  matchesFound: number;
  outreachGenerated: number;
  events: string[];
}

export default function LinkedInImport() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState<ProgressState>({
    totalConnections: 0,
    totalLeads: 0,
    matchesFound: 0,
    outreachGenerated: 0,
    events: [],
  });
  const [matches, setMatches] = useState<LinkedInMatch[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addEvent = useCallback((text: string) => {
    setProgress((prev) => ({
      ...prev,
      events: [...prev.events.slice(-19), text],
    }));
  }, []);

  // WebSocket listener
  useEffect(() => {
    const unsub = api.onMessage((msg: WSMessage) => {
      if (msg.type === "linkedin_import_start") {
        setProgress((prev) => ({
          ...prev,
          totalConnections: msg.total_connections,
          totalLeads: msg.total_leads,
        }));
        addEvent(
          `Processing ${msg.total_connections} connections against ${msg.total_leads} leads...`
        );
      } else if (msg.type === "linkedin_match_found") {
        setProgress((prev) => ({
          ...prev,
          matchesFound: prev.matchesFound + 1,
        }));
        addEvent(
          `Match: ${msg.connection_name} → ${msg.company_name} (${msg.confidence})`
        );
      } else if (msg.type === "linkedin_outreach_generated") {
        setProgress((prev) => ({
          ...prev,
          outreachGenerated: prev.outreachGenerated + 1,
        }));
        addEvent(
          `Outreach ready: ${msg.connection_name} → ${msg.company_name}`
        );
      } else if (msg.type === "linkedin_import_complete") {
        addEvent(
          `Done! ${msg.total_matches} matches, ${msg.total_outreach_plans} outreach plans`
        );
        // Load results
        api.getLinkedInMatches().then(setMatches);
        setPhase("results");
      } else if (msg.type === "linkedin_import_error") {
        setError(msg.error);
        setPhase("upload");
      }
    });
    return unsub;
  }, [addEvent]);

  // Check for existing data on mount
  useEffect(() => {
    api.getLinkedInMatches().then((m) => {
      if (m.length > 0) {
        setMatches(m);
        setPhase("results");
      }
    });
  }, []);

  const handleUpload = async (file: File) => {
    setError(null);
    setLoading(true);
    setProgress({
      totalConnections: 0,
      totalLeads: 0,
      matchesFound: 0,
      outreachGenerated: 0,
      events: [],
    });
    try {
      await api.uploadLinkedInArchive(file);
      setPhase("processing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    setProgress({
      totalConnections: 0,
      totalLeads: 0,
      matchesFound: 0,
      outreachGenerated: 0,
      events: [],
    });
    try {
      await api.importLinkedInDemo();
      setPhase("processing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Demo import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    await api.clearLinkedInConnections();
    setMatches([]);
    setPhase("upload");
    setProgress({
      totalConnections: 0,
      totalLeads: 0,
      matchesFound: 0,
      outreachGenerated: 0,
      events: [],
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // ─── Upload Phase ──────────────────────────────────────────────────
  if (phase === "upload") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            LinkedIn Network Import
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload your LinkedIn data export to find warm introductions to your
            prospects.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-3 block">
            cloud_upload
          </span>
          <p className="text-sm font-medium text-slate-700">
            Drop your LinkedIn export here
          </p>
          <p className="text-xs text-slate-400 mt-1">
            ZIP or CSV file from LinkedIn data export
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={handleDemo}
          disabled={loading}
          className="mt-4 w-full py-2.5 px-4 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {loading ? "Loading..." : "Use Demo Data (20 connections)"}
        </button>

        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-2">
            How to export your LinkedIn data:
          </p>
          <ol className="text-xs text-slate-500 space-y-1 list-decimal list-inside">
            <li>Go to LinkedIn Settings &amp; Privacy</li>
            <li>Select &quot;Get a copy of your data&quot;</li>
            <li>Choose &quot;Connections&quot; and request archive</li>
            <li>Upload the ZIP file here when ready</li>
          </ol>
        </div>
      </div>
    );
  }

  // ─── Processing Phase ──────────────────────────────────────────────
  if (phase === "processing") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">
            Processing Import...
          </h2>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {progress.totalConnections}
              </p>
              <p className="text-xs text-slate-500">Connections</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {progress.matchesFound}
              </p>
              <p className="text-xs text-slate-500">Matches Found</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {progress.outreachGenerated}
              </p>
              <p className="text-xs text-slate-500">Outreach Plans</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-4">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${
                  progress.totalConnections
                    ? Math.min(
                        100,
                        ((progress.matchesFound + progress.outreachGenerated) /
                          Math.max(1, progress.totalConnections)) *
                          100
                      )
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Event log */}
          <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            {progress.events.map((event, i) => (
              <p key={i} className="text-xs text-slate-600 py-0.5 font-mono">
                {event}
              </p>
            ))}
            {progress.events.length === 0 && (
              <p className="text-xs text-slate-400 animate-pulse">
                Starting import...
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Results Phase ─────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Warm Introductions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {matches.length} connection{matches.length !== 1 ? "s" : ""} matched
            to your leads
          </p>
        </div>
        <button
          onClick={handleClear}
          className="text-sm text-slate-500 hover:text-red-600 transition-colors"
        >
          Clear All
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">
            person_search
          </span>
          <p className="text-sm text-slate-500">
            No matches found. Try importing more connections or adding more
            leads.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              {/* Match row */}
              <button
                onClick={() =>
                  setExpandedId(expandedId === match.id ? null : match.id)
                }
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
              >
                <div className="size-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center border border-white shadow-sm text-sm font-bold text-slate-600 shrink-0">
                  {match.connection_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {match.connection_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {match.connection_position} at {match.connection_company}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-slate-700">
                    → {match.lead_company_name}
                  </p>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      match.match_confidence === "exact"
                        ? "bg-green-100 text-green-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {match.match_confidence}
                  </span>
                </div>
                <span className="material-symbols-outlined text-slate-400 text-lg shrink-0">
                  {expandedId === match.id ? "expand_less" : "expand_more"}
                </span>
              </button>

              {/* Expanded outreach plan */}
              {expandedId === match.id && match.outreach_plan && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                  <div className="space-y-4">
                    {/* Intro message */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Intro Message
                        </p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              match.outreach_plan!.intro_message
                            )
                          }
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">
                            content_copy
                          </span>
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">
                        {match.outreach_plan.intro_message}
                      </p>
                    </div>

                    {/* Talking points */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Talking Points
                      </p>
                      <ul className="space-y-1">
                        {match.outreach_plan.talking_points.map((point, i) => (
                          <li
                            key={i}
                            className="text-sm text-slate-600 flex items-start gap-2"
                          >
                            <span className="text-blue-500 mt-0.5">•</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Context */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Context
                      </p>
                      <p className="text-sm text-slate-600">
                        {match.outreach_plan.context}
                      </p>
                    </div>

                    {/* Timing */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Timing
                      </p>
                      <p className="text-sm text-slate-600">
                        {match.outreach_plan.timing_suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status indicators for pending/generating */}
              {expandedId === match.id && !match.outreach_plan && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 text-center">
                  {match.status === "generating" ? (
                    <p className="text-sm text-slate-500 animate-pulse">
                      Generating outreach plan...
                    </p>
                  ) : match.status === "failed" ? (
                    <p className="text-sm text-red-500">
                      Failed to generate outreach plan
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Outreach plan pending
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
