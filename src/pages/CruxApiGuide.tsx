import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

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

function CodeBlock({ code, language }: { code: string; language: string }) {
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

export default function CruxApiGuide() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container max-w-3xl mx-auto px-4 py-16">
        <Link to="/crux-chords" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to CRUX Chords
        </Link>

        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
          <span className="bg-gradient-primary bg-clip-text text-transparent">API Guide</span>
        </h1>
        <p className="text-lg text-muted-foreground mb-12">
          Reference for the CRUX Chords API endpoints used by the Max for Live device.
        </p>

        {/* Auth Section */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-4">Authentication</h2>
          <p className="text-muted-foreground mb-4">
            All requests require your <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-sm">license_key</code> in the request body. The key is issued when you subscribe and can be found on your{" "}
            <Link to="/crux-chords" className="text-accent hover:underline">dashboard</Link>.
          </p>
          <Card className="p-4 bg-card border-border">
            <p className="text-sm text-muted-foreground mb-2">Base URL</p>
            <CodeBlock code="https://ocydkbblpnshbvkilngl.supabase.co" language="text" />
          </Card>
        </section>

        {/* Endpoints */}
        {codeExamples.map((ex) => (
          <section key={ex.title} className="mb-12">
            <h2 className="font-display text-2xl font-bold mb-2">{ex.title}</h2>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold bg-accent/20 text-accent px-2 py-1 rounded">{ex.method}</span>
              <code className="text-sm text-muted-foreground">{ex.endpoint}</code>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Request Body</p>
                <CodeBlock code={ex.body} language="json" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Response</p>
                <CodeBlock code={ex.response} language="json" />
              </div>
            </div>
          </section>
        ))}

        {/* Rate Limits */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-4">Rate Limits</h2>
          <Card className="p-6 bg-card border-border">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span><strong className="text-foreground">100 requests/day</strong> per license key (resets at midnight UTC)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Exceeding the limit returns a <code className="text-primary bg-primary/10 px-1 rounded">429</code> status</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <span>Check remaining quota via the <code className="text-primary bg-primary/10 px-1 rounded">validate-license</code> endpoint</span>
              </li>
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
