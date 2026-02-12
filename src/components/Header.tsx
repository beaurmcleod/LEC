import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Search, Menu, User, LogOut, Package, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCartStore } from "@/lib/cartStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

export const Header = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const itemCount = useCartStore((state) => state.getItemCount());

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const navLinks = [
    { to: "/free", label: "Free" },
    { to: "/#products", label: "Sample Packs" },
    { to: "/racks", label: "Racks" },
    { to: "/lessons", label: "Lessons" },
    { to: "/blog", label: "Blog" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <img 
            src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
            alt="Low End Candy" 
            className="h-10 w-10 rounded-lg shadow-glow-primary group-hover:shadow-glow-accent transition-shadow"
          />
          <span className="text-xl font-display font-bold bg-gradient-primary bg-clip-text text-transparent hidden sm:block">
            Low End Candy
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.to}
              to={link.to} 
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hover:text-primary">
            <Search className="h-4 w-4" />
          </Button>
          
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:text-primary">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => navigate("/my-purchases")} className="cursor-pointer">
                  <Package className="h-4 w-4 mr-2" />
                  My Purchases
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" onClick={() => navigate("/auth")} className="hover:text-primary">
              <User className="h-4 w-4" />
            </Button>
          )}

          <Button 
            variant="ghost" 
            size="icon" 
            className="relative hover:text-primary" 
            onClick={() => navigate('/cart')}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Button>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover:text-primary">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-border w-[280px]">
              <div className="flex flex-col gap-6 mt-8">
                {navLinks.map((link) => (
                  <SheetClose key={link.to} asChild>
                    <Link 
                      to={link.to} 
                      className="text-lg font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </SheetClose>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
