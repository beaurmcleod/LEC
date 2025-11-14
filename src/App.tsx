import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import Checkout from "./pages/Checkout";
import EnterEmail from "./pages/EnterEmail";
import ProductDetail from "./pages/ProductDetail";
import Free from "./pages/Free";
import Racks from "./pages/Racks";
import Auth from "./pages/Auth";
import MyPurchases from "./pages/MyPurchases";
import Links from "./pages/Links";
import CandyClub from "./pages/CandyClub";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/free" element={<Free />} />
          <Route path="/racks" element={<Racks />} />
          <Route path="/links" element={<Links />} />
          <Route path="/candy-club" element={<CandyClub />} />
          <Route path="/product" element={<ProductDetail />} />
          <Route path="/enter-email" element={<EnterEmail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/my-purchases" element={<MyPurchases />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
