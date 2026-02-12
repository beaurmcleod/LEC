import { Link } from "react-router-dom";
import { Headphones } from "lucide-react";
import previewEdmCourse from "@/assets/preview-edm-course-new.jpg";
import previewLesson from "@/assets/preview-lesson.jpg";
import previewCruxChords from "@/assets/preview-crux-chords-new.png";

const TikTok = () => {
  const links = [
    {
      title: "Key & BPM Finder",
      description: "Instantly detect the key and BPM of any sample or track",
      preview: "/lovable-uploads/key-bpm-finder.png",
      url: "/product/key-bpm-finder",
      highlighted: true,
    },
    {
      title: "Crux Chords – AI Chord Device",
      description: "AI-powered chord generation for Ableton Live",
      preview: previewCruxChords,
      url: "https://promptmidi.shop/",
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
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative z-10 container max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <div className="flex justify-center mb-6">
            <img
              src="/lovable-uploads/85f899cb-b6ef-4b15-a096-6ca3abdfa412.png"
              alt="Low End Candy"
              className="h-24 w-24 rounded-2xl shadow-glow-primary"
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Low End Candy
          </h1>
          <p className="text-lg text-muted-foreground">
            Tools & courses for music producers 🎧
          </p>
        </div>

        {/* Links */}
        <div className="space-y-4">
          {links.map((link, index) => {
            const linkContent = (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300 flex-shrink-0 flex items-center justify-center bg-primary/20">
                  {link.preview ? (
                    <img
                      src={link.preview}
                      alt={link.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Headphones className="w-10 h-10 text-primary" />
                  )}
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
                : "bg-card border border-border hover:border-primary/50 hover:shadow-glow-primary"
            }`;

            return link.external ? (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {linkContent}
              </a>
            ) : (
              <Link key={index} to={link.url} className={className}>
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

export default TikTok;
