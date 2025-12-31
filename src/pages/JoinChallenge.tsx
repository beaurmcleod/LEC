import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, CreditCard, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

const JoinChallenge = () => {
  const [selectedTier, setSelectedTier] = useState<'premium' | 'vip' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const pricing = {
    premium: {
      monthly: { amount: 47, display: "$47", period: "/mo", billed: "$47 billed monthly" },
      annual: { amount: 397, display: "$33", period: "/mo", billed: "$397 billed annually" }
    },
    vip: {
      monthly: { amount: 297, display: "$297", period: "/mo", billed: "$297 billed monthly" },
      annual: { amount: 2497, display: "$208", period: "/mo", billed: "$2,497 billed annually" }
    }
  };

  const handlePaidCheckout = async () => {
    if (!selectedTier) {
      toast.error("Please select a tier");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-cohort-subscription', {
        body: {
          tier: selectedTier,
          billingPeriod: billingPeriod,
          customerEmail: customerEmail.trim(),
          customerName: customerName.trim()
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Unable to start checkout. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedPrice = () => {
    if (!selectedTier) return { display: "$47", period: "/mo" };
    return pricing[selectedTier][billingPeriod];
  };

  return (
    <div className="min-h-screen bg-obsidian text-foreground">
      {/* Header */}
      <header className="border-b border-charcoal-light">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Link to="/collective" className="text-neon hover:underline text-sm">
            ← Back to Collective
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-4xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Join the Collective
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose how you want to join the 30 Day EDM Producer Challenge
          </p>
        </div>

        {/* Two Options */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Option 1: Free Community */}
          <div className="p-6 md:p-8 rounded-2xl bg-charcoal/50 border border-charcoal-light">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Free Community</h2>
                <p className="text-muted-foreground text-sm">Standard Tier</p>
              </div>
            </div>

            <div className="text-3xl font-bold mb-4">$0</div>

            <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Join the community on Skool</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Access to Free Intro Ableton Course</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Community discussions & support</span>
              </li>
            </ul>

            <Button
              asChild
              variant="outline"
              className="w-full border-charcoal-light hover:border-neon/50 hover:bg-neon/10"
            >
              <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
                Join Free on Skool
              </a>
            </Button>
          </div>

          {/* Option 2: Paid Cohort */}
          <div className="p-6 md:p-8 rounded-2xl bg-charcoal/50 border-2 border-neon/50 relative shadow-glow-neon">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon text-neon-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Full Access
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-neon rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-neon-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Join the Next Cohort</h2>
                <p className="text-muted-foreground text-sm">Premium or VIP</p>
              </div>
            </div>

            {/* Billing Period Toggle */}
            <div className="mb-6">
              <div className="text-sm text-muted-foreground mb-2">Membership</div>
              <div className="grid grid-cols-2 gap-2 relative">
                <div className="absolute -top-2 -right-2 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">
                  Save 30%
                </div>
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    billingPeriod === 'monthly'
                      ? 'border-neon bg-neon/10'
                      : 'border-charcoal-light hover:border-neon/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      billingPeriod === 'monthly' ? 'border-neon' : 'border-muted-foreground'
                    }`}>
                      {billingPeriod === 'monthly' && <div className="w-2 h-2 rounded-full bg-neon" />}
                    </div>
                    <span className="font-medium text-foreground">Monthly</span>
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">
                    {selectedTier ? pricing[selectedTier].monthly.billed : "Billed monthly"}
                  </div>
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    billingPeriod === 'annual'
                      ? 'border-neon bg-neon/10'
                      : 'border-charcoal-light hover:border-neon/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      billingPeriod === 'annual' ? 'border-neon' : 'border-muted-foreground'
                    }`}>
                      {billingPeriod === 'annual' && <div className="w-2 h-2 rounded-full bg-neon" />}
                    </div>
                    <span className="font-medium text-foreground">Annual</span>
                  </div>
                  <div className="text-sm text-muted-foreground pl-6">
                    {selectedTier ? pricing[selectedTier].annual.billed : "Billed annually"}
                  </div>
                </button>
              </div>
            </div>

            {/* Tier Selection */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => setSelectedTier('premium')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  selectedTier === 'premium'
                    ? 'border-neon bg-neon/10'
                    : 'border-charcoal-light hover:border-neon/30'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-foreground">Premium</div>
                    <div className="text-sm text-muted-foreground">Full curriculum + weekly reviews</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {pricing.premium[billingPeriod].display}
                      <span className="text-sm font-normal text-muted-foreground">{pricing.premium[billingPeriod].period}</span>
                    </div>
                    {billingPeriod === 'annual' && (
                      <div className="text-xs text-green-500">$397/year</div>
                    )}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedTier('vip')}
                className={`w-full p-4 rounded-xl border text-left transition-all ${
                  selectedTier === 'vip'
                    ? 'border-neon bg-neon/10'
                    : 'border-charcoal-light hover:border-neon/30'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-foreground">VIP Mentorship</div>
                    <div className="text-sm text-muted-foreground">Everything + 1-on-1 calls & priority support</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">
                      {pricing.vip[billingPeriod].display}
                      <span className="text-sm font-normal text-muted-foreground">{pricing.vip[billingPeriod].period}</span>
                    </div>
                    {billingPeriod === 'annual' && (
                      <div className="text-xs text-green-500">$2,497/year</div>
                    )}
                  </div>
                </div>
              </button>
            </div>

            {/* Customer Info */}
            <div className="space-y-4 mb-6">
              <div>
                <Label htmlFor="name" className="text-sm text-muted-foreground">Your Name</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Doe"
                  className="mt-1 bg-obsidian border-charcoal-light"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm text-muted-foreground">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="mt-1 bg-obsidian border-charcoal-light"
                />
              </div>
            </div>

            <Button
              onClick={handlePaidCheckout}
              disabled={!selectedTier || isLoading}
              className="w-full bg-neon hover:bg-neon/90 text-neon-foreground font-semibold h-12"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Join {selectedTier ? (selectedTier === 'premium' ? 'Premium' : 'VIP') : 'Cohort'} - {getSelectedPrice().display}{getSelectedPrice().period}
                  {billingPeriod === 'annual' && selectedTier && (
                    <span className="ml-1 text-xs opacity-75">
                      ({selectedTier === 'premium' ? '$397' : '$2,497'}/yr)
                    </span>
                  )}
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-3">
              Secure payment via Stripe. {billingPeriod === 'monthly' ? 'Cancel anytime.' : 'Billed annually.'}
            </p>
            
            {billingPeriod === 'annual' && (
              <div className="mt-4 p-3 rounded-lg bg-green-600/10 border border-green-600/30 text-center">
                <p className="text-sm text-green-500">
                  🎓 Annual members get access to exclusive educational discounts on plugins, samples & gear
                </p>
              </div>
            )}
          </div>
        </div>

        {/* What's included comparison */}
        <div className="p-6 rounded-xl bg-charcoal border border-charcoal-light">
          <h3 className="font-semibold text-center mb-4">What's included in paid tiers:</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Full 30 Day EDM Producer curriculum</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Weekly live streams & mixdown feedback</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Weekly track reviews</span>
              </li>
            </ul>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>Monthly sample packs & presets</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>1 year Crux Chords subscription</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                <span>7-day money back guarantee</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-charcoal-light">
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Questions? Email us at support@lowendcandy.com
          </p>
        </div>
      </footer>
    </div>
  );
};

export default JoinChallenge;
