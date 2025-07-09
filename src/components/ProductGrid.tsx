import { ProductCard } from "./ProductCard";

export const ProductGrid = () => {
  const products = [
    {
      title: "Future Bass Essentials",
      price: "$24.99",
      originalPrice: "$49.99",
      image: "/placeholder.svg",
      category: "Sample Pack",
      bpm: "140",
      key: "G Minor",
      isOnSale: true,
    },
    {
      title: "Lo-Fi Hip Hop Vibes",
      price: "$19.99",
      image: "/placeholder.svg",
      category: "Loop Pack",
      bpm: "85",
      key: "C Major",
    },
    {
      title: "Serum Bass Presets",
      price: "$15.99",
      originalPrice: "$29.99",
      image: "/placeholder.svg",
      category: "Presets",
      isOnSale: true,
    },
    {
      title: "Trap Melody MIDI Pack",
      price: "$12.99",
      image: "/placeholder.svg",
      category: "MIDI",
      bpm: "130",
      key: "F# Minor",
    },
    {
      title: "Ambient Soundscapes",
      price: "$22.99",
      image: "/placeholder.svg",
      category: "Sample Pack",
      bpm: "120",
      key: "A Minor",
    },
    {
      title: "House Drum Loops",
      price: "$18.99",
      originalPrice: "$35.99",
      image: "/placeholder.svg",
      category: "Drums",
      bpm: "128",
      isOnSale: true,
    },
    {
      title: "Ableton Live Racks",
      price: "$16.99",
      image: "/placeholder.svg",
      category: "Live Racks",
      bpm: "Various",
    },
    {
      title: "Vintage Analog Leads",
      price: "$21.99",
      image: "/placeholder.svg",
      category: "Presets",
      key: "E Minor",
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