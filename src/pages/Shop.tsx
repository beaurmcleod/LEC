import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Categories } from "@/components/Categories";
import { ProductGrid } from "@/components/ProductGrid";
import { Footer } from "@/components/Footer";
import { FeaturedProducts } from "@/components/FeaturedProducts";

const Shop = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6">
        <FeaturedProducts heading="Featured Products" />
      </div>
      <div id="products">
        <ProductGrid />
      </div>
      <Footer />
    </div>
  );
};

export default Shop;
