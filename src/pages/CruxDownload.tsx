import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Shield, AlertCircle, Loader2, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCruxSubscription } from "@/hooks/useCruxSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const DOWNLOAD_PATH = "/downloads/CRUX_Chords.amxd";

export default function CruxDownload() {
  const { subscription, license, isActive, loading } = useCruxSubscription();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setAuthLoading(false);
    });
  }, []);

  const isLoading = loading || authLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container max-w-2xl mx-auto px-4 py-16">
        <Link to="/crux-chords" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to CRUX Chords
        </Link>

        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">Download</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-10">
          Get the latest version of the CRUX Chords Max for Live device.
        </p>

        {isLoading ? (
          <Card className="p-12 bg-card border-border flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </Card>
        ) : !user ? (
          <Card className="p-8 bg-card border-border text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-xl font-bold mb-2">Sign in required</h2>
            <p className="text-muted-foreground mb-6">Log in to access your CRUX Chords download.</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/auth?redirect=/crux-chords/download">Sign In</Link>
            </Button>
          </Card>
        ) : !isActive ? (
          <Card className="p-8 bg-card border-border text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Active subscription required</h2>
            <p className="text-muted-foreground mb-6">Subscribe to CRUX Chords to download the device.</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/crux-chords#pricing">View Plans</Link>
            </Button>
          </Card>
        ) : (
          <Card className="p-8 bg-card border-accent/30">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Shield className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl">CRUX Chords — Max for Live</h3>
                <p className="text-sm text-muted-foreground">Latest version • Requires Ableton Live 11+ with Max for Live</p>
              </div>
            </div>

            {/* Subscription Info */}
            {subscription && (
              <div className="bg-muted rounded-lg p-4 mb-6 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-accent">Active</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">
                    {subscription.site_product_slug?.includes("annual") ? "Annual" : "Monthly"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">
                    {subscription.cancel_at_period_end ? "Access until" : "Renews"}
                  </span>
                  <span className="font-medium text-foreground">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </span>
                </div>
                {license && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-muted-foreground">License Key</span>
                    <code className="font-mono text-xs text-primary">{license.license_key}</code>
                  </div>
                )}
              </div>
            )}

            <div className="bg-muted rounded-lg p-4 mb-6 text-sm text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Installation:</strong></p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Download the <code className="text-primary bg-primary/10 px-1 rounded">.amxd</code> file below</li>
                <li>Open Ableton Live and drag the file onto a MIDI track</li>
                <li>Enter your license key and OpenAI API key</li>
                <li>Start generating chords!</li>
              </ol>
            </div>

            <Button
              size="lg"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-glow-accent/30"
              asChild
            >
              <a href={DOWNLOAD_PATH} download>
                <Download className="h-5 w-5 mr-2" />
                Download CRUX Chords (.amxd)
              </a>
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Need help? Check the <Link to="/crux-chords/api-guide" className="text-accent hover:underline">Setup & API Guide</Link> or email beau@lowendcandy.com
            </p>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}
