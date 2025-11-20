import { ProductCard } from "./ProductCard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  title: string;
  price: string;
  original_price?: string;
  image: string;
  category: string;
  bpm?: string;
  key?: string;
  is_on_sale?: boolean;
}

export const ProductGrid = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, original_price, image, category, bpm, key, is_on_sale, created_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
      } else if (data) {
        // Sort: paid products first (by created_at), then free products
        const sortedProducts = data.sort((a, b) => {
          const aPrice = parseFloat(a.price);
          const bPrice = parseFloat(b.price);
          const aIsFree = isNaN(aPrice) || aPrice === 0;
          const bIsFree = isNaN(bPrice) || bPrice === 0;
          
          // If one is free and other is paid, paid comes first
          if (aIsFree && !bIsFree) return 1;
          if (!aIsFree && bIsFree) return -1;
          
          // Both same type (both paid or both free), maintain created_at order
          return 0;
        });
        setProducts(sortedProducts);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </section>
    );
  }

  const displayProducts = products.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    originalPrice: p.original_price,
    image: p.image,
    category: p.category,
    bpm: p.bpm,
    musicalKey: p.key,
    isOnSale: p.is_on_sale,
  }));

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Featured Products
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Hand-crafted sounds designed to elevate your productions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-lg font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-8">
            View All Products
          </button>
        </div>
      </div>
    </section>
  );
};