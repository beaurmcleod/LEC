import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const stripePromise = loadStripe("pk_test_CnII2xJxbe8WfDISBmQTfE0C");

interface CheckoutFormProps {
  clientSecret: string;
  productTitle: string;
  price: string;
}

const CheckoutForm = ({ clientSecret, productTitle, price }: CheckoutFormProps) => {
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
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
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
    } catch (err) {
      console.error("Unexpected error during payment:", err);
      toast({
        title: "Payment failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Order Summary</h3>
        <div className="flex justify-between items-center">
          <span>{productTitle}</span>
          <span className="font-bold text-primary">{price}</span>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Payment Details
        </h3>
        <PaymentElement 
          options={{
            layout: "tabs",
            fields: {
              billingDetails: "auto"
            },
            wallets: {
              googlePay: "never",
              applePay: "never"
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
        {isLoading ? "Processing..." : `Pay ${price}`}
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
  
  const productTitle = searchParams.get("title") || "";
  const price = searchParams.get("price") || "";
  const productId = searchParams.get("id") || "";
  
  console.log("Checkout params:", { productTitle, price, productId });

  useEffect(() => {
    if (!productTitle || !price) {
      navigate("/");
      return;
    }

    const createPaymentIntent = async () => {
      try {
        console.log('Creating payment intent with data:', { productTitle, price, productId });
        
        const { data, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            productTitle,
            price,
            productId,
          },
        });

        console.log('Payment intent response:', { data, error });

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
        }

        if (!data?.client_secret) {
          console.error('No client secret received:', data);
          throw new Error('No client secret received from payment intent');
        }

        console.log('Setting client secret:', data.client_secret);
        setClientSecret(data.client_secret);
      } catch (error) {
        console.error('Error creating payment intent:', error);
        toast({
          title: "Error",
          description: `Failed to initialize checkout: ${error.message}`,
          variant: "destructive",
        });
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [productTitle, price, productId, navigate]);

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
    },
    payment_method_types: ['card'], // Only allow card payments to avoid Google Pay issues
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
          {clientSecret && (
            <Elements options={options} stripe={stripePromise}>
              <CheckoutForm 
                clientSecret={clientSecret}
                productTitle={productTitle}
                price={price}
              />
            </Elements>
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