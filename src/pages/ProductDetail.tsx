import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, ArrowLeft, Download } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
export default function ProductDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const title = searchParams.get("title") || "";
  const price = searchParams.get("price") || "";
  const image = searchParams.get("image") || "";
  const category = searchParams.get("category") || "";
  const bpm = searchParams.get("bpm");
  const key = searchParams.get("key");

  // Product descriptions (you can move this to a separate data file later)
  const getProductDescription = (productTitle: string) => {
    const descriptions: Record<string, {
      short: string;
      full: string;
      features: string[];
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
      "Deep House Ableton Project File with Deep House Samples - The full deep house project file from my Youtube video": {
        short: "Complete deep house project from our popular YouTube tutorial",
        full: "This is the full Ableton project file from our deep house tutorial on YouTube. Includes all MIDI, audio samples, and effect chains so you can learn our complete production process!",
        features: ["Full Ableton project file", "All samples included", "MIDI files included", "Mix-ready arrangement", "YouTube tutorial link"]
      },
      "1 Knob Build": {
        short: "Simplify complex effects chains with one-knob control",
        full: "This innovative Ableton rack lets you control complex effect chains with a single knob. Perfect for live performances and quick creative adjustments. Simplify your workflow!",
        features: ["One-knob control system", "Multiple effect chains", "Performance-ready", "Easy to customize", "Tutorial included"]
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
    const productId = title.toLowerCase().replace(/\s+/g, '-');
    navigate(`/checkout?title=${encodeURIComponent(title)}&price=${encodeURIComponent(price)}&id=${encodeURIComponent(productId)}`);
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
                <span className="text-4xl font-bold text-primary">{price}</span>
              </div>
              
              <div className="mb-8">
                <p className="text-muted-foreground leading-relaxed">
                  {description.full}
                </p>
              </div>
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