import { Button } from "@/components/ui/button";
import { Music, Mail, Instagram, Youtube, Twitter } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img 
                src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
                alt="Low End Candy" 
                className="h-8 w-8 rounded-lg"
              />
              <h3 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Low End Candy
              </h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Premium digital products for music producers and Ableton Live users.
            </p>
            <a 
              href="mailto:beau@lowendcandy.com" 
              className="text-primary hover:text-primary/80 transition-colors flex items-center gap-2 mb-4 text-sm font-medium"
            >
              <Mail className="h-4 w-4" />
              beau@lowendcandy.com
            </a>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon">
                <Instagram className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Youtube className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon">
                <Twitter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Products */}
          <div>
            <h4 className="font-semibold mb-4">Products</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Sample Packs</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Preset Libraries</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Loop Collections</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">MIDI Packs</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Free Downloads</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="space-y-2 text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
              <li><a href="mailto:beau@lowendcandy.com" className="hover:text-primary transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">License Agreement</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Downloads</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-semibold mb-4">Stay Updated</h4>
            <p className="text-muted-foreground mb-4">
              Get the latest releases and exclusive content.
            </p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Your email"
                className="flex-1 px-3 py-2 bg-input border border-border rounded-md text-sm"
              />
              <Button variant="default" size="sm">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Low End Candy. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};