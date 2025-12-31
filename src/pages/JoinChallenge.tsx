import { Button } from "@/components/ui/button";
import { ArrowRight, Users, BookOpen, Unlock } from "lucide-react";
import { Link } from "react-router-dom";

const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

const JoinChallenge = () => {
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
      <main className="container max-w-3xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            How to Join the 30 Day Challenge
          </h1>
          <p className="text-muted-foreground text-lg">
            Follow these steps to unlock your free access to the program
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-8">
          {/* Step 1 */}
          <div className="relative p-6 md:p-8 rounded-2xl bg-charcoal/50 border border-charcoal-light">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-neon rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-neon-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-neon font-semibold uppercase tracking-wider mb-1">
                  Step 1
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">
                  Get Accepted into the Group
                </h2>
                <p className="text-muted-foreground mb-4">
                  Click the button below to request access to the Low End Candy Collective on Skool. 
                  Once accepted, you'll have access to the community and all its resources.
                </p>
                <Button
                  asChild
                  className="bg-neon hover:bg-neon/90 text-neon-foreground font-semibold"
                >
                  <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
                    Request to Join on Skool
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-px h-8 bg-charcoal-light" />
          </div>

          {/* Step 2 */}
          <div className="relative p-6 md:p-8 rounded-2xl bg-charcoal/50 border border-charcoal-light">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Step 2
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">
                  Go to the Classroom
                </h2>
                <p className="text-muted-foreground">
                  Once you're accepted, navigate to the <strong className="text-foreground">Classroom</strong> tab 
                  inside the Skool community. This is where all courses are located.
                </p>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-px h-8 bg-charcoal-light" />
          </div>

          {/* Step 3 */}
          <div className="relative p-6 md:p-8 rounded-2xl bg-charcoal/50 border border-charcoal-light">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                <Unlock className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                  Step 3
                </div>
                <h2 className="text-xl md:text-2xl font-bold mb-2">
                  Click "Unlock with Premium"
                </h2>
                <p className="text-muted-foreground mb-4">
                  Find the <strong className="text-foreground">"30 Day EDM Producer"</strong> course and 
                  click the <strong className="text-foreground">"Unlock with Premium"</strong> button. 
                  This will give you instant free access to the full program!
                </p>
                
                {/* Screenshot */}
                <div className="rounded-xl overflow-hidden border border-charcoal-light">
                  <img 
                    src="/lovable-uploads/17f0f6b4-bbf0-451e-a479-5be9e3b0b5bf.png" 
                    alt="Click Unlock with Premium on the 30 Day EDM Producer course"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-12 text-center p-8 rounded-2xl bg-gradient-to-b from-neon/10 to-transparent border border-neon/20">
          <h3 className="text-xl font-bold mb-2">Ready to Start?</h3>
          <p className="text-muted-foreground mb-6">
            The first step is getting accepted into the community
          </p>
          <Button
            asChild
            size="lg"
            className="bg-neon hover:bg-neon/90 text-neon-foreground font-semibold text-lg h-14 px-10 rounded-xl shadow-glow-neon hover:shadow-glow-neon-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <a href={SKOOL_URL} target="_blank" rel="noopener noreferrer">
              Join the Collective on Skool
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default JoinChallenge;
