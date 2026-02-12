import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ttqTrack } from "@/lib/tiktokPixel";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface CheckoutFormProps {
  clientSecret: string;
  productTitle: string;
  price: string;
  productId: string;
  customerEmail: string;
  originalPrice?: string;
  discountApplied?: string | null;
  finalAmount?: number;
}

const CheckoutForm = ({ clientSecret, productTitle, price, productId, customerEmail, originalPrice, discountApplied, finalAmount }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isElementsReady, setIsElementsReady] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Form submit started");

    if (!stripe || !elements) {
      console.log("Stripe or elements not loaded");
      toast({
        title: "Payment system not ready",
        description: "Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!isElementsReady) {
      console.log("Payment element not ready");
      toast({
        title: "Payment form not ready",
        description: "Please wait for the payment form to load completely.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log("Starting payment confirmation");

    try {
      // Submit the form to collect billing details
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw submitError;
      }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success?product_id=${productId}&customer_email=${encodeURIComponent(customerEmail)}`,
        },
      });

      if (error) {
        console.error("Payment confirmation error:", error);
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Payment confirmed successfully");
      }
    } catch (err: any) {
      console.error("Unexpected error during payment:", err);
      const errorMessage = err?.message || err?.error?.message || "An unexpected error occurred";
      console.error("Error details:", JSON.stringify(err, null, 2));
      toast({
        title: "Payment failed",
        description: errorMessage,
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const displayPrice = finalAmount ? `$${(finalAmount / 100).toFixed(2)}` : price;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Order Summary</h3>
        <div className="flex justify-between items-center">
          <span>{productTitle}</span>
          <div className="text-right">
            {discountApplied && originalPrice ? (
              <>
                <span className="line-through text-muted-foreground mr-2">{originalPrice}</span>
                <span className="font-bold text-primary">{displayPrice}</span>
              </>
            ) : (
              <span className="font-bold text-primary">{displayPrice}</span>
            )}
          </div>
        </div>
        {discountApplied && (
          <p className="text-sm text-green-600 mt-2">{discountApplied}</p>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment Details
        </h3>
        <PaymentElement 
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                email: customerEmail || ''
              }
            }
          }}
          onReady={() => {
            console.log("PaymentElement is ready");
            setIsElementsReady(true);
          }}
          onLoadError={(error) => {
            console.error("PaymentElement load error:", error);
            toast({
              title: "Payment form error",
              description: "Failed to load payment form. Please refresh the page.",
              variant: "destructive",
            });
          }}
        />
      </div>

      <Button 
        type="submit" 
        disabled={!stripe || !isElementsReady || isLoading} 
        className="w-full"
        size="lg"
      >
        {isLoading ? "Processing..." : `Pay ${displayPrice}`}
      </Button>
    </form>
  );
};

const Checkout = () => {
  console.log("Checkout component rendered");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [clientSecret, setClientSecret] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [freeData, setFreeData] = useState<{ downloadUrl: string; productTitle: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [finalAmount, setFinalAmount] = useState<number | null>(null);
  const [discountApplied, setDiscountApplied] = useState<string | null>(null);
  
  const productTitle = searchParams.get("title") || "";
  const price = searchParams.get("price") || "";
  const productId = searchParams.get("id") || "";
  const customerEmail = searchParams.get("email") || "";
  const customerFirstName = searchParams.get("firstName") || "";
  const customerLastName = searchParams.get("lastName") || "";
  const couponCode = searchParams.get("coupon") || "";
  
  // Lesson booking params
  const isLesson = searchParams.get("type") === "lesson";
  const lessonId = searchParams.get("lessonId") || "";
  const lessonDate = searchParams.get("date") || "";
  const lessonTime = searchParams.get("time") || "";
  
  console.log("Checkout params:", { productTitle, price, productId, customerEmail, customerFirstName, customerLastName, isLesson, lessonDate, lessonTime });

  // TikTok InitiateCheckout event
  useEffect(() => {
    if (productTitle && productId && price) {
      ttqTrack.initiateCheckout({ id: productId, title: productTitle, price });
    }
  }, [productTitle, productId, price]);
  // Add toast notification to help with debugging
  if (productTitle && price) {
    toast({
      title: "Checkout Page Loaded",
      description: `Loading payment for ${productTitle} - ${price}`,
    });
  }

  useEffect(() => {
    if (!productTitle || !price) {
      navigate("/");
      return;
    }

    // Check if this is a paid product and redirect to email entry if needed
    const rawPrice = (price || '').toString().trim();
    const isFree = rawPrice.toLowerCase() === 'free' || parseFloat(rawPrice.replace(/[^0-9.]/g, '')) === 0;
    
    if (!isFree && !customerEmail) {
      console.log('Paid product without email, redirecting to enter-email');
      navigate(`/enter-email?title=${encodeURIComponent(productTitle)}&price=${encodeURIComponent(price)}&id=${productId}`);
      return;
    }

    const initializeCheckout = async () => {
      try {
        console.log('Initializing checkout for:', { productTitle, price, productId, customerEmail });
        
        // Always trust DB price to decide free vs paid
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('price, title')
          .eq('id', productId)
          .maybeSingle();

        if (productError || !product) {
          console.error('Product fetch error or not found:', productError);
          throw new Error('Product not found');
        }

        console.log('Product fetched from DB:', product);

        const rawPrice = (product.price || '').toString().trim();
        const isFree = rawPrice.toLowerCase() === 'free' || parseFloat(rawPrice.replace(/[^0-9.]/g, '')) === 0;

        console.log('Price check:', { rawPrice, isFree });

        if (isFree) {
          console.log('Product is free, bypassing Stripe');
          const { data: freeResp, error: freeErr } = await supabase.functions.invoke('get-free-download', {
            body: { productId },
          });

          if (freeErr) {
            console.error('Free download function error:', freeErr);
            throw new Error(freeErr.message || 'Unable to get free download');
          }

          if (!freeResp?.downloadUrl) {
            throw new Error('No download URL received for free product');
          }

          setFreeData({ downloadUrl: freeResp.downloadUrl, productTitle: freeResp.productTitle || productTitle });
          setLoading(false);
          return;
        }

        // Paid product - create payment intent
        console.log('Creating payment intent for paid product');
        const paymentBody: any = {
          productId: productId,
          customerEmail: customerEmail,
          customerFirstName: customerFirstName,
          customerLastName: customerLastName,
          couponCode: couponCode || undefined,
        };
        
        // Add lesson metadata if this is a lesson booking
        if (isLesson) {
          paymentBody.isLesson = true;
          paymentBody.lessonId = lessonId;
          paymentBody.lessonDate = lessonDate;
          paymentBody.lessonTime = lessonTime;
        }
        
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: paymentBody,
        });

        console.log('Payment intent response:', { data, error });

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(`Payment setup failed: ${error.message || 'Please try again'}`);
        }

        // Handle free purchases (e.g., BOHEMYTHTEST coupon)
        if (data?.free) {
          console.log('Free purchase confirmed, redirecting to success page');
          navigate(`/payment-success?product_id=${productId}&customer_email=${encodeURIComponent(customerEmail)}&free=true&lesson_date=${encodeURIComponent(lessonDate)}&lesson_time=${encodeURIComponent(lessonTime)}`);
          return;
        }

        if (!data?.client_secret) {
          console.error('No client secret received:', data);
          throw new Error('Payment setup incomplete. Please try again.');
        }

        console.log('Payment intent created successfully, client secret received');
        setClientSecret(data.client_secret);
        setFinalAmount(data.amount);
        if (couponCode) {
          setDiscountApplied('Discount applied!');
        }
        setLoading(false);
      } catch (error: any) {
        console.error('Error initializing checkout:', error);
        const errorMsg = error.message || 'Failed to initialize checkout';
        setError(errorMsg);
        setLoading(false);
        toast({
          title: 'Checkout Error',
          description: errorMsg,
          variant: 'destructive'
        });
      }
    };

    initializeCheckout();
  }, [productTitle, price, productId, customerEmail, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Initializing checkout...</p>
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: 'hsl(var(--primary))',
        colorBackground: 'hsl(var(--background))',
        colorText: 'hsl(var(--foreground))',
        borderRadius: '8px',
      }
    }
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Store
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Checkout</h1>
          <p className="text-muted-foreground">
            Complete your purchase securely
          </p>
        </div>

        <Card className="p-6">
          {error ? (
            <div className="space-y-4 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" onClick={() => navigate("/")}>
                Return to Store
              </Button>
            </div>
          ) : freeData ? (
            <div className="space-y-4">
              <h3 className="font-semibold">{freeData.productTitle}</h3>
              <p className="text-muted-foreground">This item is free. Click below to download instantly.</p>
              <Button size="lg" className="w-full" onClick={() => (window.location.href = freeData.downloadUrl)}>
                Download Now
              </Button>
            </div>
          ) : clientSecret ? (
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm 
                clientSecret={clientSecret}
                productTitle={productTitle}
                price={price}
                productId={productId}
                customerEmail={customerEmail}
                originalPrice={price}
                discountApplied={discountApplied}
                finalAmount={finalAmount || undefined}
              />
            </Elements>
          ) : (
            <div className="text-center text-muted-foreground">
              <p>Setting up payment form...</p>
            </div>
          )}
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>🔒 Your payment information is secure and encrypted</p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;