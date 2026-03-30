import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Download, Loader2, Copy, Check, Music, Shield } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useCruxChords } from "@/hooks/useCruxChords";

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

const MyPurchases = () => {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Client-side auth check for UX only - actual security is enforced by RLS policies
    // on the purchases table. This prevents unnecessary API calls and provides immediate
    // user feedback, but does not provide security protection on its own.
    if (!user) {
      toast.error("Please sign in to view your purchases");
      navigate("/auth");
      return;
    }

    setUser(user);
    fetchPurchases(user.id);
  };

  const fetchPurchases = async (userId: string) => {
    try {
      // Get user email to also find purchases made before account was linked
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userEmail = currentUser?.email;

      // Query by user_id OR email to catch pre-account purchases
      let query = supabase
        .from('purchases')
        .select(`
          id,
          product_id,
          purchased_at,
          amount_paid,
          customer_email,
          products_public (
            title,
            image
          )
        `)
        .order('purchased_at', { ascending: false });

      if (userEmail) {
        query = query.or(`user_id.eq.${userId},customer_email.eq.${userEmail}`);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map the data to match the expected structure
      const mappedData = data?.map(purchase => ({
        ...purchase,
        products: {
          title: purchase.products_public?.title || 'Unknown Product',
          image: purchase.products_public?.image || '',
          download_url: '' // Will be fetched securely when downloading
        }
      })) || [];

      setPurchases(mappedData);
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

      // Fetch download URL from edge function (returns JSON instead of redirect for security compliance)
      const response = await fetch(
        `https://ocydkbblpnshbvkilngl.supabase.co/functions/v1/get-secure-download?token=${encodeURIComponent(tokenData.token)}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get download link');
      }
      
      const data = await response.json();
      
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
        <CruxSection />
      </main>

      <Footer />
    </div>
  );
};

function CruxSection() {
  const { isActive, license, loading: cruxLoading, subscription } = useCruxChords();
  const [copied, setCopied] = useState(false);

  const copyKey = () => {
    if (license?.license_key) {
      navigator.clipboard.writeText(license.license_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (cruxLoading) return null;
  if (!isActive && !license) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        CRUX Chords
      </h2>

      <Card className="p-6 bg-card border-accent/30">
        {isActive && license ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Shield className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="font-semibold">Active Subscription</p>
                <p className="text-xs text-muted-foreground">
                  {subscription?.cancel_at_period_end ? "Access until" : "Renews"}{" "}
                  {subscription?.current_period_end
                    ? new Date(subscription.current_period_end).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">License Key</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 bg-muted px-3 py-2 rounded-lg font-mono text-sm tracking-wider">
                  {license.license_key}
                </code>
                <Button variant="ghost" size="icon" onClick={copyKey}>
                  {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.requests_today ?? 0}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.daily_limit ?? 100}</div>
                <div className="text-xs text-muted-foreground">Limit</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="font-bold text-primary">{license.total_requests ?? 0}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/crux-chords/download">
                  <Download className="h-4 w-4 mr-1" /> Download Device
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/crux-chords/api-guide">API Guide</Link>
              </Button>
            </div>
          </div>
        ) : license ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-3">Your CRUX Chords subscription has expired.</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/crux-chords#pricing">Resubscribe</Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export default MyPurchases;
