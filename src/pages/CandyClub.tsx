import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";
import { Link } from "react-router-dom";

const CandyClub = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission
    setTimeout(() => {
      toast({
        title: "Welcome to Candy Club! 🎉",
        description: "Check your email for your first free gift.",
      });
      setEmail("");
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Animated background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-background to-purple-500/10" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container max-w-md mx-auto px-4 py-16">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-glow-primary">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 shadow-lg">
              <Package className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Candy Club
            </h1>
            <p className="text-muted-foreground">
              Get free samples, presets, and exclusive content delivered monthly
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              variant="gradient"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Joining..." : "Join Candy Club 🍬"}
            </Button>
          </form>

          {/* Benefits */}
          <div className="mt-8 pt-6 border-t border-border space-y-3">
            <p className="text-sm font-semibold text-foreground">What you'll get:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-pink-500">✓</span>
                <span>Monthly free samples & presets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500">✓</span>
                <span>Exclusive production tips & tricks</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500">✓</span>
                <span>Early access to new releases</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-500">✓</span>
                <span>Special discounts on premium content</span>
              </li>
            </ul>
          </div>

          {/* Back link */}
          <div className="mt-6 text-center">
            <Link to="/links" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              ← Back to links
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandyClub;
