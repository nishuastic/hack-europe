const API_BASE = "http://localhost:8000";

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
  best_match_product?: string;
  best_match_score?: number;
}

export interface Contact {
  name: string;
  role: string;
  linkedin?: string;
}

export interface BuyingSignal {
  signal_type: string;
  description: string;
  strength: "strong" | "moderate" | "weak";
}

export interface ProductMatch {
  id: number;
  lead_id: number;
  product_id: number;
  match_score: number;
  match_reasoning: string;
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
    };

class ApiClient {
  private ws: WebSocket | null = null;
  private wsHandlers: Set<WebSocketMessageHandler> = new Set();

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
    const res = await fetch(`${API_BASE}/api/products`);
    const data = await res.json();
    return data.products;
  }

  async createProduct(product: Omit<Product, "id">): Promise<Product> {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: [product] }),
    });
    const data = await res.json();
    return data.products[0];
  }

  async updateProduct(id: number, product: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    return res.json();
  }

  async deleteProduct(id: number): Promise<void> {
    await fetch(`${API_BASE}/api/products/${id}`, { method: "DELETE" });
  }

  async importProducts(products: Omit<Product, "id">[]): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products }),
    });
    const data = await res.json();
    return data.products;
  }

  async getLeads(): Promise<Lead[]> {
    const res = await fetch(`${API_BASE}/api/leads`);
    const data = await res.json();
    return data.leads;
  }

  async importLeads(
    companies: string[],
  ): Promise<{ leads_created: number; lead_ids: number[]; status: string }> {
    const res = await fetch(`${API_BASE}/api/leads/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companies }),
    });
    return res.json();
  }

  async getLead(id: number): Promise<Lead> {
    const res = await fetch(`${API_BASE}/api/leads/${id}`);
    return res.json();
  }

  async triggerEnrichment(leadId: number): Promise<void> {
    await fetch(`${API_BASE}/api/leads/${leadId}/enrich`, { method: "POST" });
  }

  async generateMatches(): Promise<void> {
    const res = await fetch(`${API_BASE}/api/matches/generate`, {
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

    const res = await fetch(url);
    const data = await res.json();
    return data.matches;
  }

  async generatePitchDeck(leadId: number, productId: number): Promise<void> {
    await fetch(
      `${API_BASE}/api/leads/${leadId}/pitch-deck?product_id=${productId}`,
      { method: "POST" },
    );
  }

  async getPitchDeck(leadId: number): Promise<string> {
    const res = await fetch(`${API_BASE}/api/leads/${leadId}/pitch-deck`);
    return res.text();
  }

  async downloadPitchDeck(leadId: number): Promise<Blob> {
    const res = await fetch(
      `${API_BASE}/api/leads/${leadId}/pitch-deck/download`,
    );
    return res.blob();
  }

  async generateEmail(
    leadId: number,
    productId: number,
  ): Promise<{ subject: string; body: string }> {
    const res = await fetch(
      `${API_BASE}/api/leads/${leadId}/email?product_id=${productId}`,
      { method: "POST" },
    );
    return res.json();
  }

  async generateVoice(leadId: number): Promise<void> {
    await fetch(`${API_BASE}/api/leads/${leadId}/voice`, { method: "POST" });
  }

  async getAnalytics(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/analytics`);
    return res.json();
  }

  async runDiscovery(
    productIds?: number[],
    maxCompanies: number = 20,
  ): Promise<{ status: string; max_companies: number }> {
    const res = await fetch(`${API_BASE}/api/discovery/run`, {
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

  async getCompanyProfile(): Promise<{
    company_name?: string;
    website?: string;
    growth_stage?: string;
    geography?: string;
    value_proposition?: string;
  }> {
    const res = await fetch(`${API_BASE}/api/company-profile`);
    return res.json();
  }

  async saveCompanyProfile(profile: {
    company_name: string;
    website?: string;
    growth_stage?: string;
    geography?: string;
    value_proposition?: string;
  }): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/company-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    return res.json();
  }
}

export const api = new ApiClient();
