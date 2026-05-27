import { Link } from "react-router-dom";

const featured = [
  {
    title: "CRUX Chords 2.1",
    description: "AI chord progression generator for Ableton",
    price: "$39",
    image: "/lovable-uploads/crux-chords-mockup.png",
    url: "/crux-chords",
  },
  {
    title: "Key & BPM Finder",
    description: "Instantly detect key + BPM of any track",
    price: "$14.99",
    image: "/lovable-uploads/key-bpm-finder.png",
    url: "/product/key-bpm-finder",
  },
  {
    title: "Serum 2 Randomizer Rack",
    description: "Refined randomization for usable sounds",
    price: "$5",
    image: "/lovable-uploads/randomizer-rack.png",
    url: "/product/serum-2-randomizer-rack",
  },
  {
    title: "30 Day EDM Production Course",
    description: "Beginner to confident producer in 30 days",
    price: "Course",
    image: "/src/assets/preview-edm-course-new.jpg",
    url: "https://www.30dayedmproducer.com/",
    external: true,
  },
];

interface FeaturedProductsProps {
  heading?: string;
  className?: string;
}

export const FeaturedProducts = ({ heading = "Quick Picks", className = "" }: FeaturedProductsProps) => {
  return (
    <section className={`w-full ${className}`}>
      {heading && (
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 text-center">
          {heading}
        </h2>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {featured.map((p) => {
          const inner = (
            <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/60 hover:shadow-glow-primary transition-all duration-200 h-full flex flex-col">
              <div className="aspect-square bg-muted overflow-hidden">
                <img
                  src={p.image}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5 flex-1 flex flex-col">
                <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {p.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 flex-1">
                  {p.description}
                </p>
                <div className="mt-2 text-sm font-bold text-primary">{p.price}</div>
              </div>
            </div>
          );
          return p.external ? (
            <a key={p.title} href={p.url} target="_blank" rel="noopener noreferrer">
              {inner}
            </a>
          ) : (
            <Link key={p.title} to={p.url}>
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
