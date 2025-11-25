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
  return (
    <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary cursor-pointer" onClick={handleCardClick}>
      <div className="relative">
        {isOnSale && (
          <span className="absolute top-3 left-3 z-10 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-semibold">
            SALE
          </span>
        )}
        
        <div 
          className="aspect-square flex items-center justify-center relative overflow-hidden"
        >
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <Button 
              variant="gradient" 
              size="icon" 
              className="transform scale-75 group-hover:scale-100 transition-all duration-300"
            >
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
            {category}
          </span>
          {bpm && (
            <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full">
              {bpm} BPM
            </span>
          )}
          {musicalKey && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
              {musicalKey}
            </span>
          )}
        </div>

        <h3 className="font-semibold text-lg mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">{price}</span>
            {originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                {originalPrice}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAddToCart}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button variant="default" size="sm" onClick={handlePurchase}>
              Buy Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};