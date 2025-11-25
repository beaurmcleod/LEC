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
      
      // Convert slug back to approximate title for search
      const searchPattern = slug.replace(/-/g, '%');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('title', `%${searchPattern}%`)
        .maybeSingle();
      
      if (error) throw error;
      return data;
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

  const { title, price, image, category, bpm, key } = product;

  // Product descriptions (you can move this to a separate data file later)
  const getProductDescription = (productTitle: string) => {
    const descriptions: Record<string, {
      short: string;
      full: string;
      features: string[];
      videoUrl?: string;
    }> = {
      "27 OTT Rack": {
        short: "27 OTTs for crazy glitch and bass sound design",
        full: "This Ableton specific rack is a series of 27 OTTs for crazy glitch and bass sound design. Perfect for experimental producers looking to push sonic boundaries and create unique textures.",
        features: ["27 unique OTT configurations", "Optimized for glitch effects", "Perfect for bass sound design", "Ableton Live rack format", "Instant download"]
      },
      "Serum 2 Randomizer Rack": {
        short: "Randomize and discover unique sounds with Serum 2",
        full: "This powerful Ableton rack allows you to randomize parameters in Serum 2 for instant inspiration and unique sound design possibilities. Perfect for discovering new sonic territories!",
        features: ["Intelligent parameter randomization", "Save your favorite random patches", "Works with Serum 2", "Ableton Live rack format", "Video tutorial included"]
      },
      "Hip Hop Sample Pack": {
        short: "Essential hip hop samples for modern trap and hip hop production",
        full: "Over 100 samples ideal for producing hip hop, boom bap, trap or any other sub-genre of rap. This sample pack includes: Kicks, Snares, Percussive elements, Hi-Hats, FX, Synths, Plucks, 808's & More!",
        features: ["100+ samples", "Kicks, Snares & Hi-Hats", "808s & Synths", "FX & Plucks", "Royalty-free WAV format"]
      },
      "Deep House Ableton Project File": {
        short: "Complete deep house project from our popular YouTube tutorial",
        full: "This is the full Ableton project file from our deep house tutorial on YouTube. Includes all MIDI, audio samples, and effect chains so you can learn our complete production process!",
        features: ["Full Ableton project file", "All samples included", "MIDI files included", "Mix-ready arrangement", "YouTube tutorial link"]
      },
      "1 Knob Build": {
        short: "Simplify complex effects chains with one-knob control",
        full: "This innovative Ableton rack lets you control complex effect chains with a single knob. Perfect for live performances and quick creative adjustments. Simplify your workflow!",
        features: ["One-knob control system", "Multiple effect chains", "Performance-ready", "Easy to customize", "Tutorial included"]
      },
      "Bohemyth's 1st Sample Pack": {
        short: "Welcome! Please Enjoy my new sample pack.",
        full: "Bohemyth's 1st Sample Pack - Welcome! Please Enjoy my new sample pack. This collection contains some of my favorite samples throughout the last few years and from some of my favorite projects. Enjoy!",
        features: ["Curated favorite samples", "Years of production gems", "100% Royalty-free", "WAV format", "Instant download"]
      },
      "Bohemyth's Serum (1) Rack": {
        short: "Advanced Serum wavetable control rack for Ableton Live",
        full: "This powerful Ableton rack gives you intuitive control over Serum's wavetable parameters including timbre, speed, hyper, warp, and wavetable position controls. Perfect for creating evolving textures and dynamic sound design!",
        features: ["6 macro controls", "Timbre & Speed control", "Warp parameters", "Wavetable position control", "Ableton Live rack format"]
      },
      "Key & BPM Finder": {
        short: "Your new cheat code for working fast and staying perfectly in tune",
        full: "Key & BPM Detector is your new cheat code for working fast and staying perfectly in tune. Just drop in any track, loop, acapella, or sample and it instantly reads the exact key, BPM, and relative key. No more guessing notes or tapping tempos – you get clean, reliable data in seconds when you're remixing, layering basslines, or prepping DJ edits. Perfect for producers organizing sample libraries or DJs sorting playlists.",
        features: ["Instant key detection", "Accurate BPM analysis", "Relative key finder", "Works with any audio file", "Perfect for DJs & producers"],
        videoUrl: "https://www.youtube.com/embed/SOjierLwIew"
      }
    };
    return descriptions[productTitle] || {
      short: "High-quality production tool",
      full: "Professional-grade resource for music production.",
      features: ["Instant download", "Lifetime updates", "Professional quality"]
    };
  };
  const description = getProductDescription(title);
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