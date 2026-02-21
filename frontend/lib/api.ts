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
  differentiator: string | null;
}

export const MOCK_GENERATION_RUNS: GenerationRun[] = [
  {
    id: 1,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "complete",
    product_ids: [1, 2],
    product_names: ["CloudSync Pro", "DataVault Enterprise"],
    product_snapshots: [
      {
        id: 1,
        name: "CloudSync Pro",
        description: "Enterprise cloud synchronization platform with real-time collaboration features",
        features: ["Real-time sync", "Team collaboration", "Version control", "API access"],
        industry_focus: "Technology",
        pricing_model: "SaaS (monthly)",
        company_size_target: "Mid-market",
        geography: "North America, Europe",
        stage: "scaling",
        company_name: "Acme Corp",
        website: "https://acme.com",
        example_clients: ["TechStart Inc", "DataFlow"],
        differentiator: "Fastest sync speed in market",
      },
      {
        id: 2,
        name: "DataVault Enterprise",
        description: "Secure data storage and backup solution for enterprises",
        features: ["End-to-end encryption", "Automated backups", "Disaster recovery"],
        industry_focus: "Finance, Healthcare",
        pricing_model: "Annual retainer",
        company_size_target: "Enterprise",
        geography: "Global",
        stage: "enterprise",
        company_name: "Acme Corp",
        website: "https://acme.com",
        example_clients: ["BankFirst", "HealthPlus"],
        differentiator: "Bank-grade security certification",
      },
    ],
    lead_count: 18,
    max_companies: 20,
  },
  {
    id: 2,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: "complete",
    product_ids: [3],
    product_names: ["MarketingAI"],
    product_snapshots: [
      {
        id: 3,
        name: "MarketingAI",
        description: "AI-powered marketing automation platform",
        features: ["Campaign optimization", "Audience targeting", "A/B testing"],
        industry_focus: "E-commerce",
        pricing_model: "Usage-based",
        company_size_target: "SMB",
        geography: "US only",
        stage: "startup",
        company_name: "Acme Corp",
        website: "https://acme.com",
        example_clients: ["ShopEasy", "RetailMax"],
        differentiator: "ML-driven optimization",
      },
    ],
    lead_count: 12,
    max_companies: 15,
  },
  {
    id: 3,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "failed",
    product_ids: [1],
    product_names: ["CloudSync Pro"],
    product_snapshots: [
      {
        id: 1,
        name: "CloudSync Pro",
        description: "Enterprise cloud synchronization platform",
        features: ["Real-time sync", "Team collaboration"],
        industry_focus: "Technology",
        pricing_model: "SaaS",
        company_size_target: "Mid-market",
        geography: "North America",
        stage: "scaling",
        company_name: "Acme Corp",
        website: "https://acme.com",
        example_clients: [],
        differentiator: "Fast sync",
      },
    ],
    lead_count: 0,
    max_companies: 20,
  },
];

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
  | { type: "company_discovered"; lead_id: number; company_name: string; why_good_fit: string };

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

  async generatePitchDeck(leadId: number, productId: number): Promise<void> {
    await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck?product_id=${productId}`,
      { method: "POST" },
    );
  }

  async getPitchDeck(leadId: number, productId?: number): Promise<string> {
    const params = productId ? `?product_id=${productId}` : "";
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/pitch-deck${params}`,
    );
    return res.text();
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
  ): Promise<{ subject: string; body: string }> {
    const res = await this.fetchWithAuth(
      `${API_BASE}/api/leads/${leadId}/email?product_id=${productId}`,
      { method: "POST" },
    );
    return res.json();
  }

  async generateVoice(leadId: number): Promise<void> {
    await this.fetchWithAuth(`${API_BASE}/api/leads/${leadId}/voice`, {
      method: "POST",
    });
  }

  async getAnalytics(): Promise<unknown> {
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
}

export const api = new ApiClient();
