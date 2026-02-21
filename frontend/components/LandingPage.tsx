"use client";

import { useState, useEffect } from "react";

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] overflow-y-auto">
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg text-white">
                auto_awesome
              </span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Stick
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#features"
              className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5"
            >
              How it works
            </a>
            <button
              onClick={onGetStarted}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-md"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600">
              AI-powered sales intelligence
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.08]">
            Spend minutes,
            <br />
            <span className="text-primary">not days</span> finding
            <br />
            client prospects
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Add your products, discover target companies, and get AI-generated
            pitch decks and outreach — all matched to the right buyer, automatically.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onGetStarted}
              className="bg-slate-900 text-white text-base font-medium px-8 py-3.5 rounded-xl hover:opacity-90 transition-all shadow-lg flex items-center gap-2"
            >
              Start for free
              <span className="material-symbols-outlined text-[20px]">
                arrow_forward
              </span>
            </button>
            <a
              href="#how-it-works"
              className="text-slate-500 text-base font-medium px-6 py-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Hero visual — mock dashboard */}
        <div className="max-w-5xl mx-auto mt-16">
          <div className="clay-card rounded-2xl overflow-hidden">
            <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-slate-400 font-medium">
                  app.stick.ai
                </span>
              </div>
            </div>
            <div className="bg-[#f8f9fa] p-6 sm:p-8">
              {/* Simulated dashboard */}
              <div className="flex gap-4 mb-6">
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Leads enriched
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">247</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Products matched
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">89</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1 hidden sm:block">
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                    Decks generated
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">34</p>
                </div>
              </div>
              {/* Simulated table rows */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-5 gap-4 px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Company</span>
                  <span>Industry</span>
                  <span>Match score</span>
                  <span className="hidden sm:block">Status</span>
                  <span className="hidden sm:block">Assets</span>
                </div>
                {[
                  {
                    name: "Acme Corp",
                    industry: "SaaS",
                    score: 9.2,
                    status: "complete",
                  },
                  {
                    name: "NovaTech",
                    industry: "FinTech",
                    score: 8.7,
                    status: "complete",
                  },
                  {
                    name: "DataStream",
                    industry: "Analytics",
                    score: 8.1,
                    status: "enriching",
                  },
                  {
                    name: "CloudBase",
                    industry: "DevOps",
                    score: 7.5,
                    status: "pending",
                  },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-slate-50 last:border-0 text-sm items-center"
                  >
                    <span className="font-medium text-slate-900">
                      {row.name}
                    </span>
                    <span className="text-slate-500">{row.industry}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-[80px]">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(row.score / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-700">
                        {row.score}
                      </span>
                    </div>
                    <span className="hidden sm:block">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === "complete"
                            ? "bg-green-50 text-green-700"
                            : row.status === "enriching"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {row.status}
                      </span>
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5 text-slate-400">
                      <span className="material-symbols-outlined text-[16px]">
                        slideshow
                      </span>
                      <span className="material-symbols-outlined text-[16px]">
                        mail
                      </span>
                      <span className="material-symbols-outlined text-[16px]">
                        mic
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Logos / social proof */}
      <section className="py-12 border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-6">
            Built with leading AI and data infrastructure
          </p>
          <div className="flex items-center justify-center gap-10 sm:gap-16 flex-wrap opacity-40">
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              Claude
            </span>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              LinkUp
            </span>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              Stripe
            </span>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              ElevenLabs
            </span>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Features
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Everything your sales team
              <br className="hidden sm:block" /> needs in one place
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto">
              From company discovery to personalized pitch decks — Stick
              automates the entire top-of-funnel workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "travel_explore",
                title: "Autonomous Discovery",
                desc: "Define your ideal customer profile and let Stick find matching companies across the web — no manual search needed.",
              },
              {
                icon: "query_stats",
                title: "Deep Enrichment",
                desc: "Every company gets researched in depth: funding, revenue, tech stack, buying signals, key contacts — all in real time.",
              },
              {
                icon: "hub",
                title: "Intelligent Product Matching",
                desc: "Stick analyzes each company against your entire product catalog and surfaces the highest-potential match with reasoning.",
              },
              {
                icon: "slideshow",
                title: "AI Pitch Decks",
                desc: "One-click personalized pitch decks for every company-product pair, ready to present or export as PPTX.",
              },
              {
                icon: "mail",
                title: "Outreach Drafts",
                desc: "Personalized cold emails that reference specific company signals and pain points. Copy, tweak, and send.",
              },
              {
                icon: "mic",
                title: "Voice Briefings",
                desc: "AI-generated voice summaries for each lead, so your reps can prep for calls in 60 seconds flat.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="clay-card rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-xl text-white">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Three steps to your first pitch
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "inventory_2",
                title: "Add your products",
                desc: "Upload your product catalog with features, pricing, and differentiators. Stick understands what you sell.",
              },
              {
                step: "02",
                icon: "group_add",
                title: "Discover or paste companies",
                desc: "Enter companies manually or let the AI discovery agent find ideal targets based on your customer profile.",
              },
              {
                step: "03",
                icon: "rocket_launch",
                title: "Get matched pitches",
                desc: "Stick enriches each company, matches the best product, and generates a personalized pitch deck and email.",
              },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl font-black text-slate-100 mb-4">
                  {step.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-2xl text-white">
                    {step.icon}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / big numbers */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="clay-card rounded-2xl p-10 sm:p-14">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Built for speed and scale
              </h2>
              <p className="mt-3 text-slate-500 max-w-lg mx-auto">
                What used to take a sales team weeks now takes minutes.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "10x", label: "Faster prospecting" },
                { value: "< 2min", label: "Per pitch deck" },
                { value: "95%", label: "Data accuracy" },
                { value: "$0", label: "To get started" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-black text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-slate-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Stop searching. Start selling.
          </h2>
          <p className="mt-4 text-slate-400 text-lg max-w-xl mx-auto">
            Stick is your AI sales team — it discovers, researches, matches,
            and pitches. All you have to do is close.
          </p>
          <button
            onClick={onGetStarted}
            className="mt-10 bg-white text-slate-900 text-base font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-50 transition-all shadow-lg inline-flex items-center gap-2"
          >
            Get started for free
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-slate-900">
                auto_awesome
              </span>
            </div>
            <span className="text-sm font-medium text-slate-400">Stick</span>
          </div>
          <p className="text-xs text-slate-500">
            Built at HackEurope 2025. Powered by Claude, LinkUp, Stripe &amp; ElevenLabs.
          </p>
        </div>
      </footer>
    </div>
  );
}
