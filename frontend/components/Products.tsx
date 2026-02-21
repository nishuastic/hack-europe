'use client';

import { useState, useEffect } from 'react';
import { api, Product } from '@/lib/api';

interface ProductsProps {
  onEdit: (productId?: number) => void;
}

const DEMO_PRODUCTS: Product[] = [
  { id: 1, name: 'ChurnPredict', description: 'AI-powered analytics dashboard that predicts which customers are likely to cancel.', features: ['Real-time usage tracking', 'Automated email triggers'], differentiator: '94% accuracy in predicting churn' },
  { id: 2, name: 'RetainFlow', description: 'Enterprise retention workflow automation platform.', features: ['Custom workflows', 'CRM integration'], differentiator: 'End-to-end retention pipeline' },
];

export default function Products({ onEdit }: ProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProducts()
      .then(setProducts)
      .catch(() => setProducts(DEMO_PRODUCTS))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Products &amp; Services</h1>
          <p className="text-slate-500 text-sm md:text-base max-w-2xl leading-relaxed">
            Manage your product catalog. The AI uses these to match and generate tailored pitch decks.
          </p>
        </div>
        <button
          onClick={() => onEdit(undefined)}
          className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Add Product
        </button>
      </div>

      {/* Product Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
          <p className="mt-3 text-slate-500">No products yet. Add your first product to get started.</p>
          <button
            onClick={() => onEdit(undefined)}
            className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span> Add Product
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {products.map((product, idx) => (
            <div
              key={product.id}
              onClick={() => onEdit(product.id)}
              className="clay-card rounded-2xl overflow-hidden cursor-pointer hover:shadow-md transition-all duration-200 group"
            >
              <div className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="cursor-grab text-slate-300 hover:text-slate-500 transition-colors">
                    <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">{idx + 1}. {product.name}</h3>
                  {idx === 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 border border-green-200">Primary</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(product.id); }}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
              <div className="px-6 pb-5">
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{product.description}</p>
                {product.features && product.features.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {product.features.map((f, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Add new product button */}
          <button
            onClick={() => onEdit(undefined)}
            className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="size-8 rounded-full bg-slate-100 group-hover:bg-primary group-hover:text-white flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </div>
            <span className="font-medium">Add New Product or Service</span>
          </button>
        </div>
      )}
    </div>
  );
}
