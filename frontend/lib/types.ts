export type AppView =
  | { page: 'onboard' }
  | { page: 'dashboard' }
  | { page: 'products' }
  | { page: 'product-edit'; productId?: number }
  | { page: 'lead-detail'; leadId: number }
  | { page: 'pitch-editor'; leadId: number };
