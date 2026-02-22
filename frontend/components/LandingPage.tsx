"use client";

import { useState, useEffect, useRef } from "react";

interface LandingPageProps {
  onGetStarted: () => void;
}

// Custom hook for scroll animations
const useScrollAnimation = (threshold = 0.3) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [leadsEnriched, setLeadsEnriched] = useState(0);
  const [productsMatched, setProductsMatched] = useState(0);
  const [decksGenerated, setDecksGenerated] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer to detect when stats section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          // Start counter animation
          animateCounter(0, 247, setLeadsEnriched, 1500);
          animateCounter(0, 89, setProductsMatched, 1500);
          animateCounter(0, 34, setDecksGenerated, 1500);
        }
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => {
      if (statsRef.current) {
        observer.unobserve(statsRef.current);
      }
    };
  }, [hasAnimated]);

  const animateCounter = (
    start: number,
    end: number,
    setter: (value: number) => void,
    duration: number
  ) => {
    const startTime = Date.now();
    const increment = end / (duration / 16); // ~60fps

    const counter = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);
      setter(current);

      if (progress < 1) {
        requestAnimationFrame(counter);
      }
    };

    requestAnimationFrame(counter);
  };

  const [typedText, setTypedText] = useState("");
  const fullText = "Everything your sales team\n needs in one place.";

  // Scroll animations
  const heroRef = useScrollAnimation();
  const dashboardRef = useScrollAnimation();
  const logosRef = useScrollAnimation();
  const featuresRef = useScrollAnimation();
  const howItWorksRef = useScrollAnimation();
  const statsCardRef = useScrollAnimation();
  const ctaRef = useScrollAnimation();

  useEffect(() => {
    if (featuresRef.isVisible && typedText.length < fullText.length) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 50); // Adjust speed here
      return () => clearTimeout(timeout);
    }
  }, [featuresRef.isVisible, typedText, fullText]);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fa] overflow-y-auto" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
            ? "bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm"
            : "bg-transparent"
          }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-0">
            <div className="w-15 h-15 rounded-lg flex items-center justify-center">
              <span
                className="w-14 h-14 bg-amber-800"
                style={{
                  WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                  mask: "url('/stick_2.svg') center / contain no-repeat",
                }}
                aria-label="Stick logo"
              />
            </div>
            <span className="text-5xl font-semibold tracking-tight text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
              Stick
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#features"
              className="hidden sm:block text-sm text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hidden sm:block text-sm text-slate-500 hover:text-slate-900  px-3 py-1.5"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              How it works
            </a>
            <button
              onClick={onGetStarted}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-all shadow-md"
              style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">

          <h1
            ref={heroRef.ref}
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
            className={`text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.08] transition-all duration-1000 transform ${heroRef.isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
          >
            Spend minutes,
            <br />
            <span className="italic">not days</span> finding
            <br />
            client prospects
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Add your products, discover target companies, and get AI-generated
            pitch decks and outreach — all matched to the right buyer, automatically.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
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
          <div className="clay-card rounded-2xl overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-gray-400 font-medium">
                  app.stick.ai
                </span>
              </div>
            </div>
            <div className="bg-[#f8f9fa] p-6 sm:p-8">
              {/* Simulated dashboard */}
              <div className="flex gap-4 mb-6" ref={statsRef}>
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    Leads enriched
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{leadsEnriched}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    Products matched
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{productsMatched}</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex-1 hidden sm:block">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                    Decks generated
                  </p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{decksGenerated}</p>
                </div>
              </div>
              {/* Simulated table rows */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 gap-5 px-4 py-2.5 border-b border-slate-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <span>Company</span>
                  <span>Industry</span>
                  <span>Employees</span>
                  <span>Revenue</span>
                  <span>Match score</span>
                  <span className="hidden sm:block">Status</span>
                  <span className="hidden sm:block">Assets</span>
                </div>
                {[
                  {
                    name: "Acme Corp",
                    industry: "SaaS",
                    employees: 250,
                    revenue: "$25M",
                    score: 9.2,
                    status: "complete",
                  },
                  {
                    name: "NovaTech",
                    industry: "FinTech",
                    employees: 80,
                    revenue: "$8M",
                    score: 8.7,
                    status: "complete",
                  },
                  {
                    name: "DataStream",
                    industry: "Analytics",
                    employees: 120,
                    revenue: "$15M",
                    score: 8.1,
                    status: "enriching",
                  },
                  {
                    name: "CloudBase",
                    industry: "DevOps",
                    employees: 60,
                    revenue: "$10M",
                    score: 7.5,
                    status: "pending",
                  },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-7 gap-5 px-4 py-3 border-b border-slate-50 last:border-0 text-sm items-center"
                  >
                    <span className="font-medium text-slate-900">
                      {row.name}
                    </span>

                    <span className="text-slate-500">
                      {row.industry}
                    </span>

                    <span className="text-slate-500">
                      {row.employees}
                    </span>

                    <span className="text-slate-500">
                      {row.revenue}
                    </span>

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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.status === "complete"
                            ? "bg-green-50 text-green-700"
                            : row.status === "enriching"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                      >
                        {row.status}
                      </span>
                    </span>

                    <span className="hidden sm:flex items-center gap-1.5 text-gray-400">
                      <span className="material-symbols-outlined text-[16px]">
                        slideshow
                      </span>
                      <span className="material-symbols-outlined text-[16px]">
                        mail
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
          <p className="text-base font-extrabold text-gray-600 uppercase tracking-widest mb-8">
            Built with leading AI and data infrastructure
          </p>
          <div className="flex items-center justify-center gap-12 sm:gap-20 flex-wrap">
            <img src="/logos/anthropic.svg" alt="Anthropic" className="h-6 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/linkup.png" alt="LinkUp" className="h-7 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/stripe.svg" alt="Stripe" className="h-8 opacity-50 hover:opacity-80 transition-opacity" />
            <img src="/logos/paidai.png" alt="Paid.ai" className="h-7 opacity-50 hover:opacity-80 transition-opacity" />
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section
        ref={featuresRef.ref}
        id="features"
        className={`py-24 px-6 transition-all duration-1000 transform ${featuresRef.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-12"
          }`}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-base font-extrabold text-gray-600 uppercase tracking-widest mb-3">
              Features
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {typedText.split("\n").map((line, i) => (
                <span key={i}>
                  {line}
                  {i < typedText.split("\n").length - 1 && (
                    <br className="hidden sm:block" />
                  )}
                </span>
              ))}
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              From company discovery to personalized pitch decks — Stick
              automates the entire top-of-funnel workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-14">
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
                icon: "payments",
                title: "Usage-Based Billing",
                desc: "Pay only for what you use. Stripe-powered credits for enrichments, matches, and deck generation.",
              },
            ].map((feature, i) => (
              <div
                key={i}
                className={`transition-all duration-700 transform ${featuresRef.isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-12"
                  }`}
                style={{
                  transitionDelay: featuresRef.isVisible ? `${i * 100}ms` : "0ms",
                }}
              >
                <div className="mb-3">
                  <span className="material-symbols-outlined text-2xl text-slate-400">
                    {feature.icon}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        ref={howItWorksRef.ref}
        id="how-it-works"
        className={`py-24 px-6 bg-white border-y border-slate-200 transition-all duration-1000 transform ${howItWorksRef.isVisible
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-12"
          }`}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-base font-extrabold text-gray-600 uppercase tracking-widest mb-3">
              How it works
            </p>
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
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
              <div
                key={i}
                className={`text-center transition-all duration-700 transform ${howItWorksRef.isVisible
                    ? "opacity-100 translate-x-0"
                    : "opacity-0 -translate-x-12"
                  }`}
                style={{
                  transitionDelay: howItWorksRef.isVisible ? `${i * 150}ms` : "0ms",
                }}
              >
                <div className="text-5xl font-bold text-gray-400 mb-4">
                  {step.step}
                </div>
                <div className="mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-slate-900">
                    {step.icon}
                  </span>
                </div>
                <h3
                  className="text-lg font-semibold text-slate-900 mb-2"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
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
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
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
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Stop searching. Start selling.
          </h2>
          <p className="mt-3 text-slate-500 max-w-xl mx-auto">
            Stick is your AI sales team — it discovers, researches, matches,
            and pitches. All you have to do is close.
          </p>
          <button
            onClick={onGetStarted}
            className="mt-8 bg-slate-900 text-white text-base font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-lg inline-flex items-center gap-2"
          >
            Get started for free
            <span className="material-symbols-outlined text-[20px]">
              arrow_forward
            </span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Brand */}
            <div className="flex items-center gap-1">
              <span
                className="w-8 h-8 bg-slate-900"
                style={{
                  WebkitMask: "url('/stick_2.svg') center / contain no-repeat",
                  mask: "url('/stick_2.svg') center / contain no-repeat",
                }}
              />
              <span className="text-2xl font-semibold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                Stick
              </span>
            </div>

            {/* Nav links — horizontal */}
            <nav className="flex items-center gap-6">
              <a href="#features" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
              <button onClick={onGetStarted} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Get started</button>
            </nav>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} Stick. Built at HackEurope 2026.
            </p>
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
