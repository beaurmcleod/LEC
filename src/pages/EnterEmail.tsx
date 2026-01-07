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
    const code = couponCode.toUpperCase();
    
    console.log('Coupon attempt:', { code, isLesson, productTitle, price, productId });
    
    try {
      // Validate coupon from database
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !coupon) {
        setAppliedCoupon(null);
        setDiscountedPrice(null);
        setDiscountMessage(null);
        toast({
          title: "Invalid Coupon",
          description: "This coupon code is not valid.",
          variant: "destructive",
        });
        setValidatingCoupon(false);
        return;
      }

      // Check if expired
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast({
          title: "Coupon Expired",
          description: "This coupon has expired.",
          variant: "destructive",
        });
        setValidatingCoupon(false);
        return;
      }

      // Check max uses
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        toast({
          title: "Coupon Limit Reached",
          description: "This coupon has reached its usage limit.",
          variant: "destructive",
        });
        setValidatingCoupon(false);
        return;
      }

      // Check if applies to this product
      const appliesToProduct = coupon.applies_to_all || 
        (coupon.product_ids && coupon.product_ids.includes(productId));
      
      if (!appliesToProduct) {
        toast({
          title: "Invalid Coupon",
          description: "This coupon does not apply to this product.",
          variant: "destructive",
        });
        setValidatingCoupon(false);
        return;
      }

      // Calculate discounted price
      let newPrice: number;
      let message: string;
      
      if (coupon.discount_type === 'fixed_price') {
        newPrice = parseFloat(coupon.discount_value);
        message = `Price reduced to $${newPrice.toFixed(2)}!`;
      } else if (coupon.discount_type === 'percentage') {
        newPrice = originalPriceNum * (1 - parseFloat(coupon.discount_value) / 100);
        message = `${coupon.discount_value}% discount applied!`;
      } else {
        newPrice = Math.max(0, originalPriceNum - parseFloat(coupon.discount_value));
        message = `$${coupon.discount_value} off applied!`;
      }

      setAppliedCoupon(code);
      setDiscountedPrice(newPrice.toFixed(2));
      setDiscountMessage(message);
      toast({
        title: "Coupon Applied!",
        description: message,
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
          
          <h1 className="text-3xl font-bold mb-2">Your Details</h1>
          <p className="text-muted-foreground">
            Enter your information to complete your purchase
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
                <p className="text-sm text-green-600 mt-2">{discountMessage}</p>
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

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>🔒 Your email is safe and will only be used for purchase confirmation</p>
        </div>
      </div>
    </div>
  );
};

export default EnterEmail;