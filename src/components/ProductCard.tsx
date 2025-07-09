import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Download, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductCardProps {
  title: string;
  price: string;
  originalPrice?: string;
  image: string;
  category: string;
  bpm?: string;
  key?: string;
  isOnSale?: boolean;
}

export const ProductCard = ({ 
  title, 
  price, 
  originalPrice, 
  image, 
  category, 
  bpm, 
  key, 
  isOnSale 
}: ProductCardProps) => {
  const handlePurchase = async () => {
    try {
      toast({
        title: "Processing...",
        description: "Redirecting to checkout",
      });

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          productTitle: title,
          price: price,
          productId: title.toLowerCase().replace(/\s+/g, '-'),
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    }
  };
  return (
    <Card className="group overflow-hidden bg-card border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary">
      <div className="relative">
        {isOnSale && (
          <span className="absolute top-3 left-3 z-10 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-semibold">
            SALE
          </span>
        )}
        
        <div className="aspect-square bg-gradient-accent p-8 flex items-center justify-center relative overflow-hidden">
          <img 
            src={image} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
            <Button 
              variant="gradient" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300"
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
          {key && (
            <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
              {key}
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
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="default" size="sm" onClick={handlePurchase}>
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};