import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowLeft, Play } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugToTitle, formatPrice } from "@/lib/utils";
import { ttqTrack } from "@/lib/tiktokPixel";

export default function ProductDetail() {
  const { id: slug } = useParams();
  const navigate = useNavigate();

  // Redirect CRUX Chords product to subscription page
  useEffect(() => {
    if (slug && slug.toLowerCase().includes("crux-chords")) {
      navigate("/crux-chords", { replace: true });
    }
  }, [slug, navigate]);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const words = slug.toLowerCase().split('-').filter(w => w.length > 0);
      
      const { data: products, error } = await supabase
        .from('products')
        .select('*');
      
      if (error) throw error;
      if (!products || products.length === 0) return null;
      
      const matchedProduct = products.find(product => {
        const titleLower = product.title.toLowerCase();
        return words.every(word => titleLower.includes(word));
      });
      
      return matchedProduct || null;
    },
    enabled: !!slug,
  });

  // TikTok ViewContent event - must be before any early returns
  useEffect(() => {
    if (product) {
      ttqTrack.viewContent({ id: product.id, title: product.title, price: product.price });
    }
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
          <p className="text-muted-foreground">Product not found</p>
        </main>
        <Footer />
      </div>
    );
  }

  const { title, price, image, category, bpm, key, short_description, full_description, features } = product;
  const isFree = parseFloat(String(price).replace(/\$/g, '')) === 0 || price?.toLowerCase() === 'free';

  // Use database fields with fallbacks
  const description = {
    short: short_description || "High-quality production tool",
    full: full_description || "Professional-grade resource for music production.",
    features: features || ["Instant download", "Lifetime updates", "Professional quality"],
    videoUrl: title === "Key & BPM Finder" ? "https://www.youtube.com/embed/SOjierLwIew" : undefined
  };

  const handlePurchase = () => {
    navigate(`/enter-email?title=${encodeURIComponent(title)}&price=${encodeURIComponent(price)}&id=${encodeURIComponent(product.id)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 hover:text-primary">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 mb-12">
          {/* Product Image with Play Overlay */}
          <div className="relative aspect-square rounded-lg overflow-hidden bg-card border border-border group">
            <img src={image} alt={title} className="w-full h-full object-cover" />
            
            {/* Play overlay */}
            <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
              <button className="w-24 h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-glow-accent transform scale-90 group-hover:scale-100 transition-transform">
                <Play className="h-12 w-12 ml-1" fill="currentColor" />
              </button>
            </div>
          </div>
          
          {/* Product Info */}
          <div className="space-y-6">
            {/* Category & Technical Data */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs bg-primary/15 text-primary px-3 py-1 rounded-full font-medium">
                {category}
              </span>
              {bpm && (
                <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full font-mono">
                  {bpm} BPM
                </span>
              )}
              {key && (
                <span className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full font-mono">
                  {key}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
              {title}
            </h1>
            
            {/* Short Description */}
            <p className="text-lg text-muted-foreground">
              {description.short}
            </p>
            
            {/* Price Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-3">
                {title === "Key & BPM Finder" ? (
                  <>
                    <span className="text-4xl md:text-5xl font-bold text-accent">{formatPrice(price)}</span>
                    <span className="text-2xl text-muted-foreground line-through font-mono">{formatPrice('19.99')}</span>
                    <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded font-bold uppercase tracking-wide">
                      Sale
                    </span>
                  </>
                ) : (
                  <span className="text-4xl md:text-5xl font-bold text-accent">
                    {formatPrice(price)}
                  </span>
                )}
                <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                  100% Royalty-Free
                </span>
              </div>
              
              {/* Trust Signals */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>📧 Instant email delivery</span>
                <span className="text-border">•</span>
                <span>♾️ Lifetime Access + Free Updates</span>
              </div>
            </div>
            
            {/* Full Description */}
            <div className="py-4 border-t border-border/50">
              <p className="text-muted-foreground leading-relaxed">
                {description.full}
              </p>
            </div>

            {/* Video Preview */}
            {description.videoUrl && (
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
            )}
            
            {/* CTA Button - High Contrast */}
            <Button 
              size="lg" 
              onClick={handlePurchase}
              className="w-full md:w-auto min-w-[200px] h-14 text-lg font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {isFree ? 'Get Free Download' : `Buy Now — ${formatPrice(price)}`}
            </Button>
            
            {/* Features list */}
            {description.features && description.features.length > 0 && (
              <div className="p-5 bg-card rounded-lg border border-border">
                <h3 className="font-display font-semibold text-lg mb-4">What's Included:</h3>
                <ul className="space-y-3">
                  {description.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <span className="text-accent mt-0.5">✓</span>
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
          </div>
        </div>
        
      </main>
      
      <Footer />
    </div>
  );
}
