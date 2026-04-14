import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Loader2, Copy, Check, Music, Shield } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CruxAccountSection } from "@/components/CruxAccountSection";

interface Purchase {
  id: string;
  product_id: string;
  purchased_at: string;
  amount_paid: number;
  customer_email: string;
  products: {
    title: string;
    image: string;
    download_url: string;
  };
}

interface PurchaseQueryRow {
  id: string;
  product_id: string;
  purchased_at: string;
  amount_paid: number;
  customer_email: string;
  products_public:
    | {
        title: string | null;
        image: string | null;
      }
    | {
        title: string | null;
        image: string | null;
      }[]
    | null;
}

const mapPurchaseRow = (purchase: PurchaseQueryRow): Purchase => {
  const product = Array.isArray(purchase.products_public)
    ? purchase.products_public[0]
    : purchase.products_public;

  return {
    id: purchase.id,
    product_id: purchase.product_id,
    purchased_at: purchase.purchased_at,
    amount_paid: purchase.amount_paid,
    customer_email: purchase.customer_email,
    products: {
      title: product?.title || "Unknown Product",
      image: product?.image || "",
      download_url: "",
    },
  };
};

const MyPurchases = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // First check current session (may already be loaded from storage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      if (currentUser) {
        setUser(currentUser);
        setAuthChecked(true);
        fetchPurchases(currentUser.id);
      } else {
        // No existing session — give onAuthStateChange a moment to restore,
        // then redirect if still unauthenticated
        setAuthChecked(true);
        toast.error("Please sign in to view your purchases");
        navigate("/auth?redirect=/my-purchases");
      }
    });

    // Also listen for subsequent changes (sign-in, sign-out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        fetchPurchases(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setPurchases([]);
        navigate("/auth?redirect=/my-purchases");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPurchases = async (userId: string) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email?.trim();

      const purchaseSelect = `
        id,
        product_id,
        purchased_at,
        amount_paid,
        customer_email,
        products_public (
          title,
          image
        )
      `;

      const [userPurchasesResult, emailPurchasesResult] = await Promise.all([
        supabase
          .from('purchases')
          .select(purchaseSelect)
          .eq('user_id', userId)
          .order('purchased_at', { ascending: false }),
        userEmail
          ? supabase
              .from('purchases')
              .select(purchaseSelect)
              .ilike('customer_email', userEmail)
              .order('purchased_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (userPurchasesResult.error) throw userPurchasesResult.error;
      if (emailPurchasesResult.error) throw emailPurchasesResult.error;

      const combinedPurchases = [
        ...(userPurchasesResult.data || []),
        ...(emailPurchasesResult.data || []),
      ] as PurchaseQueryRow[];

      const uniquePurchases = Array.from(
        new Map(combinedPurchases.map((purchase) => [purchase.id, purchase])).values()
      ).sort(
        (a, b) =>
          new Date(b.purchased_at || 0).getTime() - new Date(a.purchased_at || 0).getTime()
      );

      setPurchases(uniquePurchases.map(mapPurchaseRow));
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

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
