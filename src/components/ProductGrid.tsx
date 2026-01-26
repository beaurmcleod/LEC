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

const tabs = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "project-files", label: "Project Files" },
  { id: "sample-packs", label: "Sample Packs" },
  { id: "devices-racks", label: "Devices & Racks" },
];

export const ProductGrid = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, original_price, image, category, bpm, key, is_on_sale, created_at')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
      } else if (data) {
        // Sort: Key & BPM Finder first, then paid products by descending price, then free
        const sortedProducts = data.sort((a, b) => {
          const aPrice = parseFloat(a.price);
          const bPrice = parseFloat(b.price);
          const aIsFree = isNaN(aPrice) || aPrice === 0;
          const bIsFree = isNaN(bPrice) || bPrice === 0;
          
          // Key & BPM Finder always first
          if (a.title === 'Key & BPM Finder') return -1;
          if (b.title === 'Key & BPM Finder') return 1;
          
          // Paid products before free products
          if (aIsFree && !bIsFree) return 1;
          if (!aIsFree && bIsFree) return -1;
          
          // Both paid: sort by descending price
          if (!aIsFree && !bIsFree) return bPrice - aPrice;
          
          // Both free: maintain order
          return 0;
        });
        setProducts(sortedProducts);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  const filterProducts = (products: Product[]) => {
    if (activeTab === "all") return products;
    
    return products.filter((product) => {
      const price = parseFloat(product.price);
      const isFree = isNaN(price) || price === 0;
      const categoryLower = product.category.toLowerCase();
      const titleLower = product.title.toLowerCase();
      
      switch (activeTab) {
        case "free":
          return isFree;
        case "project-files":
          return categoryLower.includes("project") || categoryLower.includes("template");
        case "sample-packs":
          return categoryLower.includes("sample") || categoryLower.includes("midi") || 
                 titleLower.includes("bohemyth") || titleLower.includes("hip hop");
        case "devices-racks":
          return categoryLower.includes("rack") || categoryLower.includes("device") || categoryLower.includes("max");
        default:
          return true;
      }
    });
  };

  if (loading) {
    return (
      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        </div>
      </section>
    );
  }

  const displayProducts = filterProducts(products).map((p) => ({
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
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent text-glow-primary">
              Featured Products
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Hand-crafted sounds designed to elevate your productions
          </p>
        </div>

        {/* Horizontal Filter Bar - Clean Navigation */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full font-medium text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-glow-primary"
                  : "bg-card border border-border hover:border-primary/50 text-foreground hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Product Grid - Single column on mobile, multi on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayProducts.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>

        {displayProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No products found in this category.</p>
          </div>
        )}
      </div>
    </section>
  );
};
