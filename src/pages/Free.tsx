import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";

const Free = () => {
  const freeProducts = [
    {
      title: "27 OTT Rack",
      price: "Free",
      image: "/lovable-uploads/27-ott-rack.png",
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
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-primary bg-clip-text text-transparent">
                  Free Downloads
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                High-quality samples, presets, and tools - absolutely free
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {freeProducts.map((product, index) => (
                <ProductCard key={index.toString()} {...product} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Free;
