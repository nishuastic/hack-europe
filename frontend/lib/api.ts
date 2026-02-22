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
  current_clients?: { name: string; website: string }[];
  differentiator?: string;
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
  company_fit?: string;
  buying_signals?: BuyingSignal[];
  enrichment_status: string;
  pitch_deck_generated?: boolean;
  email_generated?: boolean;
  best_match_product?: string;
  best_match_score?: number;
  icp_fit_score?: number;
  icp_fit_reasoning?: string;
}

export interface ICPProfile {
  id: number;
  product_id: number;
  status: string;
  target_industries?: string[];
  employee_range_min?: number;
  employee_range_max?: number;
  revenue_range?: string;
  funding_stages?: string[];
  geographies?: string[];
  common_traits?: string[];
  anti_patterns?: string[];
  icp_summary?: string;
  customers_researched: number;
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

export interface GenerationRun {
  id: number;
  created_at: string;
  status: string;
  product_ids: number[];
  product_names: string[];
  product_snapshots: ProductSnapshot[];
  lead_count: number;
  max_companies: number;
}

export interface ProductSnapshot {
  id: number;
  name: string;
  description: string;
  features: string[] | null;
  industry_focus: string | null;
  pricing_model: string | null;
  company_size_target: string | null;
  geography: string | null;
  stage: string | null;
  company_name: string | null;
  website: string | null;
  example_clients: string[] | null;
  current_clients: { name: string; website: string }[] | null;
  differentiator: string | null;
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

export interface LinkedInConnection {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  company?: string;
  position?: string;
  connected_on?: string;
}

export interface WarmIntroOutreach {
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
  outreach_plan?: WarmIntroOutreach;
  connection_name: string;
  connection_position?: string;
  connection_company?: string;
  lead_company_name: string;
}

export interface AnalyticsTopOpportunity {
  lead_id: number;
  company_name: string;
  product_id: number;
  product_name: string;
  match_score: number;
  conversion_likelihood: string | null;
}

export interface AnalyticsData {
  total_leads: number;
  enriched_count: number;
  industry_breakdown: Record<string, number>;
  avg_match_score_by_product: Record<string, number>;
  top_opportunities: AnalyticsTopOpportunity[];
  signal_frequency: Record<string, number>;
  score_distribution: Record<string, number>;
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
  | { type: "discovery_start"; product_count: number; max_companies: number }
  | { type: "discovery_thinking"; iteration: number; detail: string }
  | { type: "discovery_complete"; companies_found: number; lead_ids: number[] }
  | { type: "company_discovered"; lead_id: number; company_name: string; why_good_fit: string }
  | { type: "linkedin_import_start"; total_connections: number; total_leads: number }
  | { type: "linkedin_match_found"; connection_name: string; lead_id: number; company_name: string; confidence: string }
  | { type: "linkedin_outreach_generated"; match_id: number; connection_name: string; company_name: string }
  | { type: "linkedin_import_complete"; total_matches: number; total_outreach_plans: number }
  | { type: "linkedin_import_error"; error: string };

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

  async learnICP(productId: number): Promise<{ status: string; customers_to_research: number }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${productId}/learn-icp`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to start ICP learning" }));
      throw new Error(err.detail || `Error: ${res.status}`);
    }
    return res.json();
  }

  async getICPProfile(productId: number): Promise<ICPProfile | { status: "no_icp" }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/products/${productId}/icp`);
    return res.json();
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to fetch leads" }));
      throw new Error(err.detail || `Error: ${res.status}`);
    }
    const data = await res.json();
    return data.leads;
  }

  async importLeads(
    companies: string[],
  ): Promise<{ leads_created: number; lead_ids: number[]; status: string }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/leads/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies }),
    });
    return res.json();
  }

  async getLead(id: number): Promise<Lead> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/leads/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to fetch lead" }));
      throw new Error(err.detail || `Error: ${res.status}`);
    }
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

  async generatePitchDeck(
    leadId: number,
    productId: number,
  ): Promise<{
    pitch_deck_id: number;
    slides: { slide_number: number; title: string; body_html: string; speaker_notes: string }[];
    pptx_path: string;
  }> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck?product_id=${productId}`,
      { method: "POST" },
    );
    return res.json();
  }

  async getPitchDeck(
    leadId: number,
    productId?: number,
  ): Promise<{
    id: number;
    slides: { slide_number: number; title: string; body_html: string; speaker_notes: string }[];
    pptx_path: string | null;
  }> {
    const params = productId ? `?product_id=${productId}` : "";
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck${params}`,
    );
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
    return res.json();
  }

  async getAnalytics(): Promise<AnalyticsData> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/analytics`);
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
    return res.json();
  }

  async uploadLinkedInArchive(file: File): Promise<{ status: string; connections_found: number }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/import`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  }

  async importLinkedInDemo(): Promise<{ status: string; connections_found: number }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/demo`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to start demo import");
    return res.json();
  }

  async getLinkedInConnections(): Promise<LinkedInConnection[]> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/linkedin/connections`);
    const data = await res.json();
    return data.connections;
  }

  async getLinkedInMatches(leadId?: number): Promise<LinkedInMatch[]> {
    let url = `${API_BASE}/api/linkedin/matches`;
    if (leadId) url += `?lead_id=${leadId}`;
    const res = await this.fetchWithAuth(url);
    const data = await res.json();
    return data.matches;
  }

  async clearLinkedInConnections(): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/linkedin/connections`, {
      method: "DELETE",
    });
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

  async getBillingCredits(): Promise<{
    currency: string;
    credits_remaining: number;
    costs: Record<string, number>;
    tiers: Record<string, { label: string; price_id: string; credits: number; eur_display: string; per_credit: string }>;
    payg_packs: Record<string, { label: string; price_id: string; credits: number; eur_display: string; per_credit: string }>;
  }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/billing/credits`);
    return res.json();
  }

  async createTierCheckout(tier: string): Promise<string> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json();
    return data.checkout_url;
  }

  async createPaygCheckout(pack: string): Promise<string> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/billing/buy-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack }),
    });
    const data = await res.json();
    return data.checkout_url;
  }

  async getCredits(): Promise<{ credits_remaining: number }> {
    const res = await this.fetchWithAuth(`${API_BASE}/api/billing/credits`);
    const data = await res.json();
    return { credits_remaining: data.credits_remaining };
  }
}

export const api = new ApiClient();
