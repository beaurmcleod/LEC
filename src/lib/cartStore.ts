import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ttqTrack } from '@/lib/tiktokPixel';

export interface CartItem {
  id: string;
  title: string;
  price: string;
  image: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const items = get().items;
        const exists = items.find(i => i.id === item.id);
        if (!exists) {
          set({ items: [...items, item] });
          ttqTrack.addToCart({ id: item.id, title: item.title, price: item.price });
        }
      },
      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id)
      })),
      clearCart: () => set({ items: [] }),
      getItemCount: () => get().items.length,
    }),
    {
      name: 'low-end-candy-cart',
    }
  )
);
