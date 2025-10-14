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
    const descriptions: Record<string, { short: string; full: string; features: string[] }> = {
      "27 OTT Rack": {
        short: "Professional OTT multiband compression rack for Ableton Live",
        full: "This comprehensive OTT rack includes 27 carefully crafted presets designed to add punch, clarity, and character to your productions. Perfect for all genres, from EDM to Hip Hop.",
        features: [
          "27 professionally designed presets",
          "Easy-to-use interface",
          "Compatible with Ableton Live 10+",
          "Instant download",
          "Lifetime updates"
        ]
      },
      "Serum 2 Randomizer Rack": {
        short: "Randomize and discover unique sounds with Serum 2",
        full: "Take your sound design to the next level with this innovative randomizer rack. Generate unique patches, discover happy accidents, and speed up your workflow dramatically.",
        features: [
          "Intelligent parameter randomization",
          "Save your favorite random patches",
          "Works with Serum 2",
          "Ableton Live rack format",
          "Video tutorial included"
        ]
      },
      "Hip Hop Sample Pack": {
        short: "Essential hip hop samples for modern trap and hip hop production",
        full: "A curated collection of hard-hitting drums, melodic loops, and atmospheric textures perfect for trap, hip hop, and urban productions.",
        features: [
          "100+ samples",
          "Drums, loops, and one-shots",
          "Key and BPM labeled",
          "Royalty-free",
          "WAV format"
        ]
      },
      "Deep House Ableton Project File with Deep House Samples - The full deep house project file from my Youtube video": {
        short: "Complete deep house project from our popular YouTube tutorial",
        full: "Learn the art of deep house production with this fully completed Ableton project file. Includes all MIDI, audio, and effects chains from our detailed YouTube breakdown.",
        features: [
          "Full Ableton project file",
          "All samples included",
          "MIDI files included",
          "Mix-ready arrangement",
          "YouTube tutorial link"
        ]
      },
      "1 Knob Build": {
        short: "Simplify complex effects chains with one-knob control",
        full: "This innovative Ableton rack lets you control complex effect chains with a single knob. Perfect for live performances and quick creative adjustments.",
        features: [
          "One-knob control system",
          "Multiple effect chains",
          "Performance-ready",
          "Easy to customize",
          "Tutorial included"
        ]
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
  
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Product Image */}
          <div className="relative aspect-square rounded-lg overflow-hidden bg-card border border-border">
            <img 
              src={image} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">
                  {category}
                </span>
                {bpm && (
                  <span className="text-xs bg-secondary/20 text-secondary px-3 py-1 rounded-full">
                    {bpm} BPM
                  </span>
                )}
                {key && (
                  <span className="text-xs bg-accent/20 text-accent px-3 py-1 rounded-full">
                    {key}
                  </span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-bold mb-4">
                {title}
              </h1>
              
              <p className="text-lg text-muted-foreground mb-6">
                {description.short}
              </p>
              
              <div className="flex items-baseline gap-4 mb-8">
                <span className="text-4xl font-bold text-primary">{price}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                size="lg" 
                className="flex-1"
                onClick={handlePurchase}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {price === "Free" ? "Download Now" : "Buy Now"}
              </Button>
              <Button 
                variant="outline" 
                size="lg"
              >
                <Download className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Features */}
            <div className="border border-border rounded-lg p-6 bg-card">
              <h3 className="font-semibold text-lg mb-4">What's Included:</h3>
              <ul className="space-y-2">
                {description.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary mt-1">✓</span>
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        {/* Full Description */}
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold mb-4">About This Product</h2>
          <p className="text-muted-foreground leading-relaxed">
            {description.full}
          </p>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}