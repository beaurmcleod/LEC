import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import Cart from "./pages/Cart";
import NotFound from "./pages/NotFound";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import Checkout from "./pages/Checkout";
import EnterEmail from "./pages/EnterEmail";
import ProductDetail from "./pages/ProductDetail";
import Free from "./pages/Free";
import Racks from "./pages/Racks";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import MyPurchases from "./pages/MyPurchases";
import Download from "./pages/Download";
import Links from "./pages/Links";
import Lessons from "./pages/Lessons";
import CandyClub from "./pages/CandyClub";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSetup from "./pages/AdminSetup";
import AskProducer from "./pages/AskProducer";
import Collective from "./pages/Collective";
import JoinChallenge from "./pages/JoinChallenge";
import CohortSuccess from "./pages/CohortSuccess";
import Bio from "./pages/Bio";
import LocalLessons from "./pages/LocalLessons";
import DJServices from "./pages/DJServices";
import CancelLesson from "./pages/CancelLesson";
import TikTok from "./pages/TikTok";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import SkoolRedirect from "./pages/SkoolRedirect";
import FreeConsultation from "./pages/FreeConsultation";

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
          <Route path="/cart" element={<Cart />} />
          <Route path="/free" element={<Free />} />
          <Route path="/racks" element={<Racks />} />
          <Route path="/links" element={<Links />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/free-consultation" element={<FreeConsultation />} />
          <Route path="/candy-club" element={<CandyClub />} />
          <Route path="/ask" element={<AskProducer />} />
          <Route path="/bio" element={<Bio />} />
          <Route path="/local-lessons" element={<LocalLessons />} />
          <Route path="/dj" element={<DJServices />} />
          <Route path="/collective" element={<Collective />} />
          <Route path="/collective/join" element={<JoinChallenge />} />
          <Route path="/collective/success" element={<CohortSuccess />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/enter-email" element={<EnterEmail />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-canceled" element={<PaymentCanceled />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/my-purchases" element={<MyPurchases />} />
          <Route path="/download" element={<Download />} />
          <Route path="/cancel-lesson" element={<CancelLesson />} />
          <Route path="/tiktok" element={<TikTok />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/skool" element={<SkoolRedirect />} />
          <Route path="/admin/setup" element={<AdminSetup />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
