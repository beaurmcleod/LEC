import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Categories } from "@/components/Categories";
import { ProductGrid } from "@/components/ProductGrid";
import { Footer } from "@/components/Footer";
import { BackgroundRemovalTool } from "@/components/BackgroundRemovalTool";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />
      <Categories />
      <ProductGrid />
      <Footer />
      <BackgroundRemovalTool />
    </div>
  );
};

export default Index;
