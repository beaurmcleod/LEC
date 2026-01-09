import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowLeft, Download } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugToTitle } from "@/lib/utils";

export default function ProductDetail() {
  const { id: slug } = useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      // Convert slug to searchable words (e.g., "key-bpm-finder" -> ["key", "bpm", "finder"])
      const words = slug.toLowerCase().split('-').filter(w => w.length > 0);
      
      // Get all products and find the best match
      const { data: products, error } = await supabase
        .from('products')
        .select('*');
      
      if (error) throw error;
      if (!products || products.length === 0) return null;
      
      // Find product where all slug words appear in the title
      const matchedProduct = products.find(product => {
        const titleLower = product.title.toLowerCase();
        return words.every(word => titleLower.includes(word));
      });
      
      return matchedProduct || null;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p>Loading...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p>Product not found</p>
        </main>
        <Footer />
      </div>
    );
  }

  const { title, price, image, category, bpm, key, short_description, full_description, features } = product;

  // Use database fields with fallbacks
  const description = {
    short: short_description || "High-quality production tool",
    full: full_description || "Professional-grade resource for music production.",
    features: features || ["Instant download", "Lifetime updates", "Professional quality"],
    videoUrl: title === "Key & BPM Finder" ? "https://www.youtube.com/embed/SOjierLwIew" : undefined
  };
  const handlePurchase = () => {
    navigate(`/checkout?title=${encodeURIComponent(title)}&price=${encodeURIComponent(price)}&id=${encodeURIComponent(product.id)}`);
  };
  return <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Product Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden bg-card border border-border">
            <img src={image} alt={title} className="w-full h-full object-cover" />
          </div>
          
          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">
                  {category}
                </span>
                {bpm && <span className="text-xs bg-secondary/20 text-secondary px-3 py-1 rounded-full">
                    {bpm} BPM
                  </span>}
                {key && <span className="text-xs bg-accent/20 text-accent px-3 py-1 rounded-full">
                    {key}
                  </span>}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {title}
              </h1>
              
              <p className="text-lg text-muted-foreground mb-6">
                {description.short}
              </p>
              
              <div className="flex items-baseline gap-4 mb-4">
                {title === "Key & BPM Finder" ? (
                  <>
                    <span className="text-4xl font-bold text-primary">${price}</span>
                    <span className="text-2xl text-muted-foreground line-through">$19.99</span>
                    <span className="bg-destructive text-destructive-foreground text-sm px-2 py-1 rounded-md font-semibold">
                      BLACK FRIDAY
                    </span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-primary">{price}</span>
                )}
              </div>
              
              <div className="mb-8">
                <p className="text-muted-foreground leading-relaxed">
                  {description.full}
                </p>
              </div>

              {description.videoUrl && (
                <div className="mb-8">
                  <div className="aspect-video rounded-lg overflow-hidden border border-border">
                    <iframe
                      width="100%"
                      height="100%"
                      src={description.videoUrl}
                      title="Product demonstration"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button size="lg" className="flex-1" onClick={handlePurchase}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                {price === "Free" ? "Download Now" : "Buy Now"}
              </Button>
              <Button variant="outline" size="lg">
                <Download className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Features */}
            
          </div>
        </div>
        
      </main>
      
      <Footer />
    </div>;
}