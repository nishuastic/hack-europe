"use client";

import { useState } from "react";
import { useAuth } from "./AuthContext";

interface AuthPageProps {
  mode: "login" | "register";
  onSwitchMode: () => void;
}

export default function AuthPage({ mode, onSwitchMode }: AuthPageProps) {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] px-4">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 mb-4">
            <span className="material-symbols-outlined text-3xl text-white">
              auto_awesome
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Stick
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            {mode === "login" ? "Sign in to continue" : "Create your account"}
          </p>
        </div>

        <div className="clay-card rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === "register" && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-slate-700 mb-2"
                >
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === "register"}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 text-slate-900 px-4 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">
                    progress_activity
                  </span>
                  Please wait...
                </>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onSwitchMode}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <span className="font-medium text-primary">
                {mode === "login" ? "Sign up" : "Sign in"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
