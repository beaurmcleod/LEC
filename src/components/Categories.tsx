import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Music, Disc, Zap, Waves } from "lucide-react";

export const Categories = () => {
  const categories = [
    {
      title: "Sample Packs",
      description: "High-quality stems and one-shots",
      icon: Music,
      gradient: "bg-gradient-primary",
      count: "150+",
    },
    {
      title: "Preset Libraries",
      description: "Serum, Massive, and Live presets",
      icon: Zap,
      gradient: "bg-gradient-accent",
      count: "500+",
    },
    {
      title: "Loop Collections", 
      description: "Melody and drum loops",
      icon: Disc,
      gradient: "bg-secondary",
      count: "300+",
    },
    {
      title: "MIDI Packs",
      description: "Chord progressions and melodies",
      icon: Waves,
      gradient: "bg-beats",
      count: "200+",
    },
  ];

  return (
    <section className="py-16 px-4 bg-card/30">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-accent bg-clip-text text-transparent">
              Browse by Category
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Find exactly what your track needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card 
                key={index} 
                className="group p-6 hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary cursor-pointer bg-card/50 backdrop-blur-sm"
              >
                <div className={`w-16 h-16 ${category.gradient} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                  {category.title}
                </h3>
                
                <p className="text-muted-foreground text-sm mb-4">
                  {category.description}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    {category.count}
                  </span>
                  <Button variant="ghost" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground">
                    Browse →
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg" className="px-8">
            Explore All Categories
          </Button>
        </div>
      </div>
    </section>
  );
};