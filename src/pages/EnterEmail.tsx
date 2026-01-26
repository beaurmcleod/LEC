import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EnterEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountedPrice, setDiscountedPrice] = useState<string | null>(null);
  const [discountMessage, setDiscountMessage] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const productTitle = searchParams.get("title") || "";
  const price = searchParams.get("price") || "";
  const productId = searchParams.get("id") || "";
  
  // Lesson booking params
  const isLesson = searchParams.get("type") === "lesson";
  const lessonId = searchParams.get("lessonId") || "";
  const lessonDate = searchParams.get("date") || "";
  const lessonTime = searchParams.get("time") || "";

  const originalPriceNum = parseFloat(price.replace(/[^0-9.]/g, '')) || 0;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    setValidatingCoupon(true);
    
    try {
      // Validate coupon via server-side edge function (never expose coupons table to client)
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          couponCode: couponCode.trim(),
          productId,
          originalPrice: originalPriceNum
        }
      });

      if (error) {
        throw error;
      }

      if (!data.valid) {
        setAppliedCoupon(null);
        setDiscountedPrice(null);
        setDiscountMessage(null);
        toast({
          title: "Invalid Coupon",
          description: data.error || "This coupon code is not valid.",
          variant: "destructive",
        });
        setValidatingCoupon(false);
        return;
      }

      setAppliedCoupon(data.couponCode);
      setDiscountedPrice(data.discountedPrice);
      setDiscountMessage(data.message);
      toast({
        title: "Coupon Applied!",
        description: data.message,
      });
    } catch (err) {
      console.error('Coupon validation error:', err);
      toast({
        title: "Error",
        description: "Failed to validate coupon. Please try again.",
        variant: "destructive",
      });
    }
    
    setValidatingCoupon(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your first and last name",
        variant: "destructive",
      });
      return;
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    // Navigate to checkout with name, email and coupon (and lesson params if applicable)
    let checkoutUrl = `/checkout?title=${encodeURIComponent(productTitle)}&price=${encodeURIComponent(price)}&id=${productId}&email=${encodeURIComponent(email)}&firstName=${encodeURIComponent(firstName.trim())}&lastName=${encodeURIComponent(lastName.trim())}${appliedCoupon ? `&coupon=${appliedCoupon}` : ''}`;
    
    if (isLesson) {
      checkoutUrl += `&type=lesson&lessonId=${encodeURIComponent(lessonId)}&date=${encodeURIComponent(lessonDate)}&time=${encodeURIComponent(lessonTime)}`;
    }
    
    navigate(checkoutUrl);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-md">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Store
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Quick Checkout</h1>
          <p className="text-muted-foreground">
            Just your email — we'll send your download link instantly
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold mb-2">Your Purchase</h3>
              <div className="flex justify-between items-center">
                <span>{productTitle}</span>
                <div className="text-right">
                  {discountedPrice ? (
                    <>
                      <span className="line-through text-muted-foreground mr-2">{price}</span>
                      <span className="font-bold text-primary">${discountedPrice}</span>
                    </>
                  ) : (
                    <span className="font-bold text-primary">{price}</span>
                  )}
                </div>
              </div>
              {discountMessage && (
                <p className="text-sm text-primary mt-2">{discountMessage}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coupon">Discount Code (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="coupon"
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleApplyCoupon} disabled={validatingCoupon}>
                  {validatingCoupon ? "..." : "Apply"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loading}
            >
              {loading ? "Loading..." : "Continue to Payment"}
            </Button>
          </form>
        </Card>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>🔒 Secure checkout — no shipping address required</p>
          <p>📧 Instant download link emailed immediately</p>
          <p>♾️ Lifetime access + free updates included</p>
        </div>
      </div>
    </div>
  );
};

export default EnterEmail;