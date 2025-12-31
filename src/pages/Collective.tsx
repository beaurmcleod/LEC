import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";
const COHORT_START = new Date("2025-01-01T12:00:00");

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = targetDate.getTime() - Date.now();
    return Math.max(0, diff);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = targetDate.getTime() - Date.now();
      setTimeLeft(Math.max(0, diff));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const hours = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, isExpired: timeLeft === 0 };
}

export default function Collective() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const countdown = useCountdown(COHORT_START);

  const scrollToPricing = () => {
    document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-obsidian text-foreground font-sans">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')]" />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center py-12 lg:py-0">
        <div className="container max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Column */}
            <div className="order-2 lg:order-1 space-y-6">
              {/* Countdown Timer */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Next cohort starts in:</span>
                <div className="flex gap-1.5">
                  {[
                    { value: countdown.hours, label: "hrs" },
                    { value: countdown.minutes, label: "min" },
                    { value: countdown.seconds, label: "sec" },
                  ].map((unit, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="bg-neon/10 text-neon font-mono font-bold px-2 py-1 rounded">
                        {String(unit.value).padStart(2, "0")}
                      </span>
                      <span className="text-muted-foreground text-xs">{unit.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-foreground">
                You know how to make a fire loop.
                <br />
                <span className="text-neon">But finishing tracks?</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
                A structure-first system that turns loops into finished records in 30 days.
              </p>

              <ul className="space-y-3 py-2">
                {[
                  "Weekly live streams with real-time mixdowns and feedback",
                  "Full 30 Day EDM Producer curriculum access",
                  "One year Crux Chords subscription included"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <Check className="w-5 h-5 text-neon mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  asChild
                  size="lg"
                  className="bg-neon hover:bg-neon/90 text-neon-foreground font-semibold text-lg h-14 px-8 rounded-xl shadow-glow-neon hover:shadow-glow-neon-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Link to="/collective/join">
                    Join the Next Cohort
                  </Link>
                </Button>
                <button
                  onClick={scrollToPricing}
                  className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 transition-colors"
                >
                  Start with the $0 Standard Tier
                </button>
              </div>
            </div>

            {/* Right Column - Video */}
            <div className="order-1 lg:order-2">
              <div className="relative group">
                <div className="absolute -inset-1 bg-neon/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative aspect-video bg-charcoal rounded-xl overflow-hidden border border-charcoal-light group-hover:border-neon/20 transition-colors duration-300">
                  {!isVideoPlaying ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-charcoal">
                      {/* Poster placeholder */}
                      <div className="absolute inset-0 bg-gradient-to-br from-charcoal-light to-charcoal" />
                      <button
                        onClick={() => setIsVideoPlaying(true)}
                        className="relative z-10 flex flex-col items-center gap-4 group/play"
                      >
                        <div className="w-20 h-20 rounded-full bg-neon flex items-center justify-center shadow-glow-neon group-hover/play:scale-110 transition-transform duration-200">
                          <Play className="w-8 h-8 text-neon-foreground ml-1" fill="currentColor" />
                        </div>
                        <span className="text-foreground font-medium">Watch this first</span>
                      </button>
                    </div>
                  ) : (
                    <iframe
                      src="https://www.youtube.com/embed/wWK0TAbApOA?autoplay=1"
                      title="Low End Candy Collective VSL"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>
              
              {/* CTA under video - visible on larger screens */}
              <div className="hidden lg:block mt-6">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-neon hover:bg-neon/90 text-neon-foreground font-semibold text-lg h-14 rounded-xl shadow-glow-neon hover:shadow-glow-neon-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  <Link to="/collective/join">
                    Join the Next Cohort
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to Get Started */}
      <section className="py-16 bg-charcoal/50 border-y border-charcoal-light">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-xl md:text-2xl font-bold text-center mb-8">
            How to Get Free Access
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Join the Cohort",
                description: "Click the button below to create your free Skool account and join the Low End Candy Collective."
              },
              {
                step: "2",
                title: "Go to the Classroom",
                description: "Once inside, navigate to the Classroom tab to see all available courses."
              },
              {
                step: "3",
                title: "Unlock the Challenge",
                description: "Find the \"30 Day EDM Producer\" course and click \"Unlock with Premium\" to start your journey."
              }
            ].map((item, i) => (
              <div key={i} className="relative p-6 rounded-xl bg-obsidian border border-charcoal-light">
                <div className="absolute -top-3 -left-3 w-8 h-8 bg-neon rounded-full flex items-center justify-center text-neon-foreground font-bold text-sm">
                  {item.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2 mt-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button
              asChild
              size="lg"
              className="bg-neon hover:bg-neon/90 text-neon-foreground font-semibold text-lg h-14 px-10 rounded-xl shadow-glow-neon hover:shadow-glow-neon-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <Link to="/collective/join">
                Join the Cohort — It's Free
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Create your account now. The next cohort kicks off when the timer hits zero.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Recognition Strip */}
      <section className="py-12 bg-charcoal border-y border-charcoal-light">
        <div className="container max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              "You can make a loop that bangs.",
              "But finishing a full track stalls.",
              "This fixes structure first."
            ].map((text, i) => (
              <div 
                key={i} 
                className="text-center md:text-left p-4 rounded-lg border border-charcoal-light bg-charcoal-light/30"
              >
                <p className="text-foreground font-medium">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 bg-obsidian">
        <div className="container max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            What You Get
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Standard Tier */}
            <div className="p-6 rounded-xl bg-charcoal border border-charcoal-light">
              <div className="text-sm text-muted-foreground mb-2">Standard</div>
              <div className="text-3xl font-bold text-foreground mb-4">Free</div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Community & Orientation</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Join other producers and get technical questions answered</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Access to the Free Introductory Ableton Live Course</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Community visibility and discussion access</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 italic">Designed as a preview, not a complete solution</p>
            </div>

            {/* Premium - Featured */}
            <div className="p-6 rounded-xl bg-charcoal border-2 border-neon/50 relative shadow-glow-neon">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neon text-neon-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div className="text-sm text-muted-foreground mb-2">Premium</div>
              <div className="text-3xl font-bold text-foreground mb-4">$47<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <h3 className="text-lg font-semibold text-foreground mb-3">The Core Transformation</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Finish one professional-grade track every 30 days</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Weekly live streams with real-time mixdowns and feedback</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Weekly track reviews</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Monthly drops of sample packs, Serum presets, and Max for Live devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>One year of Crux Chords subscription included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Access to the full 30 Day EDM Producer curriculum</span>
                </li>
              </ul>
            </div>

            {/* VIP Mentorship */}
            <div className="p-6 rounded-xl bg-charcoal border border-charcoal-light relative">
              <div className="absolute -top-3 right-4 bg-secondary/20 text-secondary text-xs font-medium px-2 py-1 rounded-full border border-secondary/30">
                Limited spots
              </div>
              <div className="text-sm text-muted-foreground mb-2">VIP</div>
              <div className="text-3xl font-bold text-foreground mb-4">$297<span className="text-lg font-normal text-muted-foreground">/mo</span></div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Mentorship & Career Acceleration</h3>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Everything included in Premium</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Priority private mentor access via direct messaging</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Unlimited ongoing mentor support (priority-based)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Two private 60-minute monthly calls for music and career review</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>Direct contact hooks with A&R representatives</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-neon mt-0.5 flex-shrink-0" />
                  <span>High-level release, branding, and career strategy guidance</span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4 italic">Application required</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-charcoal">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            Simple, Honest Pricing
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
            Create account → Pick your tier → Immediate access
          </p>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            {/* Standard */}
            <div className="p-6 rounded-xl bg-obsidian border border-charcoal-light text-center">
              <div className="text-2xl font-bold mb-2">Free</div>
              <div className="text-sm text-muted-foreground mb-4">Standard</div>
              <Button
                asChild
                variant="outline"
                className="w-full border-charcoal-light hover:border-neon/50 hover:bg-neon/10"
              >
                <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
                  Get Started Free
                </a>
              </Button>
            </div>

            {/* Premium */}
            <div className="p-6 rounded-xl bg-obsidian border-2 border-neon/50 text-center shadow-glow-neon">
              <div className="text-2xl font-bold mb-2">$47/mo</div>
              <div className="text-sm text-muted-foreground mb-4">Premium</div>
              <Button
                asChild
                className="w-full bg-neon hover:bg-neon/90 text-neon-foreground font-semibold"
              >
                <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
                  Join Premium
                </a>
              </Button>
            </div>

            {/* VIP */}
            <div className="p-6 rounded-xl bg-obsidian border border-charcoal-light text-center">
              <div className="text-2xl font-bold mb-2">$297/mo</div>
              <div className="text-sm text-muted-foreground mb-4">VIP</div>
              <Button
                asChild
                variant="outline"
                className="w-full border-charcoal-light hover:border-neon/50 hover:bg-neon/10"
              >
                <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
                  Apply Now
                </a>
              </Button>
            </div>
          </div>

          {/* Guarantee */}
          <div className="p-6 rounded-xl bg-obsidian border border-neon/20 max-w-xl mx-auto">
            <p className="text-foreground">
              <strong className="text-neon">7-day money back guarantee.</strong>{" "}
              If the Collective isn&apos;t right for you within your first week, email us for a full refund. No questions, no hassle.
            </p>
          </div>
        </div>
      </section>

      {/* 30-Day Challenge Timeline */}
      <section className="py-20 bg-obsidian">
        <div className="container max-w-5xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Inside the 30 Day EDM Producer Curriculum
          </h2>

          <div className="grid md:grid-cols-4 gap-4">
            {[
              { phase: "Week 1", title: "Session Setup", desc: "Configure your template, establish workflow standards, set daily targets." },
              { phase: "Week 2", title: "MIDI Skeleton", desc: "Build the harmonic and rhythmic foundation. No sound design yet." },
              { phase: "Week 3", title: "Arrangement Pass", desc: "Structure the full track. Intro, drops, breakdowns, outro." },
              { phase: "Week 4", title: "Mix + Finalize", desc: "Polish levels, effects, and export your finished record." }
            ].map((item, i) => (
              <div key={i} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-neon/50 to-transparent z-0" />
                )}
                <div className="relative z-10 p-4 rounded-xl bg-charcoal border border-charcoal-light">
                  <div className="w-8 h-8 rounded-full bg-neon/20 text-neon text-sm font-bold flex items-center justify-center mb-3">
                    {i + 1}
                  </div>
                  <div className="text-xs text-neon mb-1">{item.phase}</div>
                  <h3 className="text-foreground font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Weekly Beat Reviews */}
      <section className="py-20 bg-charcoal">
        <div className="container max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-6">
            What Happens on Weekly Beat Reviews
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            You submit your Ableton project file. We review it live. Fix arrangement and mix bottlenecks. 
            You learn by watching your own project get engineered.
          </p>

          {/* Placeholder for screenshot */}
          <div className="aspect-video rounded-xl bg-charcoal-light border border-charcoal-light flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-neon/10 flex items-center justify-center mx-auto mb-4">
                <Play className="w-6 h-6 text-neon" />
              </div>
              <p className="text-sm">Live Review Session Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Founder Statement */}
      <section className="py-20 bg-obsidian">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="p-8 rounded-xl bg-charcoal border border-charcoal-light">
            <h3 className="text-xl font-semibold text-foreground mb-4">Why I Built This</h3>
            <p className="text-muted-foreground leading-relaxed mb-6">
              I spent years stuck in the loop trap—hundreds of 8-bar ideas, zero finished tracks. 
              The breakthrough wasn&apos;t more tutorials or better plugins. It was a system that forced structure first. 
              The Collective is that system, refined over 2 years of teaching producers just like you.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-neon/20 flex items-center justify-center text-neon font-bold">
                LC
              </div>
              <div>
                <div className="text-foreground font-medium">Low End Candy</div>
                <div className="text-sm text-muted-foreground">Founder</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 rounded-lg bg-charcoal border border-charcoal-light text-center">
              <div className="text-sm text-muted-foreground">Community Rule</div>
              <div className="text-foreground font-medium mt-1">No fluff, only action</div>
            </div>
            <div className="p-4 rounded-lg bg-charcoal border border-charcoal-light text-center">
              <div className="text-sm text-muted-foreground">Community Rule</div>
              <div className="text-foreground font-medium mt-1">Ship or share blockers</div>
            </div>
            <div className="p-4 rounded-lg bg-charcoal border border-charcoal-light text-center">
              <div className="text-sm text-muted-foreground">Community Rule</div>
              <div className="text-foreground font-medium mt-1">Feedback is mandatory</div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-charcoal">
        <div className="container max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>

          <Accordion type="single" collapsible className="space-y-3">
            {[
              { q: "Do I need music theory?", a: "No. The system focuses on structure and workflow, not theory. If you can make an 8-bar loop, you have enough knowledge to start." },
              { q: "Do I need expensive monitors or gear?", a: "Headphones work fine. The bottleneck for most producers is finishing tracks, not gear. We focus on completion, not equipment." },
              { q: "What if I'm busy and can't keep up?", a: "The 30-Day Challenge is self-paced. Weekly reviews are recorded if you miss them live. Work at your own speed." },
              { q: "Is this beginner-friendly?", a: "Yes, if you already know the basics of your DAW. This isn't a 'what is EQ' course—it's a system for finishing tracks." },
              { q: "What DAW do you use?", a: "Ableton Live. Project file reviews are done in Ableton. Templates and workflows are Ableton-specific." },
              { q: "How does Crux Chords fit in?", a: "Collective members get 1 year of Crux Chords AI ($97 value) included. It helps generate chord progressions and MIDI patterns to speed up your workflow." },
              { q: "Can I cancel anytime?", a: "Yes. Monthly billing, cancel anytime. No contracts, no penalties." },
              { q: "How does the guarantee work?", a: "Try the Collective for 7 days. If it's not for you, email us for a full refund. No questions asked." }
            ].map((item, i) => (
              <AccordionItem 
                key={i} 
                value={`faq-${i}`}
                className="border border-charcoal-light rounded-lg px-4 bg-obsidian"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-neon hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Transcript */}
      <section className="py-12 bg-obsidian border-t border-charcoal-light">
        <div className="container max-w-3xl mx-auto px-4">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <span className="text-sm">Video Transcript</span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {showTranscript && (
            <div className="mt-6 p-6 rounded-xl bg-charcoal border border-charcoal-light">
              <p className="text-muted-foreground text-sm leading-relaxed">
                [Transcript placeholder - Add your VSL transcript here for accessibility and SEO purposes. 
                This section should contain the full text of your video sales letter.]
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-charcoal">
        <div className="container max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">
            Six Months From Now
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            You&apos;ll either have a catalog of finished tracks and a system that works—or you&apos;ll still be tweaking the same 8-bar loop. 
            The Collective is the difference.
          </p>
          
          <Button
            asChild
            size="lg"
            className="bg-neon hover:bg-neon/90 text-neon-foreground font-semibold text-lg h-14 px-10 rounded-xl shadow-glow-neon hover:shadow-glow-neon-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
              Join the Next Cohort
            </a>
          </Button>

          <p className="text-sm text-muted-foreground mt-6">
            Next cohort starts January 15th · VIP capped at 10 spots
          </p>
        </div>
      </section>

      {/* Legal Footer */}
      <footer className="py-8 bg-obsidian border-t border-charcoal-light">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms of Service</a>
            <span>© {new Date().getFullYear()} Low End Candy</span>
          </div>
        </div>
      </footer>

      {/* Mobile Sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-obsidian/95 backdrop-blur-sm border-t border-charcoal-light lg:hidden z-50">
        <Button
          asChild
          className="w-full bg-neon hover:bg-neon/90 text-neon-foreground font-semibold h-12 rounded-xl shadow-glow-neon"
        >
          <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
            Join the Next Cohort
          </a>
        </Button>
      </div>

      {/* Spacer for mobile sticky CTA */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}
