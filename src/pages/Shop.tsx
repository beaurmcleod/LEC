import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Categories } from "@/components/Categories";
import { ProductGrid } from "@/components/ProductGrid";
import { Footer } from "@/components/Footer";

const Shop = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div id="products">
        <ProductGrid />
      </div>
      <Footer />
    </div>
  );
};

export default Shop;
