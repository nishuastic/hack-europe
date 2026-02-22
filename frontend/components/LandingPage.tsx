"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

interface LandingPageProps {
  onGetStarted: () => void;
}

const MOCK_LEADS = [
  {
    name: "Acme Corp", industry: "SaaS", employees: 250, revenue: "$25M", score: 9.2, status: "complete" as const,
    description: "Enterprise project management platform serving 2,000+ companies worldwide.",
    signals: ["Series C funded ($45M)", "Hiring 12 sales reps", "Expanding to EU market"],
    matchProduct: "DataSync Pro",
    matchReason: "Acme's rapid EU expansion requires reliable data pipeline infrastructure. DataSync Pro's GDPR-compliant architecture is a natural fit.",
    contact: { name: "Sarah Chen", title: "VP Engineering" },
  },
  {
    name: "NovaTech", industry: "FinTech", employees: 80, revenue: "$8M", score: 8.7, status: "complete" as const,
    description: "Real-time payment processing for emerging market neobanks.",
    signals: ["Series A raised ($12M)", "Launched in 3 new markets", "PCI DSS certified"],
    matchProduct: "CloudShield",
    matchReason: "NovaTech's multi-market expansion creates complex compliance requirements. CloudShield's automated monitoring reduces audit overhead by 60%.",
    contact: { name: "Marcus Liu", title: "CTO" },
  },
  {
    name: "DataStream", industry: "Analytics", employees: 120, revenue: "$15M", score: 8.1, status: "enriching" as const,
    description: "Real-time analytics infrastructure for product teams.",
    signals: ["Growing 40% YoY", "SOC 2 in progress"],
    matchProduct: "DataSync Pro",
    matchReason: "DataStream's analytics platform would benefit from real-time data ingestion capabilities.",
    contact: { name: "Priya Patel", title: "Head of Sales" },
  },
  {
    name: "CloudBase", industry: "DevOps", employees: 60, revenue: "$10M", score: 7.5, status: "pending" as const,
    description: "Kubernetes management platform for mid-market companies.",
    signals: [], matchProduct: "—", matchReason: "", contact: { name: "—", title: "—" },
  },
  {
    name: "Velocity AI", industry: "AI/ML", employees: 45, revenue: "$6M", score: 8.9, status: "complete" as const,
    description: "MLOps platform helping teams deploy models 10x faster.",
    signals: ["Seed+ raised ($8M)", "YC W24 batch", "Tripled team size"],
    matchProduct: "DataSync Pro",
    matchReason: "Velocity AI needs robust data pipelines for model training. DataSync Pro's streaming capabilities align perfectly.",
    contact: { name: "Jordan Park", title: "CEO & Co-founder" },
  },
];

const MOCK_DECK = (lead: (typeof MOCK_LEADS)[0]) => [
  { type: "title" as const, heading: `${lead.matchProduct} × ${lead.name}`, sub: "Personalized Partnership Proposal" },
  { type: "content" as const, heading: "The Opportunity", bullets: lead.signals },
  { type: "content" as const, heading: `Why ${lead.matchProduct}`, bullets: [lead.matchReason] },
];

