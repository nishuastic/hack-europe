const API_BASE = "http://localhost:8000";

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  features?: string[];
  industry_focus?: string;
  pricing_model?: string;
  company_size_target?: string;
  geography?: string;
  stage?: string;
  company_name?: string;
  website?: string;
  example_clients?: string[];
  differentiator?: string;
  current_clients?: { name: string; website: string }[];
}

export interface Lead {
  id: number;
  company_name: string;
  company_url?: string;
  description?: string;
  funding?: string;
  industry?: string;
  revenue?: string;
  employees?: number;
  contacts?: Contact[];
  customers?: string[];
  buying_signals?: BuyingSignal[];
  enrichment_status: string;
  pitch_deck_generated?: boolean;
  email_generated?: boolean;
  voice_generated?: boolean;
  icp_fit_score?: number | null;
  icp_fit_reasoning?: string | null;
}

export interface Contact {
  name: string;
  role: string;
  linkedin?: string;
  email?: string;
}

export interface BuyingSignal {
  signal_type: string;
  description: string;
  strength: "strong" | "moderate" | "weak";
}

export type ProductSnapshot = Product;

export interface ICPProfile {
  id: number;
  product_id: number;
  status: string;
  target_industries?: string[] | null;
  employee_range_min?: number | null;
  employee_range_max?: number | null;
  revenue_range?: string | null;
  funding_stages?: string[] | null;
  geographies?: string[] | null;
  common_traits?: string[] | null;
  anti_patterns?: string[] | null;
  icp_summary?: string | null;
  customers_researched: number;
  created_at: string;
}

export interface GenerationRun {
  id: number;
  created_at: string;
  status: string;
  product_ids: number[];
  product_names: string[];
  lead_count: number;
  max_companies: number;
  product_snapshots?: ProductSnapshot[];
}

export interface ProductMatch {
  id: number;
  lead_id: number;
  product_id: number;
  match_score: number;
  match_reasoning: string;
  conversion_likelihood?: string;
  conversion_reasoning?: string;
  product_name?: string;
}

export interface PitchSlide {
  slide_number: number;
  title: string;
  body_html: string;
  speaker_notes: string;
}

export interface AnalyticsOpportunity {
  lead_id: number;
  company_name: string;
  product_name: string;
  match_score: number;
  icp_score?: number;
  conversion_likelihood: string | null;
}

export interface AnalyticsData {
  total_leads: number;
  enriched_count: number;
  industry_breakdown?: Record<string, number>;
  score_distribution: Record<string, number>;
  avg_match_score_by_product?: Record<string, number>;
  avg_icp_score_by_product?: Record<string, number>;
  signal_frequency: Record<string, number>;
  top_opportunities: AnalyticsOpportunity[];
  top_icp_score?: number | null;
  hours_saved?: number;
  dollars_saved?: number;
  actions_breakdown?: Record<string, number>;
}

export type WebSocketMessageHandler = (msg: WSMessage) => void;

export type WSMessage =
  | {
      type: "agent_thinking";
      lead_id: number;
      round: number;
      action: string;
      detail: string;
      queries?: string[];
    }
  | { type: "cell_update"; lead_id: number; field: string; value: unknown }
  | { type: "enrichment_start"; lead_id: number; company_name: string }
  | {
      type: "enrichment_complete";
      lead_id: number;
      company_name: string;
      rounds: number;
    }
  | { type: "enrichment_error"; lead_id: number; error: string }
  | {
      type: "match_update";
      lead_id: number;
      product_id: number;
      match_score: number;
      match_reasoning: string;
      product_name: string;
    }
  | { type: "linkedin_import_start"; total_connections: number; total_leads: number }
  | { type: "linkedin_match_found"; connection_name: string; company_name: string; confidence: string }
  | { type: "linkedin_outreach_generated"; connection_name: string; company_name: string }
  | { type: "linkedin_import_complete"; total_matches: number; total_outreach_plans: number }
  | { type: "linkedin_import_error"; error: string }
  | { type: "discovery_start"; max_companies: number; product_count: number }
  | { type: "discovery_thinking"; iteration: number; detail: string }
  | { type: "discovery_complete" }
  | { type: "company_discovered"; company_name: string; why_good_fit?: string };

class ApiClient {
  private ws: WebSocket | null = null;
  private wsHandlers: Set<WebSocketMessageHandler> = new Set();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    // Load tokens from localStorage on init
    if (typeof window !== "undefined") {
      this.accessToken = localStorage.getItem("access_token");
      this.refreshToken = localStorage.getItem("refresh_token");
      const userStr = localStorage.getItem("user");
      if (userStr) {
        this.user = JSON.parse(userStr);
      }
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  getUser(): User | null {
    return this.user;
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("user");
    }
  }

