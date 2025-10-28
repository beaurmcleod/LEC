import { ShoppingBag, GraduationCap, Gift, Youtube, Package, Calendar, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const Links = () => {
  const links = [
    {
      title: "The Candy Store",
      description: "Premium samples, presets & Ableton racks",
      icon: ShoppingBag,
      url: "/",
      gradient: "from-primary to-primary/80",
    },
    {
      title: "Candy Club: Get Free Stuff Monthly 📦",
      description: "Join our monthly giveaway club",
      icon: Package,
      url: "https://bit.ly/4fCQlZU",
      gradient: "from-pink-500 to-purple-500",
      external: true,
    },
    {
      title: "Book a Private Lesson With me",
      description: "One-on-one music production coaching",
      icon: Calendar,
      url: "https://calendly.com/bohemyth",
      gradient: "from-blue-500 to-cyan-500",
      external: true,
    },
    {
      title: "30 Day EDM Production Course",
      description: "Master electronic music production in 30 days",
      icon: GraduationCap,
      url: "https://www.30dayedmproducer.com/",
      gradient: "from-secondary to-secondary/80",
      external: true,
    },
    {
      title: "Free Ableton Live Course",
      description: "Start your journey with our free course",
      icon: Gift,
      url: "https://bit.ly/49T1wN2",
      external: true,
      gradient: "from-accent to-accent/80",
    },
    {
      title: "Low End Candy YouTube",
      description: "Tutorials, tips & production techniques",
      icon: Youtube,
      url: "https://youtube.com/@lowendcandy",
      gradient: "from-destructive to-destructive/80",
      external: true,
    },
    {
      title: "Follow Bohemyth",
      description: "Connect on Instagram for daily content",
      icon: Instagram,
      url: "https://www.instagram.com/_bohemyth_/?hl=en",
      gradient: "from-purple-500 to-pink-500",
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
            const Icon = link.icon;
            const linkContent = (
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${link.gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
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

            const className = "group block p-6 rounded-lg bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow-primary hover:-translate-y-1";

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
              <Link
                key={index}
                to={link.url}
                className={className}
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

export default Links;
