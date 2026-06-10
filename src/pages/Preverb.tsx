import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Waves, Download, SlidersHorizontal, Layers, Sparkles, Zap, Check, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function Preverb() {
  const navigate = useNavigate();
  // One-time purchase: the price + checkout are driven by the `products` table row
  // (create-payment-intent derives the amount server-side from products.price by id).
  const [product, setProduct] = useState<{ id: string; price: string } | null>(null);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, price")
      .eq("site", "lowendcandy")
      .ilike("title", "Preverb")
      .maybeSingle()
      .then(({ data }) => setProduct(data as any));
  }, []);

  const price = product?.price ? parseFloat(product.price).toFixed(2) : "29.00";

  const buy = () => {
    if (!product) {
      document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate(
      `/enter-email?title=${encodeURIComponent("Preverb")}&price=${encodeURIComponent(price)}&id=${encodeURIComponent(product.id)}`
    );
  };

  const features = [
    { icon: Waves, title: "Reverse Reverb", desc: "Builds a reverb that swells IN toward your sound instead of trailing after it — the reverse-tail bloom, as an instant insert." },
    { icon: Download, title: "Capture & Print", desc: "Arm CAPTURE, play your sound, and the printed pre-verb lands in a drop zone you drag straight into your DAW as a WAV." },
    { icon: SlidersHorizontal, title: "Pitch + Formant", desc: "Shift the reverb's pitch and its formant/timbre independently — or link them for natural, chipmunk-free transposition." },
    { icon: Layers, title: "6 Reverb Characters", desc: "Hall, Room, Plate, Cathedral, Ambience, and Spring — each with its own swell envelope and tone." },
    { icon: Sparkles, title: "Presets + A/B", desc: "Six dialed-in presets, A/B compare, a draggable swell curve, and true latency-compensated bypass." },
    { icon: Zap, title: "Mac + Windows", desc: "Universal VST3 + AU on macOS, VST3 on Windows. One license unlocks every format on both platforms." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="container max-w-6xl mx-auto px-4 relative z-10 flex flex-col items-center text-center gap-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm font-medium mb-6">
              <Waves className="h-4 w-4" />
              Reverse Reverb · VST3 · AU
            </div>
            <h1 className="font-display text-6xl md:text-8xl font-bold mb-6">
              <span className="bg-gradient-primary bg-clip-text text-transparent text-glow-primary">
                Preverb
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Reverb that swells <span className="text-foreground font-semibold">into</span> your sound. Build the reverse‑tail bloom in front of a vocal, drum, or sample — then capture and drag it into your DAW.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={buy}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold shadow-glow-accent/30 text-lg px-8 py-6"
              >
                Get Preverb — ${price}
              </Button>
              <span className="text-sm text-muted-foreground">One‑time · lifetime license · Mac + Windows</span>
            </div>
          </div>

          <div className="w-full max-w-4xl aspect-[1280/1000] rounded-2xl border border-border shadow-2xl overflow-hidden bg-card/50">
            <img
              src="/lovable-uploads/preverb-ui.png"
              alt="Preverb reverse-reverb plugin interface"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-12">
            <span className="bg-gradient-primary bg-clip-text text-transparent">Everything in the box</span>
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

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-10">
            <span className="bg-gradient-primary bg-clip-text text-transparent">How it works</span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              { n: "01", t: "Drop it on a track", d: "Insert Preverb on a vocal, drum, or one-shot. Pick a character and shape the swell on the live curve." },
              { n: "02", t: "Dial the bloom", d: "Length, Shape, Tone, Width, Pitch + Formant — the reverb crests right as your sound hits, perfectly time-aligned." },
              { n: "03", t: "Capture & drag out", d: "Hit CAPTURE to print the pre-verb, then drag the rendered WAV straight into your session. Done." },
            ].map((s) => (
              <Card key={s.n} className="p-6 bg-card border-border">
                <div className="text-accent font-mono text-sm mb-2">{s.n}</div>
                <h3 className="font-display font-semibold text-lg mb-1">{s.t}</h3>
                <p className="text-muted-foreground text-sm">{s.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent">Yours forever</span>
          </h2>
          <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
            One payment, no subscription. Every format, both platforms, all future updates.
          </p>

          <Card className="max-w-md mx-auto p-8 bg-card border-primary/30">
            <div className="mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold text-accent">${price}</span>
                <span className="text-muted-foreground">one‑time</span>
              </div>
            </div>

            <ul className="text-left space-y-3 mb-8">
              {[
                "macOS VST3 + AU (universal — Apple Silicon & Intel)",
                "Windows VST3",
                "Perpetual license — yours forever",
                "All future updates included",
                "Instant download + license key",
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
              onClick={buy}
            >
              Get Preverb — ${price}
            </Button>

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4">
              <Shield className="h-3.5 w-3.5" />
              Secure checkout · license delivered instantly
            </p>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
