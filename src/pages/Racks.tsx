import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
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

const Racks = () => {
  const [rackProducts, setRackProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRackProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, original_price, image, category, bpm, key, is_on_sale')
        .eq('category', 'Ableton Racks')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching rack products:', error);
      } else if (data) {
        setRackProducts(data);
      }
      setLoading(false);
    };

    fetchRackProducts();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Ableton Racks
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Professional audio effect racks and instrument racks for Ableton Live
              </p>
            </div>

            {loading ? (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {rackProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    id={product.id}
                    title={product.title}
                    price={product.price}
                    originalPrice={product.original_price}
                    image={product.image}
                    category={product.category}
                    bpm={product.bpm}
                    musicalKey={product.key}
                    isOnSale={product.is_on_sale}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Racks;