const useScrollAnimation = (threshold = 0.3) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setIsVisible(true); }, { threshold });
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, [threshold]);
  return { ref, isVisible };
};

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [impact, setImpact] = useState<{ total_hours_saved: number; total_dollars_saved: number; total_actions: number } | null>(null);
  const [impactAnimated, setImpactAnimated] = useState(false);
  const [displayHours, setDisplayHours] = useState(0);
  const [displayDollars, setDisplayDollars] = useState(0);
  const [displayActions, setDisplayActions] = useState(0);
  const [displayCustomers, setDisplayCustomers] = useState(0);
  const [leadsEnriched, setLeadsEnriched] = useState(0);
  const [productsMatched, setProductsMatched] = useState(0);
  const [decksGenerated, setDecksGenerated] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [demoView, setDemoView] = useState<"table" | "detail" | "deck">("table");
  const [selectedLead, setSelectedLead] = useState<number>(0);
  const [generatingDeck, setGeneratingDeck] = useState(false);
  const [enrichDone, setEnrichDone] = useState(false);

  useEffect(() => { const t = setTimeout(() => setEnrichDone(true), 3000); return () => clearTimeout(t); }, []);
  const handleGenerateDeck = () => { setGeneratingDeck(true); setTimeout(() => { setGeneratingDeck(false); setDemoView("deck"); }, 1500); };
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h); }, []);
  useEffect(() => { api.getGlobalImpact().then(setImpact).catch(() => {}); }, []);

  const impactObserverRef = useRef<IntersectionObserver | null>(null);
  const impactCallbackRef = (node: HTMLDivElement | null) => {
    if (impactObserverRef.current) { impactObserverRef.current.disconnect(); impactObserverRef.current = null; }
    if (!node || !impact || impactAnimated) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setImpactAnimated(true);
        animateCounter(0, impact.total_hours_saved * 10, setDisplayHours, 1500);
        animateCounter(0, impact.total_dollars_saved * 10, setDisplayDollars, 1500);
        animateCounter(0, impact.total_actions, setDisplayActions, 1500);
        animateCounter(0, (impact as any).total_customers ?? 0, setDisplayCustomers, 1500);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(node); impactObserverRef.current = obs;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) {
        setHasAnimated(true);
        animateCounter(0, 247, setLeadsEnriched, 1500);
        animateCounter(0, 89, setProductsMatched, 1500);
        animateCounter(0, 34, setDecksGenerated, 1500);
      }
    }, { threshold: 0.5 });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => { if (statsRef.current) observer.unobserve(statsRef.current); };
  }, [hasAnimated]);

  const animateCounter = (start: number, end: number, setter: (v: number) => void, duration: number) => {
    const startTime = Date.now();
    const counter = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      setter(Math.floor(start + (end - start) * p));
      if (p < 1) requestAnimationFrame(counter);
    };
    requestAnimationFrame(counter);
  };

  const [typedText, setTypedText] = useState("");
  const fullText = "Everything your sales team\n needs in one place.";
  const heroRef = useScrollAnimation();
  const featuresRef = useScrollAnimation();
  const howItWorksRef = useScrollAnimation();

  useEffect(() => {
    if (featuresRef.isVisible && typedText.length < fullText.length) {
      const t = setTimeout(() => setTypedText(fullText.slice(0, typedText.length + 1)), 50);
      return () => clearTimeout(t);
    }
  }, [featuresRef.isVisible, typedText, fullText]);

  const lead = MOCK_LEADS[selectedLead];
  const deckSlides = MOCK_DECK(lead);

  const renderDemoTable = () => (
    <div className="bg-[#f8f9fa] p-4 sm:p-6">
      <div className="flex gap-3 mb-5" ref={statsRef}>
        {[{ label: "Leads enriched", value: leadsEnriched }, { label: "Products matched", value: productsMatched }, { label: "Decks generated", value: decksGenerated }].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 flex-1">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{s.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-6 gap-4 px-4 py-2 border-b border-slate-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          <span>Company</span><span>Industry</span><span className="hidden sm:block">Employees</span><span>Revenue</span><span>Match score</span><span className="hidden sm:block">Status</span>
        </div>
        {MOCK_LEADS.map((row, i) => {
          const isEnriching = row.status === "enriching" && !enrichDone;
          const isClickable = row.status === "complete" || (row.status === "enriching" && enrichDone);
          return (
            <div key={i} onClick={() => { if (isClickable) { setSelectedLead(i); setDemoView("detail"); } }}
              className={`grid grid-cols-6 gap-4 px-4 py-2.5 border-b border-slate-50 last:border-0 text-sm items-center transition-colors ${isClickable ? "cursor-pointer hover:bg-blue-50/50" : ""} ${isEnriching ? "bg-blue-50/30" : ""}`}>
              <span className="font-medium text-slate-900 truncate flex items-center gap-1.5">
                {row.name}
                {isClickable && <span className="material-symbols-outlined text-[14px] text-slate-300">chevron_right</span>}
              </span>
              <span className="text-slate-500 text-xs">{row.industry}</span>
              <span className="text-slate-500 text-xs hidden sm:block">{row.employees}</span>
              <span className="text-slate-500 text-xs">{row.revenue}</span>
              <div className="flex items-center gap-1.5">
                {isEnriching ? <div className="h-1.5 bg-slate-100 rounded-full w-full max-w-[60px] overflow-hidden"><div className="h-full w-1/2 bg-blue-400 rounded-full animate-pulse" /></div>
                  : row.status === "pending" ? <span className="text-[10px] text-slate-300">—</span>
                  : <><div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[60px]"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(row.score / 10) * 100}%` }} /></div><span className="text-[10px] font-semibold text-slate-600 tabular-nums">{row.score}</span></>}
              </div>
              <span className="hidden sm:block">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${row.status === "complete" || (row.status === "enriching" && enrichDone) ? "bg-emerald-50 text-emerald-700" : row.status === "enriching" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"}`}>
                  {row.status === "enriching" && enrichDone ? "complete" : row.status}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-3 text-center">Click a completed row to explore</p>
    </div>
  );

  const renderDemoDetail = () => (
    <div className="bg-[#f8f9fa] p-4 sm:p-6 min-h-[340px]">
      <button onClick={() => setDemoView("table")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back to leads
      </button>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{lead.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{lead.industry} · {lead.employees} employees · {lead.revenue} revenue</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-slate-900 tabular-nums">{lead.score}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Match</div>
        </div>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed mb-4">{lead.description}</p>
      {lead.signals.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Buying Signals</p>
          <div className="flex flex-wrap gap-1.5">
            {lead.signals.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-medium px-2 py-1 rounded-md">
                <span className="material-symbols-outlined text-[12px]">trending_up</span>{s}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg border border-slate-200 p-3 mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="material-symbols-outlined text-[16px] text-blue-500">star</span>
          <span className="text-xs font-bold text-slate-900">Best Match: {lead.matchProduct}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">{lead.matchReason}</p>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
          <span className="material-symbols-outlined text-[14px] text-slate-500">person</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-900">{lead.contact.name}</p>
          <p className="text-[10px] text-slate-400">{lead.contact.title}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleGenerateDeck} disabled={generatingDeck} className="flex items-center gap-1.5 bg-slate-900 text-white text-[11px] font-medium px-3 py-2 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-60">
          {generatingDeck ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Generating...</> : <><span className="material-symbols-outlined text-[14px]">slideshow</span>Generate Pitch Deck</>}
        </button>
        <button className="flex items-center gap-1.5 bg-white text-slate-700 text-[11px] font-medium px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
          <span className="material-symbols-outlined text-[14px]">mail</span>Draft Email
        </button>
      </div>
    </div>
  );

  const renderDemoDeck = () => (
    <div className="bg-[#f8f9fa] p-4 sm:p-6">
      <button onClick={() => setDemoView("detail")} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 mb-4 transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>Back to {lead.name}
      </button>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-900">Pitch Deck — {lead.matchProduct} × {lead.name}</h3>
        <button className="flex items-center gap-1 text-[10px] text-slate-500 border border-slate-200 bg-white px-2 py-1 rounded-md hover:bg-slate-50">
          <span className="material-symbols-outlined text-[12px]">download</span>PPTX
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {deckSlides.map((slide, i) => (
          <div key={i} className="aspect-[16/10] bg-white rounded-lg border border-slate-200 p-3 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow">
            {slide.type === "title" ? (
              <div className="text-center">
                <p className="text-[10px] sm:text-xs font-bold text-slate-900 leading-tight">{slide.heading}</p>
                <p className="text-[8px] sm:text-[10px] text-slate-400 mt-1">{slide.sub}</p>
              </div>
            ) : (
              <div>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-900 mb-1.5">{slide.heading}</p>
                {slide.bullets?.map((b, j) => (
                  <p key={j} className="text-[8px] sm:text-[9px] text-slate-500 leading-relaxed flex gap-1">
                    <span className="text-blue-400 shrink-0">•</span><span className="line-clamp-3">{b}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 bg-white rounded-lg border border-slate-200 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="material-symbols-outlined text-[14px] text-slate-400">mail</span>
          <span className="text-[10px] font-semibold text-slate-900">Outreach Draft</span>
        </div>
        <div className="text-[10px] text-slate-500 space-y-0.5">
          <p><span className="text-slate-400">To:</span> {lead.contact.name} ({lead.contact.title})</p>
          <p><span className="text-slate-400">Subject:</span> {lead.matchProduct} for {lead.name}&apos;s {lead.signals[0]?.toLowerCase() || "growth"}</p>
        </div>
        <div className="mt-2 text-[9px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">
          Hi {lead.contact.name.split(" ")[0]}, I noticed {lead.name} recently {lead.signals[0]?.toLowerCase() || "is growing fast"}. We built {lead.matchProduct} to help teams like yours...
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] overflow-y-auto">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-0">
            <div className="w-15 h-15 rounded-lg flex items-center justify-center">
              <span className="w-14 h-14 bg-amber-800" style={{ WebkitMask: "url('/stick_2.svg') center / contain no-repeat", mask: "url('/stick_2.svg') center / contain no-repeat" }} aria-label="Stick logo" />
            </div>
            <span className="text-5xl font-semibold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Stick</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#features" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5">Features</a>
            <a href="#how-it-works" className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5">How it works</a>
            <button onClick={onGetStarted} className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-md">Get started</button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 ref={heroRef.ref} style={{ fontFamily: "'Playfair Display', serif" }}
            className={`text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.08] transition-all duration-1000 transform ${heroRef.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            Spend minutes,<br /><span className="italic">not days</span> finding<br />client prospects
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Add your products, discover target companies, and get AI-generated pitch decks and outreach — all matched to the right buyer, automatically.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onGetStarted} className="bg-slate-900 text-white text-base font-medium px-8 py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center gap-2">
              Start for free<span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
            <a href="/pricing" className="text-slate-500 text-base font-medium px-6 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all">See pricing</a>
          </div>
        </div>

        <div className="max-w-5xl mx-auto mt-16">
          <div className="clay-card rounded-2xl overflow-hidden shadow-xl" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center"><span className="text-xs text-gray-400 font-medium">app.stick.ai</span></div>
            </div>
            <div className="flex">
              <div className="hidden sm:flex flex-col items-center gap-1 bg-slate-900 px-2 py-4 border-r border-slate-800 w-12 shrink-0">
                {[{ icon: "dashboard", active: demoView === "table" }, { icon: "inventory_2", active: false }, { icon: "bar_chart", active: false }, { icon: "payments", active: false }].map((item, i) => (
                  <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.active ? "bg-slate-700" : "hover:bg-slate-800"} transition-colors`}>
                    <span className={`material-symbols-outlined text-[18px] ${item.active ? "text-white" : "text-slate-500"}`}>{item.icon}</span>
                  </div>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {demoView === "table" && renderDemoTable()}
                {demoView === "detail" && renderDemoDetail()}
                {demoView === "deck" && renderDemoDeck()}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Built with leading AI and data infrastructure</p>
          <div className="flex items-center justify-center gap-12 sm:gap-20 flex-wrap">
            <img src="/logos/anthropic.svg" alt="Anthropic" className="h-6 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/linkup.png" alt="LinkUp" className="h-7 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/stripe.svg" alt="Stripe" className="h-8 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/paidai.png" alt="Paid.ai" className="h-7 opacity-50 hover:opacity-80 transition-opacity" />
          </div>
        </div>
      </section>

      {impact && impact.total_actions > 0 && (
        <section ref={impactCallbackRef} className="py-12 px-6 bg-slate-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-6">Trusted by sales teams worldwide</p>
            <div className="flex items-center justify-center gap-12 flex-wrap">
              <div><p className="text-4xl font-bold tabular-nums">{(displayHours / 10).toFixed(1)}h</p><p className="text-sm text-slate-400 mt-1">Hours saved</p></div>
              <div className="h-10 w-px bg-slate-700" />
              <div><p className="text-4xl font-bold tabular-nums">${(displayDollars / 10).toFixed(1)}</p><p className="text-sm text-slate-400 mt-1">Dollars saved</p></div>
              <div className="h-10 w-px bg-slate-700" />
              <div><p className="text-4xl font-bold tabular-nums">{displayActions.toLocaleString()}</p><p className="text-sm text-slate-400 mt-1">AI actions completed</p></div>
              <div className="h-10 w-px bg-slate-700" />
              <div><p className="text-4xl font-bold tabular-nums">{displayCustomers.toLocaleString()}</p><p className="text-sm text-slate-400 mt-1">Customers</p></div>
            </div>
          </div>
        </section>
      )}

      <section ref={featuresRef.ref} id="features" className={`py-24 px-6 transition-all duration-1000 transform ${featuresRef.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              {typedText.split("\n").map((line, i) => (<span key={i}>{line}{i < typedText.split("\n").length - 1 && <br className="hidden sm:block" />}</span>))}
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto">From company discovery to personalized pitch decks — Stick automates the entire top-of-funnel workflow.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-14">
            {[
              { icon: "travel_explore", title: "Autonomous Discovery", desc: "Define your ideal customer profile and let Stick find matching companies across the web — no manual search needed." },
              { icon: "query_stats", title: "Deep Enrichment", desc: "Every company gets researched in depth: funding, revenue, tech stack, buying signals, key contacts — all in real time." },
              { icon: "hub", title: "Intelligent Product Matching", desc: "Stick analyzes each company against your entire product catalog and surfaces the highest-potential match with reasoning." },
              { icon: "slideshow", title: "AI Pitch Decks", desc: "One-click personalized pitch decks for every company-product pair, ready to present or export as PPTX." },
              { icon: "mail", title: "Outreach Drafts", desc: "Personalized cold emails that reference specific company signals and pain points. Copy, tweak, and send." },
              { icon: "payments", title: "Usage-Based Billing", desc: "Pay only for what you use. Stripe-powered credits for enrichments, matches, and deck generation." },
            ].map((feature, i) => (
              <div key={i} className={`transition-all duration-700 transform ${featuresRef.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`} style={{ transitionDelay: featuresRef.isVisible ? `${i * 100}ms` : "0ms" }}>
                <div className="mb-3"><span className="material-symbols-outlined text-2xl text-slate-400">{feature.icon}</span></div>
                <h3 className="text-lg font-bold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={howItWorksRef.ref} id="how-it-works" className={`py-24 px-6 bg-white border-y border-slate-200 transition-all duration-1000 transform ${howItWorksRef.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Three steps to your first pitch</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: "inventory_2", title: "Add your products", desc: "Upload your product catalog with features, pricing, and differentiators. Stick understands what you sell." },
              { step: "02", icon: "group_add", title: "Discover or paste companies", desc: "Enter companies manually or let the AI discovery agent find ideal targets based on your customer profile." },
              { step: "03", icon: "rocket_launch", title: "Get matched pitches", desc: "Stick enriches each company, matches the best product, and generates a personalized pitch deck and email." },
            ].map((step, i) => (
              <div key={i} className={`text-center transition-all duration-700 transform ${howItWorksRef.isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"}`} style={{ transitionDelay: howItWorksRef.isVisible ? `${i * 150}ms` : "0ms" }}>
                <div className="text-5xl font-bold text-gray-300 mb-4">{step.step}</div>
                <div className="mx-auto mb-4"><span className="material-symbols-outlined text-4xl text-slate-900">{step.icon}</span></div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="clay-card rounded-2xl p-10 sm:p-14">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Built for speed and scale</h2>
              <p className="mt-3 text-slate-500 max-w-lg mx-auto">What used to take a sales team weeks now takes minutes.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[{ value: "10x", label: "Faster prospecting" }, { value: "< 2min", label: "Per pitch deck" }, { value: "95%", label: "Data accuracy" }, { value: "$0", label: "To get started" }].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-black text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Stop searching. Start selling.</h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">Stick is your AI sales team — it discovers, researches, matches, and pitches. All you have to do is close.</p>
          <button onClick={onGetStarted} className="mt-8 bg-slate-900 text-white text-base font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg inline-flex items-center gap-2">
            Get started for free<span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-1">
              <span className="w-8 h-8 bg-slate-900" style={{ WebkitMask: "url('/stick_2.svg') center / contain no-repeat", mask: "url('/stick_2.svg') center / contain no-repeat" }} />
              <span className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>Stick</span>
            </div>
            <nav className="flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
              <a href="/pricing" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Pricing</a>
              <button onClick={onGetStarted} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Get started</button>
            </nav>
          </div>
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Stick. Built at HackEurope 2026.</p>
            <div className="flex items-center gap-4">
              <a href="https://github.com/nishuastic/hack-europe" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
