import { Button } from "@/components/ui/button";
import { ShoppingCart, Search, Menu, User } from "lucide-react";
import { Link } from "react-router-dom";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <img 
            src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
            alt="Low End Candy" 
            className="h-10 w-10 rounded-lg shadow-glow-primary animate-float"
          />
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Low End Candy
          </h1>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/free" className="text-foreground hover:text-primary transition-colors">Free</Link>
          <a href="#" className="text-foreground hover:text-primary transition-colors">Sample Packs</a>
          <a href="#" className="text-foreground hover:text-primary transition-colors">Presets</a>
          <a href="#" className="text-foreground hover:text-primary transition-colors">Loops</a>
          <a href="#" className="text-foreground hover:text-primary transition-colors">MIDI Packs</a>
          <a href="#" className="text-foreground hover:text-primary transition-colors">About</a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="relative">
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
              3
            </span>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};