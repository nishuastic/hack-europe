"use client";

import { useState, useEffect } from "react";
import { api, Product, ICPProfile } from "@/lib/api";

interface ProductsProps {
  onEdit: (productId?: number) => void;
}

export default function Products({ onEdit }: ProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [icpProfiles, setIcpProfiles] = useState<Record<number, ICPProfile>>({});
  const [icpLoading, setIcpLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api
      .getProducts()
      .then((prods) => {
        setProducts(prods);
        prods.forEach((p) => {
          if (p.current_clients && p.current_clients.length > 0) {
            api.getICPProfile(p.id).then((res) => {
              if ("status" in res && res.status === "no_icp") return;
              setIcpProfiles((prev) => ({ ...prev, [p.id]: res as ICPProfile }));
            }).catch(() => {});
          }
        });
      })
      .catch((err) => console.error("Failed to load products:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleLearnICP = async (e: React.MouseEvent, productId: number) => {
    e.stopPropagation();
    setIcpLoading((prev) => ({ ...prev, [productId]: true }));
    try {
      await api.learnICP(productId);
      const poll = setInterval(async () => {
        const res = await api.getICPProfile(productId);
        if ("status" in res && res.status !== "no_icp") {
          const profile = res as ICPProfile;
          if (profile.status === "complete" || profile.status === "failed") {
            clearInterval(poll);
            setIcpLoading((prev) => ({ ...prev, [productId]: false }));
            if (profile.status === "complete") {
              setIcpProfiles((prev) => ({ ...prev, [productId]: profile }));
            }
          }
        }
      }, 3000);
    } catch (err) {
      console.error("Failed to start ICP learning:", err);
      setIcpLoading((prev) => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Products &amp; Services
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Manage your product catalog. Click a product to view and edit.
          </p>
        </div>
        <button
          onClick={() => onEdit(undefined)}
          className="px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md flex items-center gap-2 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span> Add
          Product
        </button>
      </div>

      {/* Product Cards */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-5xl text-slate-300">
            inventory_2
          </span>
          <p className="mt-3 text-slate-500">
            No products yet. Add your first product to get started.
          </p>
          <button
            onClick={() => onEdit(undefined)}
            className="mt-4 px-5 py-2.5 rounded-lg bg-slate-900 text-white font-medium text-sm hover:opacity-90 transition-all shadow-md inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>{" "}
            Add Product
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product, idx) => {
            const icp = icpProfiles[product.id];

            return (
              <div
                key={product.id}
                onClick={() => onEdit(product.id)}
                className="clay-card rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer"
              >
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[18px] text-slate-500">
                        inventory_2
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 text-sm truncate">
                          {product.name}
                        </h3>
                        {idx === 0 && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 shrink-0">
                            Primary
                          </span>
                        )}
                        {icp && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300 shrink-0">
                            ICP
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-md">
                        {product.description
                          ? product.description.length > 80
                            ? product.description.slice(0, 80) + "…"
                            : product.description
                          : "No description"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {product.current_clients && product.current_clients.length > 0 && (
                      <button
                        onClick={(e) => handleLearnICP(e, product.id)}
                        disabled={!!icpLoading[product.id]}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                          icp
                            ? "bg-slate-100 text-slate-700 border border-slate-300"
                            : icpLoading[product.id]
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {icp
                            ? "check_circle"
                            : icpLoading[product.id]
                              ? "hourglass_top"
                              : "psychology"}
                        </span>
                        {icp
                          ? "ICP Learned"
                          : icpLoading[product.id]
                            ? "Learning..."
                            : "Learn ICP"}
                      </button>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${product.name}"?`)) return;
                        try {
                          await api.deleteProduct(product.id);
                          setProducts((prev) =>
                            prev.filter((p) => p.id !== product.id),
                          );
                        } catch (err) {
                          console.error("Failed to delete product:", err);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                    <span className="material-symbols-outlined text-[20px] text-slate-300">
                      chevron_right
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add new product button */}
          <button
            onClick={() => onEdit(undefined)}
            className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all group"
          >
            <div className="size-8 rounded-full bg-slate-100 group-hover:bg-slate-900 group-hover:text-white flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">add</span>
            </div>
            <span className="font-medium">Add New Product or Service</span>
          </button>
        </div>
      )}
    </div>
  );
}