  private async refreshTokenIfNeeded(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!res.ok) {
        this.logout();
        return false;
      }

      const data = await res.json();
      this.setTokens(data.access_token, this.refreshToken!);
      return true;
    } catch {
      this.logout();
      return false;
    }
  }

  setTokens(access: string, refresh: string, user?: User) {
    this.accessToken = access;
    this.refreshToken = refresh;
    if (user) this.user = user;

    if (typeof window !== "undefined") {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      if (user) localStorage.setItem("user", JSON.stringify(user));
    }
  }

  private async fetchWithAuth(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    let res = await fetch(url, { ...options, headers });

    // If 401, try to refresh token and retry once
    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshTokenIfNeeded();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${this.accessToken!}`;
        res = await fetch(url, { ...options, headers });
      }
    }

    return res;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Login failed");
    }

    const data: AuthResponse = await res.json();
    this.setTokens(data.access_token, data.refresh_token, data.user);
    return data;
  }

  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || "Registration failed");
    }

    const data: AuthResponse = await res.json();
    this.setTokens(data.access_token, data.refresh_token, data.user);
    return data;
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE}/api/auth/me`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }


  connectWebSocket() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket("ws://localhost:8000/ws/updates");

    this.ws.onopen = () => {
      console.log("WebSocket connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        this.wsHandlers.forEach((handler) => handler(msg));
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting...");
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  onMessage(handler: WebSocketMessageHandler) {
    this.wsHandlers.add(handler);
    return () => this.wsHandlers.delete(handler);
  }

  async getProducts(): Promise<Product[]> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products`);
    const data = await res.json();
    return data.products;
  }

  async createProduct(product: Omit<Product, "id">): Promise<Product> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: [product] }),
    });
    const data = await res.json();
    return data.products[0];
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    return res.json();
  }

  async deleteProduct(id: number): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/products/${id}`, {
      method: "DELETE",
    });
  }

  async importProducts(products: Omit<Product, "id">[]): Promise<Product[]> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
    const data = await res.json();
    return data.products;
  }

  async getGenerationRuns(): Promise<GenerationRun[]> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/generation-runs`);
    const data = await res.json();
    return data.runs;
  }

  async getGenerationRun(id: number): Promise<GenerationRun> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/generation-runs/${id}`);
    return res.json();
  }

  async getLeads(generationRunId?: number): Promise<Lead[]> {
    let url = `${API_BASE}/api/leads`;
    if (generationRunId) url += `?generation_run_id=${generationRunId}`;
    const res = await this.fetchWithAuth(url);
    const data = await res.json();
    return data.leads;
  }

  async importLeads(
    companies: string[],
    generationRunId?: number,
  ): Promise<{ leads_created: number; lead_ids: number[]; status: string }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/leads/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies, generation_run_id: generationRunId }),
    });
    return res.json();
  }

  async getLead(id: number): Promise<Lead> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/leads/${id}`);
    return res.json();
  }

  async triggerEnrichment(leadId: number): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/leads/${leadId}/enrich`, {
      method: "POST",
    });
  }

  async generateMatches(): Promise<void> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/matches/generate`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to generate matches");
  }

  async getMatches(
    leadId?: number,
    productId?: number,
  ): Promise<ProductMatch[]> {
    let url = `${API_BASE}/api/matches`;
    const params = new URLSearchParams();
    if (leadId) params.append("lead_id", leadId.toString());
    if (productId) params.append("product_id", productId.toString());
    if (params.toString()) url += `?${params.toString()}`;

    const res = await this.fetchWithAuth(url);
    const data = await res.json();
    return data.matches;
  }

  async generatePitchDeck(leadId: number, productId: number): Promise<{ pitch_deck_id: number; slides: PitchSlide[]; pptx_path: string }> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck?product_id=${productId}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Generation failed" }));
      throw new Error(err.detail || "Failed to generate pitch deck");
    }
    return res.json();
  }

  async getPitchDeck(leadId: number, productId?: number): Promise<{ id: number; slides: PitchSlide[]; pptx_path: string | null }> {
    const params = productId ? `?product_id=${productId}` : "";
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck${params}`,
    );
    if (!res.ok) throw new Error("Pitch deck not found");
    return res.json();
  }

  async downloadPitchDeck(leadId: number, productId?: number): Promise<Blob> {
    const params = productId ? `?product_id=${productId}` : "";
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck/download${params}`,
    );
    return res.blob();
  }

  async generateEmail(
    leadId: number,
    productId: number,
  ): Promise<{ subject: string; body: string; contact_name: string; contact_role: string }> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/email?product_id=${productId}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Email generation failed" }));
      throw new Error(err.detail || "Failed to generate email");
    }
    return res.json();
  }

  async listEmails(
    leadId: number,
    productId: number,
  ): Promise<{ id: number; subject: string; body: string; contact_name: string; contact_role: string; created_at: string }[]> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/emails?product_id=${productId}`,
    );
    if (!res.ok) return [];
    return res.json();
  }

  async getLatestEmail(
    leadId: number,
    productId: number,
  ): Promise<{ id: number; subject: string; body: string; contact_name: string; contact_role: string; created_at: string } | null> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/email/latest?product_id=${productId}`,
    );
    if (!res.ok) return null;
    return res.json();
  }

  async generateVoice(leadId: number): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/leads/${leadId}/voice`, {
      method: "POST",
    });
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/analytics`);
    return res.json();
  }

  async getGlobalImpact(): Promise<{ total_hours_saved: number; total_dollars_saved: number; total_actions: number; total_customers: number }> {
    const res = await fetch(`${API_BASE}/api/analytics/global-impact`);
    return res.json();
  }

  async getCompanyProfile(): Promise<{
    company_name?: string;
    website?: string;
    growth_stage?: string;
    geography?: string;
    value_proposition?: string;
  }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/company-profile`);
    if (!res.ok) return {};
    return res.json();
  }

  async saveCompanyProfile(profile: {
    company_name: string;
    website?: string;
    growth_stage?: string;
    geography?: string;
    value_proposition?: string;
  }): Promise<unknown> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/company-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to save profile" }));
      throw new Error(err.detail || "Failed to save profile");
    }
    return res.json();
  }

  async runDiscovery(
    productIds?: number[],
    maxCompanies: number = 20,
  ): Promise<{ status: string; max_companies: number }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/discovery/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_ids: productIds,
        max_companies: maxCompanies,
      }),
    });
    if (!res.ok) throw new Error("Failed to start discovery");
    return res.json();
  }

  async discoverMore(
    runId: number,
    maxCompanies: number = 10,
  ): Promise<{ status: string; max_companies: number; generation_run_id: number }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/discovery/run/${runId}/more`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_companies: maxCompanies }),
    });
    if (!res.ok) throw new Error("Failed to start discovery");
    return res.json();
  }

  async getLinkedInMatches(leadId?: number): Promise<LinkedInMatch[]> {
    const params = leadId ? `?lead_id=${leadId}` : "";
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/matches${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.matches;
  }

  async uploadLinkedInArchive(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/import`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail || "Upload failed");
    }
  }

  async importLinkedInDemo(): Promise<void> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/demo`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Demo import failed" }));
      throw new Error(err.detail || "Demo import failed");
    }
  }

  async clearLinkedInConnections(): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/linkedin/connections`, {
      method: "DELETE",
    });
  }

  async autofillProduct(url: string): Promise<Partial<Product>> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/autofill/product`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("Auto-fill failed");
    return res.json();
  }

  async autofillCompanyProfile(url: string): Promise<{
    company_name?: string;
    website?: string;
    growth_stage?: string;
    geography?: string;
    value_proposition?: string;
  }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/autofill/company-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("Auto-fill failed");
    return res.json();
  }

  async getICPProfile(productId: number): Promise<ICPProfile | { status: string }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${productId}/icp`);
    return res.json();
  }

  async updateICPProfile(productId: number, data: Partial<Pick<ICPProfile, "icp_summary" | "target_industries" | "geographies" | "funding_stages" | "revenue_range" | "employee_range_min" | "employee_range_max" | "common_traits" | "anti_patterns">>): Promise<ICPProfile> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${productId}/icp`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update ICP profile");
    return res.json();
  }

  async learnICP(productId: number): Promise<void> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${productId}/learn-icp`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "ICP learning failed" }));
      throw new Error(err.detail || "ICP learning failed");
    }
  }

  // ─── BYOK: API key management ──────────────────────────────────────

  async saveApiKeys(keys: { anthropic_api_key?: string; linkup_api_key?: string }): Promise<void> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/settings/api-keys`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(keys),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to save API keys" }));
      throw new Error(err.detail || "Failed to save API keys");
    }
  }

  async getApiKeys(): Promise<{ anthropic_api_key: string | null; linkup_api_key: string | null }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/settings/api-keys`);
    if (!res.ok) throw new Error("Failed to load API keys");
    return res.json();
  }

  async deleteApiKeys(): Promise<void> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/settings/api-keys`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete API keys");
  }
}

export interface LinkedInOutreachPlan {
  intro_message: string;
  talking_points: string[];
  context: string;
  timing_suggestion: string;
}

export interface LinkedInMatch {
  id: number;
  connection_id: number;
  lead_id: number;
  match_confidence: string;
  status: string;
  outreach_plan: LinkedInOutreachPlan | null;
  connection_name: string;
  connection_position: string | null;
  connection_company: string | null;
  lead_company_name: string;
}

export const api = new ApiClient();
