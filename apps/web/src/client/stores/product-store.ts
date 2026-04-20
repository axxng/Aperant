import { create } from 'zustand';
import { api } from '../lib/api-client';
import type { Product, CreateProductInput, UpdateProductInput } from '@shared/types/product';
import type { SyncResult } from '@shared/types/github';

interface ProductState {
  products: Product[];
  activeProductId: string | null; // null = consolidated view
  isLoading: boolean;
  error: string | null;

  loadProducts: () => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<Product>;
  updateProduct: (id: string, input: UpdateProductInput) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;
  setActiveProduct: (id: string | null) => void;
  syncProduct: (id: string) => Promise<SyncResult>;
  getActiveProduct: () => Product | null;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  activeProductId: null,
  isLoading: false,
  error: null,

  loadProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const products = await api.products.list();
      set({ products, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createProduct: async (input) => {
    const product = await api.products.create(input);
    set((state) => ({ products: [...state.products, product] }));
    return product;
  },

  updateProduct: async (id, input) => {
    const product = await api.products.update(id, input);
    set((state) => ({
      products: state.products.map((p) => (p.id === id ? product : p)),
    }));
    return product;
  },

  deleteProduct: async (id) => {
    await api.products.delete(id);
    set((state) => ({
      products: state.products.filter((p) => p.id !== id),
      activeProductId: state.activeProductId === id ? null : state.activeProductId,
    }));
  },

  setActiveProduct: (id) => set({ activeProductId: id }),

  syncProduct: async (id) => {
    return api.products.sync(id);
  },

  getActiveProduct: () => {
    const { products, activeProductId } = get();
    if (!activeProductId) return null;
    return products.find((p) => p.id === activeProductId) || null;
  },
}));
