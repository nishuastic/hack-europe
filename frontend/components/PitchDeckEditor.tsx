"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Slide {
  slide_number: number;
  title: string;
  body_html: string;
  speaker_notes: string;
}

interface PitchDeckEditorProps {
  leadId: number;
  productId?: number;
  onBack: () => void;
}

export default function PitchDeckEditor({
  leadId,
  productId,
  onBack,
}: PitchDeckEditorProps) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const deck = await api.getPitchDeck(leadId, productId);
        if (!cancelled && deck?.slides?.length) {
          setSlides(deck.slides);
        }
      } catch {
        // No existing deck — that's fine, slides stay empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [leadId, productId]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.downloadPitchDeck(leadId, productId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pitch-deck-${leadId}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleGenerate = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.generatePitchDeck(leadId, productId);
      if (result?.slides?.length) {
        setSlides(result.slides);
        setActiveSlide(0);
      }
    } catch (err) {
      console.error("Generation failed:", err);
      setError("Failed to generate pitch deck. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const current = slides[activeSlide];

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="size-8 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-md flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              arrow_back
            </span>
          </button>
          <div className="flex flex-col">
            <nav className="flex items-center gap-2 text-sm">
              <span className="text-slate-900 font-semibold tracking-tight">
                Pitch Deck
              </span>
              <span className="text-slate-400 text-xs px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                {slides.length > 0 ? `${slides.length} slides` : "Draft"}
              </span>
            </nav>
            <span className="text-xs text-slate-500">Lead #{leadId}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {slides.length === 0 && !loading && (
            <button
              onClick={handleGenerate}
              disabled={!productId}
              className="flex items-center justify-center gap-2 h-8 px-3 bg-blue-600 text-white text-sm font-medium rounded-md transition-colors shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
              <span className="hidden sm:inline">Generate</span>
            </button>
          )}
          {slides.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center justify-center gap-2 h-8 px-3 bg-slate-900 text-white text-sm font-medium rounded-md transition-colors shadow-sm hover:bg-slate-800 disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[18px] ${exporting ? "animate-spin" : ""}`}
              >
                {exporting ? "progress_activity" : "download"}
              </span>
              <span className="hidden sm:inline">
                {exporting ? "Exporting..." : "Export"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="h-10 border-b border-slate-200 bg-white px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              {slides.length > 0 && (
                <>
                  <span className="text-xs font-medium text-slate-500">
                    Slide {activeSlide + 1} of {slides.length}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 custom-scrollbar bg-slate-50/50">
            {loading ? (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <span className="material-symbols-outlined text-5xl animate-spin">progress_activity</span>
                <span className="text-sm font-medium">Loading pitch deck...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-4 text-red-500">
                <span className="material-symbols-outlined text-5xl">error</span>
                <span className="text-sm font-medium">{error}</span>
                <button
                  onClick={handleGenerate}
                  className="mt-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-800"
                >
                  Retry
                </button>
              </div>
            ) : !current ? (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <span className="material-symbols-outlined text-5xl">slideshow</span>
                <span className="text-sm font-medium">No pitch deck generated yet</span>
                {productId && (
                  <button
                    onClick={handleGenerate}
                    className="mt-2 px-4 py-2 bg-slate-900 text-white text-sm rounded-md hover:bg-slate-800 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Pitch Deck
                  </button>
                )}
              </div>
            ) : (
              <div className="aspect-slide w-full max-w-[960px] bg-white shadow-xl rounded-sm ring-1 ring-slate-900/5 flex flex-col relative transition-transform duration-300">
                <div className="flex-1 p-16 flex flex-col gap-6 overflow-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
                      Slide {current.slide_number}
                    </span>
                  </div>
                  <h1 className="text-4xl font-semibold text-slate-900 tracking-tight leading-tight">
                    {current.title}
                  </h1>
                  <div
                    className="text-slate-600 text-lg leading-relaxed font-light prose prose-slate max-w-none
                      [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2
                      [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2
                      [&_li]:text-base
                      [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-4 [&_h3]:mb-2
                      [&_p]:mb-3
                      [&_strong]:text-slate-900 [&_strong]:font-medium"
                    dangerouslySetInnerHTML={{ __html: current.body_html }}
                  />
                  <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-end text-xs text-slate-300">
                    <span>Confidential</span>
                    <span>{String(current.slide_number).padStart(2, "0")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {slides.length > 0 && (
            <div className="h-44 bg-white border-t border-slate-200 shrink-0 flex flex-col z-10">
              <div className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Slide Navigation
              </div>
              <div className="flex-1 overflow-x-auto flex items-center px-5 gap-5 custom-scrollbar pb-3">
                {slides.map((slide, idx) => (
                  <div
                    key={slide.slide_number}
                    onClick={() => setActiveSlide(idx)}
                    className="flex-shrink-0 flex flex-col gap-2 group cursor-pointer w-44"
                  >
                    <div
                      className={`aspect-slide bg-white rounded-md overflow-hidden relative transition-all ${
                        activeSlide === idx
                          ? "border-2 border-slate-900 shadow-sm"
                          : "border border-slate-200 group-hover:border-slate-400"
                      }`}
                    >
                      <div className="p-3 scale-[0.25] origin-top-left w-[400%] h-[400%] absolute top-0 left-0 pointer-events-none">
                        <h1 className="text-5xl font-bold text-slate-900">
                          {slide.title}
                        </h1>
                      </div>
                      {activeSlide === idx && (
                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-900" />
                      )}
                    </div>
                    <span
                      className={`text-center text-[10px] font-medium truncate ${activeSlide === idx ? "text-slate-900 font-bold" : "text-slate-500"}`}
                    >
                      {slide.slide_number}. {slide.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel — Speaker Notes */}
        <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col shrink-0 z-20 h-full">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-medium text-sm text-slate-900">
              Presenter Tools
            </h3>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            {/* Speaker notes */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">
                    speaker_notes
                  </span>
                  Speaker Notes
                </label>
              </div>
              <div className="relative flex-1 flex flex-col">
                <textarea
                  className="flex-1 w-full resize-none bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-600 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-shadow custom-scrollbar leading-relaxed font-light"
                  placeholder="No speaker notes for this slide."
                  value={current?.speaker_notes || ""}
                  readOnly
                />
              </div>
            </div>

            {/* Log interaction */}
            <div className="p-5 border-t border-slate-200 bg-white">
              <h4 className="text-xs font-semibold text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                Log Interaction
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                    Outcome
                  </label>
                  <div className="relative">
                    <select className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-md pl-3 pr-10 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-shadow cursor-pointer">
                      <option>Meeting Booked</option>
                      <option>Interested (Follow-up)</option>
                      <option>Not Interested</option>
                      <option>Rescheduled</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                      <span className="material-symbols-outlined text-lg">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1.5 font-medium">
                    Follow-up Priority
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button className="py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors bg-white">
                      Low
                    </button>
                    <button className="py-1.5 border border-slate-900 bg-slate-900 text-white rounded-md text-xs font-medium transition-colors shadow-sm">
                      Medium
                    </button>
                    <button className="py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-red-500 hover:text-red-600 transition-colors bg-white">
                      High
                    </button>
                  </div>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-medium py-2 px-4 rounded-md shadow-sm transition-all active:scale-[0.98] text-sm mt-2">
                  <span className="material-symbols-outlined text-[18px]">
                    save_as
                  </span>
                  Save Outcome
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
