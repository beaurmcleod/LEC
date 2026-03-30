import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowLeft, Key, Download, Settings, Zap, Shield, Lock } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useCruxSubscription } from "@/hooks/useCruxSubscription";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!" });
  };

  return (
    <div className="relative group">
      <pre className="bg-muted rounded-lg p-4 overflow-x-auto text-sm font-mono text-foreground/90">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-card hover:bg-primary/10"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    </div>
  );
}

function CopyableValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <code className="flex-1 bg-muted px-4 py-3 rounded-lg font-mono text-sm text-foreground tracking-wider break-all">
          {value}
        </code>
        <Button variant="ghost" size="icon" onClick={copy} className="shrink-0">
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

const setupSteps = [
  {
    icon: Key,
    title: "Get your OpenAI API Key",
    description: (
      <>
        Go to{" "}
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          platform.openai.com/api-keys
        </a>{" "}
        and create a new secret key. Copy it — you'll need it in step 3.
      </>
    ),
  },
  {
    icon: Download,
    title: "Download CRUX Chords",
    description: (
      <>
        Head to the{" "}
        <Link to="/crux-chords/download" className="text-accent hover:underline">
          download page
        </Link>{" "}
        and grab the latest .amxd file. Place it in your Ableton User Library.
      </>
    ),
  },
  {
    icon: Settings,
    title: "Add your OpenAI key to the device",
    description: "Open CRUX Chords in Ableton Live. Paste your OpenAI API key into the \"API Key\" field on the device.",
  },
  {
    icon: Shield,
    title: "Enter your License Key",
    description: "Copy your license key from below and paste it into the \"License Key\" field on the device.",
  },
  {
    icon: Zap,
    title: "Generate chords!",
    description: "Type a prompt (e.g. \"4-bar lo-fi progression in C minor\"), hit Generate, and drag the MIDI clip into your arrangement.",
  },
];

const codeExamples = [
  {
    title: "Validate License",
    method: "POST",
    endpoint: "/functions/v1/validate-license",
    body: `{
  "license_key": "CRUX-XXXX-XXXX-XXXX-XXXX",
  "device_id": "optional-device-identifier"
}`,
    response: `{
  "valid": true,
  "daily_limit": 100,
  "requests_today": 12,
  "remaining": 88
}`,
  },
  {
    title: "Generate Chords",
    method: "POST",
    endpoint: "/functions/v1/generate-chords",
    body: `{
  "license_key": "CRUX-XXXX-XXXX-XXXX-XXXX",
  "prompt": "4-bar lo-fi hip hop progression in C minor",
  "genre": "lo-fi",
  "key": "Cm",
  "bars": 4
}`,
    response: `{
  "chords": ["Cm7", "Ab", "Eb", "Bb"],
  "midi_notes": [[60,63,67,70], [56,60,63], [51,55,58], [58,62,65]],
  "requests_remaining": 87
}`,
  },
];

export default function CruxApiGuide() {
  const { subscription, license, isActive, loading } = useCruxSubscription();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-3xl mx-auto px-4 py-32 text-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container max-w-lg mx-auto px-4 py-32 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-3">Subscription Required</h1>
          <p className="text-muted-foreground mb-8">
            You need an active CRUX Chords subscription to access the API guide and setup instructions.
          </p>
          <Button
            onClick={() => navigate("/crux-chords")}
            className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
          >
            Get CRUX Chords
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container max-w-3xl mx-auto px-4 py-16">
        <Link to="/crux-chords" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to CRUX Chords
        </Link>

        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">Setup & API Guide</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-12">
          Get CRUX Chords running in 5 minutes. Your license key and usage stats are below.
        </p>

        {/* License Key + Usage Stats */}
        {license && (
          <section className="mb-16">
            <Card className="p-6 md:p-8 bg-card border-accent/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl">Your License</h2>
                  <p className="text-sm text-muted-foreground">Active subscription</p>
                </div>
              </div>

              <div className="space-y-4">
                <CopyableValue label="License Key" value={license.license_key} />

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
              </div>
            </Card>
          </section>
        )}

        {/* 5-Step Setup Guide */}
        <section className="mb-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-8">
            <span className="bg-gradient-primary bg-clip-text text-transparent">5-Step Setup</span>
          </h2>
          <div className="space-y-6">
            {setupSteps.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {i < setupSteps.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-2" />
                  )}
                </div>
                <div className="pb-6">
                  <h3 className="font-display font-semibold text-lg mb-1">
                    <span className="text-muted-foreground mr-2">Step {i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* API Reference */}
        <section className="mb-16">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent">API Reference</span>
          </h2>
          <p className="text-muted-foreground mb-8">
            Technical reference for the endpoints used by the Max for Live device.
          </p>

          {/* Auth */}
          <div className="mb-8">
            <h3 className="font-display text-xl font-bold mb-3">Authentication</h3>
            <p className="text-muted-foreground mb-4 text-sm">
              All requests require your <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-sm">license_key</code> in the request body.
            </p>
            <Card className="p-4 bg-card border-border">
              <p className="text-sm text-muted-foreground mb-2">Base URL</p>
              <CodeBlock code="https://ocydkbblpnshbvkilngl.supabase.co" />
            </Card>
          </div>

          {/* Endpoints */}
          {codeExamples.map((ex) => (
            <div key={ex.title} className="mb-10">
              <h3 className="font-display text-xl font-bold mb-2">{ex.title}</h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-bold bg-accent/20 text-accent px-2 py-1 rounded">{ex.method}</span>
                <code className="text-sm text-muted-foreground">{ex.endpoint}</code>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Request Body</p>
                  <CodeBlock code={ex.body} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Response</p>
                  <CodeBlock code={ex.response} />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Rate Limits */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-4">Rate Limits</h2>
          <Card className="p-6 bg-card border-border">
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                { text: <><strong className="text-foreground">100 requests/day</strong> per license key (resets at midnight UTC)</> },
                { text: <>Exceeding the limit returns a <code className="text-primary bg-primary/10 px-1 rounded">429</code> status</> },
                { text: <>Check remaining quota via the <code className="text-primary bg-primary/10 px-1 rounded">validate-license</code> endpoint</> },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Error Codes */}
        <section className="mb-16">
          <h2 className="font-display text-2xl font-bold mb-4">Error Codes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Code</th>
                  <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Meaning</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["200", "Success"],
                  ["400", "Bad request — missing or invalid parameters"],
                  ["401", "Invalid or expired license key"],
                  ["429", "Daily rate limit exceeded"],
                  ["500", "Server error — try again later"],
                ].map(([code, desc]) => (
                  <tr key={code} className="border-b border-border/50">
                    <td className="py-3 pr-4">
                      <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">{code}</code>
                    </td>
                    <td className="py-3">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
