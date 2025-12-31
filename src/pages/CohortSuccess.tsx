import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";

const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

export default function CohortSuccess() {
  const [searchParams] = useSearchParams();
  const tier = searchParams.get("tier") || "premium";

  return (
    <div className="min-h-screen bg-obsidian text-foreground flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-neon rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow-neon">
          <Check className="w-10 h-10 text-neon-foreground" strokeWidth={3} />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Thank You for Your Purchase!
        </h1>

        <p className="text-muted-foreground text-lg mb-4">
          Your {tier === "vip" ? "VIP Mentorship" : "Premium"} subscription is confirmed.
        </p>
        
        <div className="bg-neon/10 border border-neon/30 rounded-lg p-4 mb-8">
          <p className="text-neon font-medium">
            ⏰ Please allow up to 3 hours for access
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Every membership needs to be manually approved per Skool's spam guidelines.
          </p>
        </div>

        {/* Next Steps */}
        <div className="p-6 rounded-xl bg-charcoal border border-charcoal-light text-left mb-8">
          <h2 className="font-semibold text-foreground mb-4">What happens next:</h2>
          <ol className="space-y-4 text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-neon/20 text-neon rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <span>We'll receive your payment confirmation and add you to the Skool community with {tier === "vip" ? "VIP" : "Premium"} access.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-neon/20 text-neon rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <span>You'll receive an email with your Skool invite within 24 hours (usually much faster).</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-neon/20 text-neon rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <span>Once inside, head to the Classroom to access the 30 Day EDM Producer curriculum.</span>
            </li>
          </ol>
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            asChild
            size="lg"
            className="w-full bg-neon hover:bg-neon/90 text-neon-foreground font-semibold h-12"
          >
            <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
              Go to Skool Community
              <ArrowRight className="w-4 h-4 ml-2" />
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full border-charcoal-light hover:border-neon/50"
          >
            <Link to="/">
              Return to Homepage
            </Link>
          </Button>
        </div>

        {/* Support Note */}
        <p className="text-sm text-muted-foreground mt-8">
          Have questions? Email us at support@lowendcandy.com
        </p>
      </div>
    </div>
  );
}
