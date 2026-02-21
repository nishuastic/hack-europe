'use client';

import { useState } from 'react';

interface PitchDeckEditorProps {
  leadId: number;
  onBack: () => void;
}

const SLIDES = [
  { id: 0, label: '1. Intro', title: 'Title Slide' },
  { id: 1, label: '2. Problem', title: 'The Problem' },
  { id: 2, label: '3. Solution', title: 'Solution' },
  { id: 3, label: '4. Analysis', title: 'Market Data' },
];

export default function PitchDeckEditor({ leadId, onBack }: PitchDeckEditorProps) {
  const [activeSlide, setActiveSlide] = useState(1);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="size-8 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-md flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <nav className="flex items-center gap-2 text-sm">
              <span className="text-slate-900 font-semibold tracking-tight">Q3 Pitch Deck</span>
              <span className="text-slate-400 text-xs px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">Draft</span>
            </nav>
            <span className="text-xs text-slate-500">Enterprise Outreach</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 h-8 px-3 bg-slate-900 text-white text-sm font-medium rounded-md transition-colors shadow-sm hover:bg-slate-800">
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span className="hidden sm:inline">Export</span>
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">share</span>
          </button>
          <button className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-slate-100 text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="h-10 border-b border-slate-200 bg-white px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <button className="text-slate-500 hover:text-slate-900 transition-colors"><span className="material-symbols-outlined text-[20px]">grid_view</span></button>
              <div className="h-3 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Slide {activeSlide + 1} of {SLIDES.length}</span>
              <div className="h-3 w-px bg-slate-200" />
              <button className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>Present
              </button>
            </div>
            <span className="text-xs text-slate-400 font-medium">Saved 2m ago</span>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-8 custom-scrollbar bg-slate-50/50">
            <div className="aspect-slide w-full max-w-[960px] bg-white shadow-xl rounded-sm ring-1 ring-slate-900/5 flex flex-col relative group transition-transform duration-300">
              <div className="flex-1 p-16 flex flex-col gap-8">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-24 h-6 bg-slate-100 rounded-sm" />
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Pitch Deck 2024</span>
                </div>
                <h1 className="text-4xl font-semibold text-slate-900 tracking-tight leading-tight">
                  The Problem:<br />Fragmentation in Data
                </h1>
                <div className="grid grid-cols-2 gap-10 mt-2">
                  <div className="flex flex-col gap-4 text-slate-600 text-lg leading-relaxed font-light">
                    <p>Current market solutions are disjointed, leading to inefficiencies in the sales pipeline.</p>
                    <ul className="list-disc pl-5 space-y-3 mt-2 text-base">
                      <li><strong className="text-slate-900 font-medium">30%</strong> of time wasted on manual entry</li>
                      <li>Missed follow-up opportunities</li>
                      <li>Lack of centralized reporting</li>
                    </ul>
                  </div>
                  <div className="relative bg-slate-50 rounded border border-slate-100 p-6 flex items-center justify-center">
                    <div className="w-full h-32 flex items-end justify-around px-4 pb-2 gap-2">
                      <div className="flex-1 bg-red-400/20 h-[30%] rounded-t-sm" />
                      <div className="flex-1 bg-red-400/40 h-[50%] rounded-t-sm" />
                      <div className="flex-1 bg-red-500 h-[80%] rounded-t-sm" />
                      <div className="flex-1 bg-red-400/30 h-[60%] rounded-t-sm" />
                    </div>
                  </div>
                </div>
                <div className="mt-auto pt-8 border-t border-slate-100 flex justify-between items-end text-xs text-slate-300">
                  <span>Confidential &copy; 2024</span>
                  <span>02</span>
                </div>
              </div>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button className="bg-white text-slate-600 p-2 rounded-full shadow-sm hover:text-black hover:shadow-md transition-all border border-slate-200">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
              </div>
            </div>
          </div>

          {/* Thumbnails */}
          <div className="h-44 bg-white border-t border-slate-200 shrink-0 flex flex-col z-10">
            <div className="px-5 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between items-center">
              <span>Slide Navigation</span>
              <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-900">
                <span className="material-symbols-outlined text-[16px]">keyboard_double_arrow_down</span>
              </button>
            </div>
            <div className="flex-1 overflow-x-auto flex items-center px-5 gap-5 custom-scrollbar pb-3">
              {SLIDES.map((slide) => (
                <div key={slide.id} onClick={() => setActiveSlide(slide.id)} className="flex-shrink-0 flex flex-col gap-2 group cursor-pointer w-44">
                  <div className={`aspect-slide bg-white rounded-md overflow-hidden relative transition-all ${
                    activeSlide === slide.id
                      ? 'border-2 border-slate-900 shadow-sm'
                      : 'border border-slate-200 group-hover:border-slate-400'
                  }`}>
                    <div className="p-3 scale-[0.25] origin-top-left w-[400%] h-[400%] absolute top-0 left-0 pointer-events-none">
                      <h1 className="text-5xl font-bold text-slate-900">{slide.title}</h1>
                      {slide.id === 0 && <div className="mt-6 h-3 w-40 bg-slate-900" />}
                      {slide.id === 1 && (
                        <div className="grid grid-cols-2 gap-6 mt-6">
                          <div className="h-24 bg-slate-200 rounded" />
                          <div className="h-24 bg-slate-200 rounded" />
                        </div>
                      )}
                      {slide.id === 2 && (
                        <div className="mt-6 flex gap-6">
                          <div className="size-20 rounded-full bg-green-50" />
                          <div className="flex-1 space-y-3">
                            <div className="h-5 bg-slate-100 w-3/4" />
                            <div className="h-5 bg-slate-100 w-1/2" />
                          </div>
                        </div>
                      )}
                      {slide.id === 3 && <div className="mt-6 w-full h-40 bg-slate-100 rounded" />}
                    </div>
                    {activeSlide === slide.id && <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-900" />}
                  </div>
                  <span className={`text-center text-[10px] font-medium ${activeSlide === slide.id ? 'text-slate-900 font-bold' : 'text-slate-500'}`}>
                    {slide.label}
                  </span>
                </div>
              ))}
              <button className="flex-shrink-0 w-44 aspect-slide rounded-md border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-all mb-6">
                <span className="material-symbols-outlined text-2xl">add</span>
                <span className="text-xs font-medium">Add Slide</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <aside className="w-[340px] bg-white border-l border-slate-200 flex flex-col shrink-0 z-20 h-full">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-medium text-sm text-slate-900">Presenter Tools</h3>
            <button className="text-slate-400 hover:text-slate-900 transition-colors">
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            {/* Speaker notes */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">speaker_notes</span>Speaker Notes
                </label>
                <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">Saved</span>
              </div>
              <div className="relative group flex-1 flex flex-col">
                <textarea
                  className="flex-1 w-full resize-none bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-600 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-shadow custom-scrollbar leading-relaxed font-light"
                  placeholder="Add your speaker notes here..."
                  defaultValue={`Remember to emphasize the ROI calculator on this slide.\nAsk about their current vendor pain points specifically regarding data entry.\nMention the 30% statistic confidently.`}
                />
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button className="p-1 bg-slate-100 rounded border border-slate-200 text-slate-500 hover:text-black transition-colors">
                    <span className="material-symbols-outlined text-[16px]">format_bold</span>
                  </button>
                  <button className="p-1 bg-slate-100 rounded border border-slate-200 text-slate-500 hover:text-black transition-colors">
                    <span className="material-symbols-outlined text-[16px]">format_list_bulleted</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Timer */}
            <div className="px-5 pb-5">
              <div className="bg-white rounded-md px-4 py-3 flex items-center justify-between border border-slate-200 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Target Time</span>
                  <span className="font-mono text-sm font-semibold text-slate-700">02:30</span>
                </div>
                <div className="h-6 w-px bg-slate-100" />
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Elapsed</span>
                  <span className="font-mono text-sm font-semibold text-slate-900">00:45</span>
                </div>
              </div>
            </div>
          </div>

          {/* Log interaction */}
          <div className="p-5 border-t border-slate-200 bg-white">
            <h4 className="text-xs font-semibold text-slate-900 mb-4 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />Log Interaction
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Outcome</label>
                <div className="relative">
                  <select className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-md pl-3 pr-10 py-2 text-sm text-slate-700 focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-shadow cursor-pointer">
                    <option>Meeting Booked</option>
                    <option>Interested (Follow-up)</option>
                    <option>Not Interested</option>
                    <option>Rescheduled</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <span className="material-symbols-outlined text-lg">expand_more</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5 font-medium">Follow-up Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  <button className="py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors bg-white">Low</button>
                  <button className="py-1.5 border border-slate-900 bg-slate-900 text-white rounded-md text-xs font-medium transition-colors shadow-sm">Medium</button>
                  <button className="py-1.5 border border-slate-200 rounded-md text-xs font-medium text-slate-600 hover:border-red-500 hover:text-red-600 transition-colors bg-white">High</button>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-medium py-2 px-4 rounded-md shadow-sm transition-all active:scale-[0.98] text-sm mt-2">
                <span className="material-symbols-outlined text-[18px]">save_as</span>Save Outcome
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
