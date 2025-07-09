import { Button } from "@/components/ui/button";
import { Play, Download, Headphones } from "lucide-react";

export const Hero = () => {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-hero opacity-20"></div>
      <div className="absolute inset-0 bg-background/90"></div>
      
      {/* Floating Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-primary/20 rounded-full blur-xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-32 h-32 bg-secondary/20 rounded-full blur-2xl animate-float" style={{animationDelay: '1s'}}></div>
      <div className="absolute top-1/2 right-10 w-16 h-16 bg-accent/30 rounded-full blur-lg animate-float" style={{animationDelay: '2s'}}></div>

      <div className="relative z-10 text-center max-w-4xl mx-auto px-4">
        {/* Logo as Hero Element */}
        <div className="mb-8 flex justify-center">
          <img 
            src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
            alt="Low End Candy" 
            className="h-32 w-32 rounded-2xl shadow-glow-primary animate-pulse-glow"
          />
        </div>

        <h1 className="text-6xl md:text-8xl font-bold mb-6">
          <span className="bg-gradient-hero bg-clip-text text-transparent">
            Low End Candy
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-4 max-w-2xl mx-auto">
          Premium sample packs, presets, and loops for 
          <span className="text-primary font-semibold"> Ableton Live</span> producers
        </p>
        
        <p className="text-lg text-muted-foreground mb-8">
          Sweet sounds that make your tracks pop 🍭
        </p>

        <div className="flex flex-wrap gap-4 justify-center items-center">
          <Button variant="gradient" size="lg" className="text-lg px-8 py-6">
            <Download className="h-5 w-5 mr-2" />
            Browse Sample Packs
          </Button>
          <Button variant="producer" size="lg" className="text-lg px-8 py-6">
            <Headphones className="h-5 w-5 mr-2" />
            Listen to Previews
          </Button>
          <Button variant="outline" size="lg" className="text-lg px-8 py-6">
            <Play className="h-5 w-5 mr-2" />
            Free Downloads
          </Button>
        </div>

        <div className="mt-12 flex justify-center items-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
            Instant Download
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
            Royalty Free
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            24/7 Support
          </div>
        </div>
      </div>
    </section>
  );
};