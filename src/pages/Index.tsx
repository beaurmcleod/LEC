import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HelpCircle, User, BookOpen, ShoppingBag, GraduationCap, Music, Video, Calendar, Instagram, Youtube, ExternalLink } from "lucide-react";
import previewEdmCourse from "@/assets/preview-edm-course-new.jpg";
import previewCandyStore from "@/assets/preview-candy-store-new.png";
import previewLesson from "@/assets/preview-lesson.jpg";
import previewFreeCourse from "@/assets/preview-free-course.jpg";
import previewYoutube from "@/assets/preview-youtube.jpg";
import previewBohemyth from "@/assets/preview-bohemyth.png";
import previewCruxChords from "@/assets/preview-crux-chords-new.png";
import previewSkool from "@/assets/preview-skool.png";
import { ReviewsSection } from "@/components/ReviewsSection";
import { FeaturedProducts } from "@/components/FeaturedProducts";

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
      title: "Producer Operating System",
      description: "Resources for building a music production career",
      icon: BookOpen,
      iconGradient: "from-samples to-samples/70",
      url: "https://producerframework.com/",
      external: true,
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
      description: "A structured curriculum for electronic music production",
      preview: previewEdmCourse,
      url: "https://www.30dayedmproducer.com/",
      external: true,
      highlightRed: true,
    },
    {
      title: "Join The Collective",
      description: "Join our production community & level up",
      preview: previewSkool,
      url: "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450",
      external: true,
      highlighted: true,
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
    {
      title: "About Bohemyth",
      description: "Learn more about my background & credentials",
      icon: User,
      iconGradient: "from-secondary to-secondary/70",
      url: "/bio",
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

        {/* Featured Products */}
        <FeaturedProducts heading="Shop the Essentials" className="mb-12" />

        {/* Links */}
        <div className="space-y-4">
          {links.map((link, index) => {
            const linkContent = (
              <div className="flex items-center gap-4">
                <div className={`w-20 h-20 rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0 flex items-center justify-center ${
                  link.icon ? `bg-gradient-to-br ${link.iconGradient || 'from-primary to-primary/70'}` : 'bg-muted'
                }`}>
                  {link.icon ? (
                    <link.icon className="w-9 h-9 text-foreground" />
                  ) : link.preview ? (
                    <img 
                      src={link.preview} 
                      alt={link.title}
                      className="w-full h-full object-cover"
                    />
                  ) : null}
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
                onClick={() => trackClick(link.title, link.url)}
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

        {/* Reviews */}
        <ReviewsSection />

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
