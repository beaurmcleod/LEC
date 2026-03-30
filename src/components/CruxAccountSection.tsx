import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, Shield, Music } from "lucide-react";
import { useCruxSubscription } from "@/hooks/useCruxSubscription";

export function CruxAccountSection() {
  const { isActive, license, loading, subscription } = useCruxSubscription();
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    if (license?.license_key) {
      navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) return null;
  if (!isActive && !license) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        CRUX Chords
      </h2>

      <Card className="p-6 bg-card border-accent/30">
        {isActive && license ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Shield className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="font-semibold">Active Subscription</p>
                <p className="text-xs text-muted-foreground">
                  {subscription?.cancel_at_period_end ? "Access until" : "Renews"}{" "}
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">License Key</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-muted px-3 py-2 rounded-lg font-mono text-sm tracking-wider">
                  {license.license_key}
                </code>
                <Button variant="ghost" size="icon" onClick={copyKey}>
                  {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.requests_today ?? 0}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.daily_limit ?? 100}</div>
                <div className="text-xs text-muted-foreground">Limit</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.total_requests ?? 0}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/crux-chords/download">
                  <Download className="h-4 w-4 mr-1" /> Download Device
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/crux-chords/api-guide">API Guide</Link>
              </Button>
            </div>
          </div>
        ) : license ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-3">Your CRUX Chords subscription has expired.</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/crux-chords#pricing">Resubscribe</Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
