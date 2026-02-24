"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { api } from "../lib/api";

export default function Onboard() {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [stage, setStage] = useState("Series A");
  const [geography, setGeography] = useState("");
  const [valueProp, setValueProp] = useState("");
  const [autofillUrl, setAutofillUrl] = useState("");
  const [autofilling, setAutofilling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // BYOK state
  const [anthropicKey, setAnthropicKey] = useState("");
  const [linkupKey, setLinkupKey] = useState("");
  const [maskedAnthropic, setMaskedAnthropic] = useState<string | null>(null);
  const [maskedLinkup, setMaskedLinkup] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysSaved, setKeysSaved] = useState(false);
  const [keysError, setKeysError] = useState("");

  const stages = ["Pre-Seed", "Seed", "Series A", "Series B+", "Public"];

  useEffect(() => {
    if (!user) return;
    // Reset form when user changes (e.g. logout + login)
    setCompanyName("");
    setWebsite("");
    setStage("Series A");
    setGeography("");
    setValueProp("");
    api
      .getCompanyProfile()
      .then((profile) => {
        if (profile.company_name) setCompanyName(profile.company_name);
        if (profile.website) setWebsite(profile.website);
        if (profile.growth_stage) setStage(profile.growth_stage);
        if (profile.geography) setGeography(profile.geography);
        if (profile.value_proposition) setValueProp(profile.value_proposition);
      })
      .catch((err) => {
        console.error("Failed to load company profile:", err);
      });
    // Load saved API keys (masked)
    api
      .getApiKeys()
      .then((keys) => {
        setMaskedAnthropic(keys.anthropic_api_key);
        setMaskedLinkup(keys.linkup_api_key);
      })
      .catch(() => {});
  }, [user?.id]);

  const handleAutofill = async () => {
    if (!autofillUrl.trim()) return;
    setAutofilling(true);
    try {
      const data = await api.autofillCompanyProfile(autofillUrl.trim());
      if (data.company_name) setCompanyName(data.company_name);
      if (data.website) setWebsite(data.website);
      if (data.growth_stage) setStage(data.growth_stage);
      if (data.geography) setGeography(data.geography);
      if (data.value_proposition) setValueProp(data.value_proposition);
    } catch (err) {
      console.error("Auto-fill failed:", err);
    } finally {
      setAutofilling(false);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await api.saveCompanyProfile({
        company_name: companyName.trim(),
        website: website.trim() || undefined,
        growth_stage: stage,
        geography: geography.trim() || undefined,
        value_proposition: valueProp.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save profile";
      setSaveError(msg);
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveKeys = async () => {
    const keys: { anthropic_api_key?: string; linkup_api_key?: string } = {};
    if (anthropicKey.trim()) keys.anthropic_api_key = anthropicKey.trim();
    if (linkupKey.trim()) keys.linkup_api_key = linkupKey.trim();
    if (!Object.keys(keys).length) return;
    setSavingKeys(true);
    setKeysSaved(false);
    setKeysError("");
    try {
      await api.saveApiKeys(keys);
      const updated = await api.getApiKeys();
      setMaskedAnthropic(updated.anthropic_api_key);
      setMaskedLinkup(updated.linkup_api_key);
      setAnthropicKey("");
      setLinkupKey("");
      setKeysSaved(true);
      setTimeout(() => setKeysSaved(false), 2000);
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : "Failed to save keys");
    } finally {
      setSavingKeys(false);
    }
  };

  const handleClearKeys = async () => {
    try {
      await api.deleteApiKeys();
      setMaskedAnthropic(null);
      setMaskedLinkup(null);
      setAnthropicKey("");
      setLinkupKey("");
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : "Failed to clear keys");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Company &amp; Product Setup
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Define your company profile and product details to train our AI for
            personalized outreach.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors shadow-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !companyName.trim()}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {saved ? "check_circle" : "check"}
            </span>
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {saveError}
        </div>
      )}

      {/* Company Profile */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-6 rounded bg-grey-100 text-grey-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">
              business
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-800">My Company Profile</h2>
        </div>
        <div className="clay-card rounded-2xl p-6 md:p-8">
          {/* Auto-fill from URL */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
            <span className="material-symbols-outlined text-slate-400 text-[20px]">auto_awesome</span>
            <input
              value={autofillUrl}
              onChange={(e) => setAutofillUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAutofill()}
              className="flex-1 rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
              placeholder="Paste your company website URL to auto-fill..."
            />
            <button
              onClick={handleAutofill}
              disabled={autofilling || !autofillUrl.trim()}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[16px]">
                {autofilling ? "progress_activity" : "bolt"}
              </span>
              {autofilling ? "Extracting..." : "Auto-fill"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Company Name
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="e.g. Stick"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Website URL
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-sm">
                  https://
                </span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full rounded-r-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="www.example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Growth Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              >
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Geography / HQ
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">
                  location_on
                </span>
                <input
                  value={geography}
                  onChange={(e) => setGeography(e.target.value)}
                  className="w-full pl-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="City, Country"
                />
              </div>
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Value Proposition
              </label>
              <textarea
                value={valueProp}
                onChange={(e) => setValueProp(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="Briefly describe what your company does..."
                rows={3}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                This helps our AI understand your core offering.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Keys (BYOK) */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-6 rounded bg-grey-100 text-grey-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-[16px]">key</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800">API Keys</h2>
        </div>
        <div className="clay-card rounded-2xl p-6 md:p-8">
          <p className="text-sm text-slate-500 mb-6">
            Bring your own API keys to power the AI features. Keys are encrypted
            at rest and never shared.
          </p>

          {keysError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
              {keysError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder={maskedAnthropic || "sk-ant-..."}
              />
              {maskedAnthropic && (
                <p className="mt-1.5 text-xs text-green-600">
                  Saved: {maskedAnthropic}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                LinkUp API Key
              </label>
              <input
                type="password"
                value={linkupKey}
                onChange={(e) => setLinkupKey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder={maskedLinkup || "Your LinkUp API key"}
              />
              {maskedLinkup && (
                <p className="mt-1.5 text-xs text-green-600">
                  Saved: {maskedLinkup}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSaveKeys}
              disabled={savingKeys || (!anthropicKey.trim() && !linkupKey.trim())}
              className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {keysSaved ? "check_circle" : "save"}
              </span>
              {savingKeys ? "Saving..." : keysSaved ? "Saved!" : "Save Keys"}
            </button>
            {(maskedAnthropic || maskedLinkup) && (
              <button
                onClick={handleClearKeys}
                className="px-5 py-2.5 rounded-lg border border-red-200 bg-white text-red-600 font-medium text-sm hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                Clear Keys
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
