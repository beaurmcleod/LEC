import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ExternalLink } from "lucide-react";
import previewEdmCourse from "@/assets/preview-edm-course-new.jpg";
import previewCandyStore from "@/assets/preview-candy-store-new.png";
import previewLesson from "@/assets/preview-lesson.jpg";
import previewFreeCourse from "@/assets/preview-free-course.jpg";
import previewYoutube from "@/assets/preview-youtube.jpg";
import previewBohemyth from "@/assets/preview-bohemyth.png";
import previewCruxChords from "@/assets/preview-crux-chords-new.png";
import previewSkool from "@/assets/preview-skool.png";

const Index = () => {
  const trackClick = async (linkTitle: string, linkUrl: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('link_clicks').insert({
        link_title: linkTitle,
        link_url: linkUrl,
        user_id: user?.id || null,
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  // Primary CTA - most important action
  const primaryLink = {
    title: "Join The Collective",
    description: "Production community for serious producers",
    preview: previewSkool,
    url: "/collective",
    tier: "primary" as const,
  };

  // Secondary CTAs - important but not the main focus
  const secondaryLinks = [
    {
      title: "The Candy Store",
      description: "Samples, presets & Ableton racks",
      preview: previewCandyStore,
      url: "/shop",
      tier: "secondary" as const,
    },
    {
      title: "30 Day EDM Course",
      description: "Master production in 30 days",
      preview: previewEdmCourse,
      url: "https://www.30dayedmproducer.com/",
      external: true,
      tier: "secondary" as const,
    },
    {
      title: "Book a Private Lesson",
      description: "1-on-1 production coaching",
      preview: previewLesson,
      url: "/lessons",
      tier: "secondary" as const,
    },
  ];

  // Tertiary links - resources and social
  const tertiaryLinks = [
    {
      title: "Crux Chords AI",
      description: "AI-powered chord generation",
      preview: previewCruxChords,
      url: "https://ableton-ai-ensemble.lovable.app/chords",
      external: true,
      tier: "tertiary" as const,
    },
    {
      title: "Free Ableton Course",
      description: "Start your journey free",
      preview: previewFreeCourse,
      url: "https://www.30dayedmproducer.com/free-ableton-course",
      external: true,
      tier: "tertiary" as const,
    },
    {
      title: "YouTube",
      description: "Tutorials & techniques",
      preview: previewYoutube,
      url: "https://www.youtube.com/@lowendcandy",
      external: true,
      tier: "tertiary" as const,
    },
    {
      title: "Instagram",
      description: "Daily content",
      preview: previewBohemyth,
      url: "https://www.instagram.com/_bohemyth_/?hl=en",
      external: true,
      tier: "tertiary" as const,
    },
  ];

  type LinkTier = "primary" | "secondary" | "tertiary";
  
  interface LinkItem {
    title: string;
    description: string;
    preview: string;
    url: string;
    tier: LinkTier;
    external?: boolean;
  }

  const renderLink = (link: LinkItem, index: number) => {
    const isPrimary = link.tier === "primary";
    const isSecondary = link.tier === "secondary";
    const isTertiary = link.tier === "tertiary";

    const linkContent = (
      <div className={`flex items-center gap-4 ${isPrimary ? 'gap-5' : ''}`}>
        <div className={`rounded-xl overflow-hidden flex-shrink-0 transition-transform duration-300 group-hover:scale-105 ${
          isPrimary ? 'w-20 h-20 shadow-glow-neon-subtle' : isSecondary ? 'w-16 h-16' : 'w-12 h-12'
        }`}>
          <img 
            src={link.preview} 
            alt={link.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className={`font-semibold tracking-tight transition-colors duration-200 ${
            isPrimary 
              ? 'text-xl text-neon group-hover:text-neon' 
              : isSecondary 
              ? 'text-lg text-foreground group-hover:text-neon' 
              : 'text-base text-muted-foreground group-hover:text-foreground'
          }`}>
            {link.title}
          </h3>
          <p className={`truncate ${
            isPrimary 
              ? 'text-sm text-foreground/70 mt-1' 
              : 'text-sm text-muted-foreground'
          }`}>
            {link.description}
          </p>
        </div>
        {isPrimary ? (
          <ArrowRight className="w-5 h-5 text-neon transition-transform duration-200 group-hover:translate-x-1" />
        ) : link.external ? (
          <ExternalLink className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors duration-200" />
        ) : (
          <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5" />
        )}
      </div>
    );

    const baseClasses = "group block rounded-xl transition-all duration-300";
    
    const tierClasses = isPrimary
      ? "p-5 bg-obsidian border-2 border-neon/40 hover:border-neon shadow-glow-neon-subtle hover:shadow-glow-neon"
      : isSecondary
      ? "p-4 bg-charcoal/50 border border-border/30 hover:border-neon/30 hover:bg-charcoal"
      : "p-3 hover:bg-charcoal/30";

    const className = `${baseClasses} ${tierClasses}`;

    return link.external ? (
      <a
        key={`${link.tier}-${index}`}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          trackClick(link.title, link.url);
          window.open(link.url, '_blank', 'noopener,noreferrer');
        }}
      >
        {linkContent}
      </a>
    ) : (
      <Link
        key={`${link.tier}-${index}`}
        to={link.url}
        className={className}
        onClick={() => trackClick(link.title, link.url)}
      >
        {linkContent}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-true-black">
      <div className="container max-w-lg mx-auto px-5 py-16">
        {/* Above-the-fold identity */}
        <header className="text-center mb-14">
          <div className="mb-6 flex justify-center">
            <img 
              src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png" 
              alt="Low End Candy" 
              className="h-20 w-20 rounded-2xl"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-3">
            Low End Candy
          </h1>
          <p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Tools, education, and systems for producers who want real careers.
          </p>
        </header>

        {/* Primary CTA */}
        <section className="mb-6">
          {renderLink(primaryLink, 0)}
        </section>

        {/* Secondary CTAs */}
        <section className="space-y-3 mb-8">
          {secondaryLinks.map((link, index) => renderLink(link, index))}
        </section>

        {/* Divider */}
        <div className="border-t border-border/20 my-8" />

        {/* Tertiary Links */}
        <section className="space-y-1">
          {tertiaryLinks.map((link, index) => renderLink(link, index))}
        </section>

        {/* Footer */}
        <footer className="mt-16 text-center">
          <p className="text-xs text-muted-foreground/50">
            © 2024 Low End Candy
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
