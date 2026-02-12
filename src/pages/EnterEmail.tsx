import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const EnterEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
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
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          couponCode: couponCode.trim(),
          productId,
          originalPrice: originalPriceNum
        }
      });

      if (error) throw error;

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
    
    if (!isLogin && (!firstName.trim() || !lastName.trim())) {
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

    if (!password || password.length < 6) {
      toast({
        title: "Password Required",
        description: "Please enter a password (at least 6 characters)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let userEmail = email.trim();

      if (isLogin) {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Invalid Credentials",
              description: "Email or password is incorrect. Try again or create a new account.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Sign In Error", description: error.message, variant: "destructive" });
          }
          setLoading(false);
          return;
        }

        // Use profile name if available
        const fn = data.user?.user_metadata?.first_name || firstName.trim();
        const ln = data.user?.user_metadata?.last_name || lastName.trim();

        navigateToCheckout(userEmail, fn, ln);
      } else {
        // Create new account
        const { data, error } = await supabase.auth.signUp({
          email: userEmail,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            },
            emailRedirectTo: `${window.location.origin}/my-purchases`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account Exists",
              description: "This email already has an account. Please sign in instead.",
              variant: "destructive",
            });
            setIsLogin(true);
          } else {
            toast({ title: "Signup Error", description: error.message, variant: "destructive" });
          }
          setLoading(false);
          return;
        }

        // If email confirmation is required, user may not be fully signed in yet
        // but we still proceed to checkout since Stripe handles the payment
        if (data.user) {
          navigateToCheckout(userEmail, firstName.trim(), lastName.trim());
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      toast({ title: "Error", description: "Something went wrong. Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const navigateToCheckout = (userEmail: string, fn: string, ln: string) => {
    let checkoutUrl = `/checkout?title=${encodeURIComponent(productTitle)}&price=${encodeURIComponent(price)}&id=${productId}&email=${encodeURIComponent(userEmail)}&firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}${appliedCoupon ? `&coupon=${appliedCoupon}` : ''}`;
    
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
          
          <h1 className="text-3xl font-bold mb-2">
            {isLogin ? "Sign In & Checkout" : "Create Account & Checkout"}
          </h1>
          <p className="text-muted-foreground">
            {isLogin 
              ? "Sign in to your account to continue your purchase"
              : "Create an account to access your downloads anytime"
            }
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

            {!isLogin && (
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
                    maxLength={50}
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
                    maxLength={50}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  maxLength={100}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-muted-foreground">
                  Must be at least 6 characters
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              size="lg"
              disabled={loading}
            >
              {loading ? "Loading..." : isLogin ? "Sign In & Continue" : "Create Account & Continue"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin
                  ? "Don't have an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
            </div>
          </form>
        </Card>

        <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
          <p>🔒 Secure checkout — your account gives you lifetime download access</p>
          <p>📧 Instant download link emailed immediately</p>
          <p>♾️ Lifetime access + free updates included</p>
        </div>
      </div>
    </div>
  );
};

export default EnterEmail;
