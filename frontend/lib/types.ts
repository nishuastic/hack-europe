export type AppView =
  | { page: 'onboard' }
  | { page: 'dashboard' }
  | { page: 'products' }
  | { page: 'product-edit'; productId?: number }
  | { page: 'generation-run-detail'; runId: number }
  | { page: 'lead-detail'; leadId: number }
  | { page: 'pitch-editor'; leadId: number; productId?: number }
  | { page: 'billing' };
