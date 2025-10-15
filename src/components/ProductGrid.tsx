import { ProductCard } from "./ProductCard";

export const ProductGrid = () => {
  // Product format reference:
  // {
  //   title: "Product Name",
  //   price: "$19.99" or "Free",
  //   originalPrice: "$39.99", (optional - for sales)
  //   image: "/lovable-uploads/image.png",
  //   category: "Sample Pack" | "Loop Pack" | "Presets" | "MIDI" | "Drums" | "Live Racks",
  //   bpm: "140", (optional)
  //   musicalKey: "G Minor", (optional)
  //   isOnSale: true, (optional)
  // }

  const products = [
    {
      title: "27 OTT Rack",
      price: "Free",
      image: "/lovable-uploads/27-ott-rack.png",
      category: "Live Racks",
    },
    {
      title: "Serum 2 Randomizer Rack",
      price: "$5.00",
      image: "/lovable-uploads/randomizer-rack.png",
      category: "Live Racks",
    },
    {
      title: "Hip Hop Sample Pack",
      price: "Free",
      image: "/lovable-uploads/hip-hop-trap-starter-pack.png",
      category: "Sample Pack",
    },
    {
      title: "Deep House Ableton Project File",
      price: "Free",
      image: "/lovable-uploads/deep-house-ableton-project-new.png",
      category: "Sample Pack",
    },
    {
      title: "1 Knob Build",
      price: "Free",
      image: "/lovable-uploads/1-knob-build.png",
      category: "Live Racks",
    },
    {
      title: "Bohemyth's 1st Sample Pack",
      price: "Free",
      image: "/lovable-uploads/bohemyth-1st-sample-pack.png",
      category: "Sample Pack",
    },
    {
      title: "Bohemyth's Serum (1) Rack",
      price: "Free",
      image: "/lovable-uploads/bohemyth-serum-rack.png",
      category: "Live Racks",
    },
    {
      title: "Ableton Quick Commands Cheat Sheet",
      price: "Free",
      image: "/lovable-uploads/ableton-quick-commands.png",
      category: "Sample Pack",
    },
    {
      title: "Hat Sauce",
      price: "Free",
      image: "/lovable-uploads/hat-sauce-rack.png",
      category: "Live Racks",
    },
    {
      title: "HAAS Effect",
      price: "Free",
      image: "/lovable-uploads/haas-effect-rack.png",
      category: "Live Racks",
    },
    {
      title: "Vocal Clean Up Rack",
      price: "Free",
      image: "/lovable-uploads/vocal-clean-rack.png",
      category: "Live Racks",
    },
    {
      title: "Vocal Sauce",
      price: "Free",
      image: "/lovable-uploads/vocal-sauce-rack.png",
      category: "Live Racks",
    },
  ];

  return (
    <section className="py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Featured Products
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Hand-crafted sounds designed to elevate your productions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, index) => (
            <ProductCard key={index.toString()} {...product} />
          ))}
        </div>

        <div className="text-center mt-12">
          <button className="bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-lg font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-8">
            View All Products
          </button>
        </div>
      </div>
    </section>
  );
};