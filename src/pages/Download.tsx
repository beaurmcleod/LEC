import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Download as DownloadIcon, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const Download = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [productTitle, setProductTitle] = useState<string>("");
  const [downloadsRemaining, setDownloadsRemaining] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const fetchDownload = async () => {
      if (!token) {
        setStatus("error");
        setErrorMessage("No download token provided. Please check your email for the correct link.");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-secure-download", {
          body: { token }
        });

        if (error) {
          console.error("Download error:", error);
          setStatus("error");
          setErrorMessage(error.message || "Failed to retrieve download. The link may have expired.");
          return;
        }

        if (data?.downloadUrl) {
          setDownloadUrl(data.downloadUrl);
          setProductTitle(data.productTitle || "Your Purchase");
          setDownloadsRemaining(data.downloadsRemaining || 0);
          setStatus("success");
        } else if (data?.error) {
          setStatus("error");
          setErrorMessage(data.error);
        } else {
          setStatus("error");
          setErrorMessage("Unable to generate download link. Please contact support.");
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setStatus("error");
        setErrorMessage("An error occurred. Please try again or contact support.");
      }
    };

    fetchDownload();
  }, [token]);

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto text-center">
          {status === "loading" && (
            <div className="space-y-6">
              <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin" />
              <h1 className="text-2xl font-bold">Preparing Your Download...</h1>
              <p className="text-muted-foreground">Please wait while we generate your download link.</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-6">
              <CheckCircle className="w-16 h-16 mx-auto text-primary" />
              <h1 className="text-2xl font-bold">Your Download is Ready!</h1>
              <p className="text-xl text-foreground">{productTitle}</p>
              
              <Button 
                size="lg" 
                onClick={handleDownload}
                className="gap-2"
              >
                <DownloadIcon className="w-5 h-5" />
                Download Now
              </Button>
              
              <p className="text-sm text-muted-foreground">
                {downloadsRemaining > 0 
                  ? `You have ${downloadsRemaining} download${downloadsRemaining !== 1 ? 's' : ''} remaining.`
                  : "This is your last available download."}
              </p>
              
              <div className="pt-8 border-t">
                <p className="text-muted-foreground mb-4">
                  Need help? Contact us at{" "}
                  <a href="mailto:beau@lowendcandy.com" className="text-primary hover:underline">
                    beau@lowendcandy.com
                  </a>
                </p>
                <Link to="/shop">
                  <Button variant="outline">Browse More Products</Button>
                </Link>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-6">
              <AlertCircle className="w-16 h-16 mx-auto text-destructive" />
              <h1 className="text-2xl font-bold">Download Error</h1>
              <p className="text-muted-foreground">{errorMessage}</p>
              
              <div className="pt-8 space-y-4">
                <p className="text-muted-foreground">
                  If you believe this is an error, please contact us at{" "}
                  <a href="mailto:beau@lowendcandy.com" className="text-primary hover:underline">
                    beau@lowendcandy.com
                  </a>
                </p>
                <Link to="/shop">
                  <Button variant="outline">Back to Shop</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Download;
