import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CruxAccountSection } from "@/components/CruxAccountSection";
import { loadPurchasesForUser, type Purchase } from "@/lib/purchaseLookup";

const MyPurchases = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const fetchPurchases = async (userId: string, email?: string | null) => {
      try {
        const purchaseData = await loadPurchasesForUser(userId, email);

        if (!isActive) return;

        setPurchases(purchaseData);
      } catch (error) {
        console.error("Error fetching purchases:", error);

        if (!isActive) return;

        toast.error("Failed to load purchases");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    const initializePurchases = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentUser = session?.user ?? null;

      if (!isActive) return;

      if (!currentUser) {
        setLoading(false);
        toast.error("Please sign in to view your purchases");
        navigate("/auth?redirect=/my-purchases");
        return;
      }

      void fetchPurchases(currentUser.id, currentUser.email);
    };

    void initializePurchases();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;

      if (event === "SIGNED_OUT") {
        setPurchases([]);
        setLoading(false);
        navigate("/auth?redirect=/my-purchases");
        return;
      }

      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        setLoading(true);
        void fetchPurchases(session.user.id, session.user.email);
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleDownload = async (productId: string, customerEmail: string, title: string) => {
    try {
      toast.info(`Preparing download for ${title}...`);
      
      // Get download token for this purchase
      const { data: tokenData, error: tokenError } = await supabase
        .from('download_tokens')
        .select('token')
        .eq('product_id', productId)
        .eq('customer_email', customerEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError || !tokenData) {
        console.error('Token lookup error:', tokenError);
        toast.error('Download token not found. Please check your purchase email for the download link.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('get-secure-download', {
        body: { token: tokenData.token },
      });

      if (error) {
        throw new Error(error.message || 'Failed to get download link');
      }
      
      if (!data.downloadUrl) {
        throw new Error('No download URL received');
      }
      
      // Use standard anchor navigation (Google Ads compliance)
      const link = document.createElement('a');
      link.href = data.downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Downloading ${title}!`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to initiate download. Please try again or check your email for the download link.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Store
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Purchases</h1>
          <p className="text-muted-foreground">
            Access all your purchased items and download links
          </p>
        </div>

        {purchases.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto">
              <h2 className="text-2xl font-semibold mb-2">No purchases yet</h2>
              <p className="text-muted-foreground mb-6">
                Start exploring our digital products and make your first purchase!
              </p>
              <Button onClick={() => navigate("/")}>
                Browse Products
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {purchases.map((purchase) => (
              <Card key={purchase.id} className="overflow-hidden">
                <div className="aspect-video relative overflow-hidden">
                  <img
                    src={purchase.products.image}
                    alt={purchase.products.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-lg mb-2">
                    {purchase.products.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Purchased on {new Date(purchase.purchased_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm font-medium mb-4">
                    ${(purchase.amount_paid / 100).toFixed(2)}
                  </p>
                  <Button
                    onClick={() => handleDownload(
                      purchase.product_id,
                      purchase.customer_email,
                      purchase.products.title
                    )}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* CRUX Chords Subscription Section */}
        <CruxAccountSection />
      </main>

      <Footer />
    </div>
  );
};

export default MyPurchases;
