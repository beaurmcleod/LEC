import { Button } from "@/components/ui/button";
import { Play, Headphones } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Dark gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-card"></div>
      
      {/* Neon glow accents */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 bg-secondary/25 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
      <div className="absolute top-1/2 right-10 w-24 h-24 bg-accent/20 rounded-full blur-2xl animate-float" style={{animationDelay: '2s'}}></div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img 
            src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
            alt="Low End Candy" 
            className="h-28 w-28 md:h-36 md:w-36 rounded-2xl shadow-glow-primary"
          />
        </div>

        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
          <span className="bg-gradient-hero bg-clip-text text-transparent text-glow-primary">
            Low End Candy
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto">
          Premium sample packs, presets, and loops for 
          <span className="text-primary font-semibold"> Ableton Live</span> producers
        </p>
        
        <p className="text-lg text-muted-foreground mb-10">
          Sweet sounds that make your tracks pop 🍭
        </p>

        {/* CTA Button */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
          <Button 
            size="lg" 
            className="h-14 px-8 text-lg font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-glow-accent"
            asChild
          >
            <a href="#products">
              <Play className="h-5 w-5 mr-2" fill="currentColor" />
              Browse Sounds
            </a>
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="h-14 px-8 text-lg border-primary/50 hover:border-primary hover:bg-primary/10"
            asChild
          >
            <Link to="/free">
              <Headphones className="h-5 w-5 mr-2" />
              Free Downloads
            </Link>
          </Button>
        </div>

        {/* Trust signals */}
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
            <span>Instant Download</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            <span>100% Royalty-Free</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            <span>Lifetime Access</span>
          </div>
        </div>
      </div>
    </section>
  );
};
