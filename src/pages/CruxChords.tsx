import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Copy, Music, Zap, Brain, Sparkles, Shield } from "lucide-react";
import { useCruxSubscription } from "@/hooks/useCruxSubscription";
import { useCruxChords } from "@/hooks/useCruxChords";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function CruxChords() {
  const { subscription, license, isActive, loading, actionLoading, subscribe, cancelSubscription } = useCruxSubscription();
  const { plans } = useCruxChords();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  // Check auth on mount
  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  });

  const handleSubscribe = async () => {
    if (!user) {
      navigate("/auth?redirect=/crux-chords");
      return;
    }

    const plan = selectedPlan === "monthly" ? plans.monthly : plans.annual;
    if (!plan) return;

    try {
      const url = await subscribe(plan.slug);
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to start subscription", variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription();
      toast({ title: "Subscription cancelled", description: "Your access continues until the end of the billing period." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to cancel", variant: "destructive" });
    }
  };

  const copyLicense = () => {
    if (license?.license_key) {
      navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "License key copied to clipboard" });
    }
  };

  const features = [
    { icon: Brain, title: "AI-Powered Chords", desc: "Generate musically intelligent chord progressions with OpenAI" },
    { icon: Music, title: "Max for Live Device", desc: "Runs natively inside Ableton Live — drag, drop, create" },
    { icon: Zap, title: "Instant Inspiration", desc: "Break through writer's block with one click" },
    { icon: Sparkles, title: "Genre-Aware", desc: "Outputs chords that fit your style — from lo-fi to techno" },
  ];

  const monthlyPrice = plans.monthly ? (plans.monthly.price_cents / 100).toFixed(2) : "5.00";
  const annualPrice = plans.annual ? (plans.annual.price_cents / 100).toFixed(2) : "39.00";
  const annualMonthly = plans.annual ? (plans.annual.price_cents / 12 / 100).toFixed(2) : "3.25";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="container max-w-5xl mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Max for Live Device
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-primary bg-clip-text text-transparent text-glow-primary">
              CRUX Chords
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10">
            AI-powered chord generation inside Ableton Live. Generate musically intelligent progressions in seconds.
          </p>
          {!isActive && (
            <Button
              size="lg"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-glow-accent/30 text-lg px-8 py-6"
            >
              Get CRUX Chords — from ${annualMonthly}/mo
            </Button>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
            <span className="bg-gradient-primary bg-clip-text text-transparent">Why Producers Love CRUX</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="p-6 bg-card border-border hover:border-primary/30 transition-colors">
                <div className="flex gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-lg mb-1">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Video */}
      <section className="py-16 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-8">
            <span className="bg-gradient-primary bg-clip-text text-transparent">See It In Action</span>
          </h2>
          <div className="aspect-video rounded-xl overflow-hidden border border-border shadow-lg">
            <iframe
              src="https://www.youtube.com/embed/bAnkZfPHNuI"
              title="CRUX Chords Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
              loading="lazy"
            />
          </div>
        </div>
      </section>


      {isActive && license && (
        <section className="py-16 px-4">
          <div className="container max-w-2xl mx-auto">
            <Card className="p-8 bg-card border-accent/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl">Your CRUX License</h3>
                  <p className="text-sm text-muted-foreground">Active subscription</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider">License Key</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted px-4 py-3 rounded-lg font-mono text-sm text-foreground tracking-wider">
                      {license.license_key}
                    </code>
                    <Button variant="ghost" size="icon" onClick={copyLicense}>
                      {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{license.requests_today ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{license.daily_limit ?? 100}</div>
                    <div className="text-xs text-muted-foreground">Daily Limit</div>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{license.total_requests ?? 0}</div>
                    <div className="text-xs text-muted-foreground">All Time</div>
                  </div>
                </div>

                {subscription?.current_period_end && (
                  <p className="text-xs text-muted-foreground text-center">
                    {subscription.cancel_at_period_end ? "Access until" : "Renews"}{" "}
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleCancel}>
                    Cancel Subscription
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Pricing */}
      {!isActive && (
        <section id="pricing" className="py-20 px-4">
          <div className="container max-w-4xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-primary bg-clip-text text-transparent">Simple Pricing</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
              Subscribe to get your license key and start generating chords instantly.
            </p>

            {/* Toggle */}
            <div className="inline-flex bg-muted rounded-full p-1 mb-10">
              <button
                onClick={() => setSelectedPlan("monthly")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedPlan === "monthly"
                    ? "bg-primary text-primary-foreground shadow-glow-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedPlan("annual")}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedPlan === "annual"
                    ? "bg-primary text-primary-foreground shadow-glow-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs opacity-80">Save 35%</span>
              </button>
            </div>

            {/* Price Card */}
            <Card className="max-w-md mx-auto p-8 bg-card border-primary/30">
              <div className="mb-6">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-accent">
                    ${selectedPlan === "monthly" ? monthlyPrice : annualPrice}
                  </span>
                  <span className="text-muted-foreground">
                    /{selectedPlan === "monthly" ? "mo" : "yr"}
                  </span>
                </div>
                {selectedPlan === "annual" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    That's just ${annualMonthly}/month
                  </p>
                )}
              </div>

              <ul className="text-left space-y-3 mb-8">
                {[
                  "AI chord generation inside Ableton",
                  "100 generations per day",
                  "All future updates included",
                  "Cancel anytime",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>

              <Button
                size="lg"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-glow-accent/30"
                onClick={handleSubscribe}
                disabled={actionLoading || loading}
              >
                {actionLoading ? "Redirecting to checkout..." : user ? "Subscribe Now" : "Sign In & Subscribe"}
              </Button>
            </Card>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
