import { Link } from "react-router-dom";
import { Headphones, Compass, Music2 } from "lucide-react";
import { FeaturedProducts } from "@/components/FeaturedProducts";
import previewEdmCourse from "@/assets/preview-edm-course-new.jpg";
import previewLesson from "@/assets/preview-lesson.jpg";
import previewCandyStore from "@/assets/preview-candy-store-new.png";

const TikTok = () => {
  const links = [
    {
      title: "Key & BPM Detector",
      description: "Drop any audio file. Get the key + BPM instantly. $14.99",
      icon: Music2,
      iconGradient: "from-accent via-primary to-secondary",
      url: "/product/key-bpm-finder",
    },
    {
      title: "The Candy Store",
      description: "Premium samples, presets & Ableton racks",
      preview: previewCandyStore,
      url: "/shop",
      highlighted: true,
    },
    {
      title: "Producer Operating System",
      description: "Resources for building a music production career",
      icon: Compass,
      iconGradient: "from-secondary via-primary to-accent",
      url: "https://producerframework.com/",
      external: true,
    },
    {
      title: "30 Day EDM Production Course",
      description: "A structured curriculum to go from beginner to confident producer",
      preview: previewEdmCourse,
      url: "https://www.30dayedmproducer.com/",
      external: true,
    },
    {
      title: "Book a Private Lesson",
      description: "One-on-one music production coaching via Zoom",
      preview: previewLesson,
      url: "/lessons",
    },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/5" />
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 px-4 py-10 max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="flex justify-center mb-4">
            <img
              src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png"
              alt="Low End Candy"
              className="h-20 w-20 rounded-2xl shadow-glow-primary"
            />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Low End Candy
          </h1>
          <p className="text-sm text-muted-foreground">
            Tools & courses for music producers 🎧
          </p>
        </div>

        {/* Featured product quick-buy */}
        <div className="mb-5">
          <FeaturedProducts heading="Shop the Essentials" />
        </div>

        {/* Links */}
        <div className="space-y-3">
          {links.map((link, index) => {
            const linkContent = (
              <div className="flex items-center gap-3">
                <div className={`w-16 h-16 rounded-lg overflow-hidden shadow-lg flex-shrink-0 flex items-center justify-center ${
                  link.icon ? `bg-gradient-to-br ${link.iconGradient || 'from-primary to-primary/70'}` : 'bg-primary/20'
                }`}>
                  {link.icon ? (
                    <link.icon className="w-8 h-8 text-foreground" />
                  ) : link.preview ? (
                    <img
                      src={link.preview}
                      alt={link.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Headphones className="w-8 h-8 text-primary" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <h3 className="text-base font-semibold text-foreground leading-tight">
                    {link.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {link.description}
                  </p>
                </div>
                <svg
                  className="w-4 h-4 text-muted-foreground flex-shrink-0"
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

            const cls = `group block p-4 rounded-lg active:scale-[0.98] transition-transform duration-150 ${
              link.highlighted
                ? "bg-primary/10 border-2 border-primary/50 shadow-glow-primary"
                : "bg-card border border-border"
            }`;

            return link.external ? (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cls}
              >
                {linkContent}
              </a>
            ) : (
              <Link key={index} to={link.url} className={cls}>
                {linkContent}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center">
          <p className="text-xs text-muted-foreground">
            © 2025 Low End Candy. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TikTok;
