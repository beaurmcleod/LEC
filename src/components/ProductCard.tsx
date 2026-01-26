import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { titleToSlug } from "@/lib/utils";
import { useCartStore } from "@/lib/cartStore";
import { toast } from "@/hooks/use-toast";

interface ProductCardProps {
  id: string;
  title: string;
  price: string;
  originalPrice?: string;
  image: string;
  category: string;
  bpm?: string;
  musicalKey?: string;
  isOnSale?: boolean;
}

export const ProductCard = ({ 
  id,
  title, 
  price, 
  originalPrice, 
  image, 
  category, 
  bpm, 
  musicalKey, 
  isOnSale 
}: ProductCardProps) => {
  const navigate = useNavigate();
  const addItem = useCartStore((state) => state.addItem);

  const handleCardClick = () => {
    navigate(`/product/${titleToSlug(title)}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addItem({ id, title, price, image });
    toast({
      title: "Added to cart",
      description: `${title} has been added to your cart`,
    });
  };

  const handlePurchase = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const emailUrl = `/enter-email?title=${encodeURIComponent(title)}&price=${encodeURIComponent(price)}&id=${encodeURIComponent(id)}`;
    navigate(emailUrl);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Navigate to product detail for audio preview
    navigate(`/product/${titleToSlug(title)}`);
  };

  const isFree = parseFloat(price) === 0 || price.toLowerCase() === 'free';

  return (
    <Card 
      className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image with Play Overlay */}
      <div className="relative">
        {isOnSale && (
          <span className="absolute top-3 left-3 z-10 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide">
            Sale
          </span>
        )}
        
        <div className="aspect-square relative overflow-hidden">
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          
          {/* Large Play Button Overlay - Always visible on hover */}
          <div 
            className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center"
            onClick={handlePlayClick}
          >
            <button 
              className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-glow-accent transform scale-90 group-hover:scale-100 transition-all duration-300 hover:bg-accent/90"
              aria-label="Preview audio"
            >
              <Play className="h-10 w-10 md:h-12 md:w-12 ml-1" fill="currentColor" />
            </button>
          </div>
        </div>
      </div>

      {/* Content - F-Pattern Layout */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-display font-semibold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Technical Data - Monospace */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs bg-primary/15 text-primary px-2 py-1 rounded-full font-medium">
            {category}
          </span>
          {bpm && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-mono">
              {bpm} BPM
            </span>
          )}
          {musicalKey && (
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full font-mono">
              {musicalKey}
            </span>
          )}
        </div>

        {/* Trust Signals */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>✓ Royalty-Free</span>
          <span className="text-border">•</span>
          <span>♾️ Lifetime Access</span>
        </div>

        {/* Price & Buy - Side by Side */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-accent">
                {isFree ? 'Free' : `$${price}`}
              </span>
              {originalPrice && parseFloat(originalPrice) > 0 && !isFree && (
                <span className="text-sm text-muted-foreground line-through">
                  ${originalPrice}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">📧 Instant delivery</span>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleAddToCart}
              className="hover:bg-primary/10 hover:text-primary"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button 
              size="sm" 
              onClick={handlePurchase}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-glow-accent/30"
            >
              {isFree ? 'Get Free' : 'Buy Now'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
