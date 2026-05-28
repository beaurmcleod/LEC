import { Link } from "react-router-dom";
import previewPos from "@/assets/preview-pos.png";

const featured = [
  {
    title: "Serum 2 Randomizer Rack",
    description: "Refined randomization for usable sounds",
    price: "$9.99",
    image: "/lovable-uploads/randomizer-rack.png",
    url: "/product/serum-2-randomizer-rack",
  },
  {
    title: "Key & BPM Finder",
    description: "Instantly detect key + BPM of any track",
    price: "$14.99",
    image: "/lovable-uploads/key-bpm-finder.png",
    url: "/product/key-bpm-finder",
  },
  {
    title: "CRUX Chords 2.1",
    description: "AI chord progression generator for Ableton",
    price: "$39",
    image: "/lovable-uploads/crux-chords-mockup.png",
    url: "/crux-chords",
  },
  {
    title: "Producer Operating System",
    description: "Resources for building a music production career",
    price: "$27",
    image: previewPos,
    url: "https://producerframework.com/",
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
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 text-center">
          {heading}
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3">
        {featured.map((p) => {
          const inner = (
            <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/60 hover:shadow-glow-primary transition-all duration-200 h-full flex flex-col">
              <div className="aspect-square bg-muted overflow-hidden flex items-center justify-center">
                <img
                  src={p.image}
                  alt={p.title}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
                  {p.title}
                </h3>
                <div className="text-sm font-bold text-primary whitespace-nowrap">{p.price}</div>
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
