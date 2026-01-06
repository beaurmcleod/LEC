import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import previewEdmCourse from "@/assets/preview-edm-course-new.jpg";
import previewCandyStore from "@/assets/preview-candy-store-new.png";
import previewLesson from "@/assets/preview-lesson.jpg";
import previewFreeCourse from "@/assets/preview-free-course.jpg";
import previewYoutube from "@/assets/preview-youtube.jpg";
import previewBohemyth from "@/assets/preview-bohemyth.png";
import previewCruxChords from "@/assets/preview-crux-chords-new.png";
import previewSkool from "@/assets/preview-skool.png";

const Index = () => {
  // Track clicks only for authenticated users (RLS requires authentication)
  const trackClick = async (linkTitle: string, linkUrl: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Only track if user is authenticated (RLS policy requires auth)
      if (!user) return;
      
      // Validate inputs before sending
      const sanitizedTitle = linkTitle.substring(0, 200);
      const sanitizedUrl = linkUrl.substring(0, 500);
      
      await supabase.from('link_clicks').insert({
        link_title: sanitizedTitle,
        link_url: sanitizedUrl,
        user_id: user.id,
      });
    } catch (error) {
      // Silently fail for tracking - non-critical feature
    }
  };

  const links = [
    {
      title: "Join The Collective",
      description: "Join our production community & level up",
      preview: previewSkool,
      url: "/collective",
      highlighted: true,
    },
    {
      title: "The Candy Store",
      description: "Premium samples, presets & Ableton racks",
      preview: previewCandyStore,
      url: "/shop",
      highlightBlue: true,
    },
    {
      title: "30 Day EDM Production Course",
      description: "Master electronic music production in 30 days",
      preview: previewEdmCourse,
      url: "https://www.30dayedmproducer.com/",
      external: true,
      highlightRed: true,
    },
    {
      title: "Crux Chords Ableton AI Chord Device",
      description: "AI-powered chord generation for Ableton",
      preview: previewCruxChords,
      url: "https://ableton-ai-ensemble.lovable.app/chords",
      external: true,
    },
    {
      title: "Book a Private Lesson With me",
      description: "One-on-one music production coaching",
      preview: previewLesson,
      url: "/lessons",
    },
    {
      title: "Free Ableton Live Course",
      description: "Start your journey with our free course",
      preview: previewFreeCourse,
      url: "https://www.30dayedmproducer.com/free-ableton-course",
      external: true,
    },
    {
      title: "Low End Candy YouTube",
      description: "Tutorials, tips & production techniques",
      preview: previewYoutube,
      url: "https://www.youtube.com/@lowendcandy",
      external: true,
    },
    {
      title: "Follow Bohemyth",
      description: "Connect on Instagram for daily content",
      preview: previewBohemyth,
      url: "https://www.instagram.com/_bohemyth_/?hl=en",
      external: true,
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      
      <div className="relative z-10 container max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Low End Candy
          </h1>
          <p className="text-lg text-muted-foreground">
            Listen ⚡️ Learn ⚡️ Party
          </p>
        </div>

        {/* Links */}
        <div className="space-y-4">
          {links.map((link, index) => {
            const linkContent = (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                  <img 
                    src={link.preview} 
                    alt={link.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                    {link.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {link.description}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            );

            const className = `group block p-6 rounded-lg transition-all duration-300 hover:-translate-y-1 ${
              link.highlighted 
                ? "bg-primary/10 border-2 border-primary/50 hover:border-primary shadow-glow-primary" 
                : link.highlightBlue
                ? "bg-blue-500/10 border-2 border-blue-500/50 hover:border-blue-500 shadow-[0_0_20px_hsl(217_91%_60%/0.3)]"
                : link.highlightRed
                ? "bg-red-500/10 border-2 border-red-500/50 hover:border-red-500 shadow-[0_0_20px_hsl(0_84%_60%/0.3)]"
                : "bg-card border border-border hover:border-primary/50 hover:shadow-glow-primary"
            }`;

            return link.external ? (
              <a
                key={index}
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
                key={index}
                to={link.url}
                className={className}
                onClick={() => trackClick(link.title, link.url)}
              >
                {linkContent}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            © 2024 Low End Candy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
