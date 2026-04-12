import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Home, Mail, Calendar, Download, UserPlus, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ttqTrack } from "@/lib/tiktokPixel";
import { toast } from "@/hooks/use-toast";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [notificationSent, setNotificationSent] = useState(false);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  
  // Account creation state
  const [showAccountCreate, setShowAccountCreate] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  
  const sessionId = searchParams.get("session_id");
  const productId = searchParams.get("product_id");
  const customerEmail = searchParams.get("customer_email");
  const isFree = searchParams.get("free") === "true";
  const lessonDate = searchParams.get("lesson_date");
  const lessonTime = searchParams.get("lesson_time");
  
  // Determine if this is a lesson booking
  const isLesson = !!(lessonDate && lessonTime);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAccountCreated(true);
      }
    };
    checkAuth();
  }, []);

  // TikTok Purchase event
  useEffect(() => {
    if (productId) {
      const fetchAndTrack = async () => {
        const { data: product } = await supabase
          .from('products')
          .select('title, price')
          .eq('id', productId)
          .maybeSingle();
        if (product) {
          ttqTrack.purchase({ id: productId, title: product.title, price: product.price });
        }
      };
      fetchAndTrack();
    }
  }, [productId]);

  // Fetch download token for non-lesson products with retry
  useEffect(() => {
    if (!customerEmail || !productId || isLesson) return;

    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 5;
    const delays = [3000, 5000, 8000, 12000, 18000];

    const fetchDownloadToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('resend-purchase-email', {
          body: {
            customerEmail,
            productId,
            sendEmail: false,
          },
        });

        if (cancelled) return;

        if (data?.token) {
          setDownloadToken(data.token);
          return; // success, stop retrying
        }

        if (error) {
          console.error("Error preparing guest download token:", error);
        }
      } catch (err) {
        console.error("Error fetching download token:", err);
      }

      // Retry if no token yet
      attempt++;
      if (!cancelled && attempt < maxAttempts) {
        setTimeout(fetchDownloadToken, delays[attempt] || 5000);
      }
    };

    const timer = setTimeout(fetchDownloadToken, delays[0]);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customerEmail, productId, isLesson]);

  useEffect(() => {
    const handleFreePurchase = async () => {
      if (!isFree || !customerEmail || !productId || notificationSent) return;

      try {
        console.log("Processing free purchase...", { productId, customerEmail, isLesson });

        const { data: product } = await supabase
          .from('products')
          .select('title, price')
          .eq('id', productId)
          .single();

        if (!product) {
          console.error("Product not found");
          return;
        }

        const productTitle = product.title;

        if (isLesson) {
          console.log("Sending free lesson notification...");
          
          let durationMinutes = 60;
          if (productTitle.includes("2 Hour")) {
            durationMinutes = 120;
          } else if (productTitle.includes("4 Lesson")) {
            durationMinutes = 60;
          }

          const { error } = await supabase.functions.invoke('send-lesson-notification', {
            body: {
              customerEmail,
              lessonTitle: productTitle,
              lessonDate,
              lessonTime,
              durationMinutes,
              amountPaid: 0,
              isFree: true,
            },
          });

          if (error) {
            console.error("Failed to send lesson notification:", error);
          }
        } else {
          console.log("Sending free purchase email with download link...");
          
          const { data, error } = await supabase.functions.invoke('redeem-coupon', {
            body: {
              productId,
              customerEmail,
              couponCode: 'FREE_PURCHASE',
            },
          });

          if (error) {
            console.error("Failed to process free purchase:", error);
          } else {
            console.log("Free purchase processed:", data);
          }
        }

        setNotificationSent(true);
      } catch (err) {
        console.error("Error processing free purchase:", err);
      }
    };

    handleFreePurchase();
  }, [isFree, customerEmail, productId, isLesson, lessonDate, lessonTime, notificationSent]);

  const handleCreateAccount = async () => {
    if (!password || password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    if (!customerEmail) return;

    setCreatingAccount(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: customerEmail,
        password,
        options: {
          data: {
            full_name: customerEmail,
          },
          emailRedirectTo: `${window.location.origin}/my-purchases`,
        },
      });

      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account Already Exists",
            description: "You already have an account! Sign in at the top of the site to access your downloads.",
          });
          setAccountCreated(true);
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        setAccountCreated(true);
        toast({
          title: "Account Created! 🎉",
          description: "You can now access all your downloads from My Purchases anytime.",
        });
      }
    } catch (err) {
      console.error("Account creation error:", err);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    }

    setCreatingAccount(false);
  };

  const downloadUrl = downloadToken 
    ? `${window.location.origin}/download?token=${downloadToken}` 
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isLesson ? "Lesson Booked!" : "Payment Successful!"}
          </h1>
          <p className="text-muted-foreground">
            {isLesson 
              ? "Your lesson has been confirmed. Check your email for details and a calendar invite!"
              : "Thank you for your purchase! Your download link has been sent to your email."
            }
          </p>
        </div>

        {/* Download Button for non-lesson products */}
        {!isLesson && downloadUrl && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg space-y-3">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Download className="h-5 w-5" />
              <span className="font-medium">Your Download is Ready</span>
            </div>
            <Button asChild className="w-full" size="lg">
              <a href={downloadUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download Now
              </a>
            </Button>
          </div>
        )}

        {isLesson && lessonDate && lessonTime && (
          <div className="mb-6 p-4 bg-primary/10 rounded-lg space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Calendar className="h-5 w-5" />
              <span className="font-medium">Your Lesson</span>
            </div>
            <p className="text-sm">
              <strong>Date:</strong> {new Date(lessonDate + 'T12:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <p className="text-sm">
              <strong>Time:</strong> {lessonTime} PST
            </p>
          </div>
        )}

        <div className="mb-6 p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            <span className="font-medium">Check your inbox!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLesson 
              ? "You'll receive a confirmation email with a calendar invite (.ics file) that you can add to your Apple Calendar."
              : "We've also emailed your download link. Check your spam/junk folder if you don't see it."
            }
          </p>
          <p className="text-sm text-muted-foreground">
            If you experience any issues, please contact us at{' '}
            <a href="mailto:beau@lowendcandy.com" className="text-primary hover:text-primary/80 font-medium">
              beau@lowendcandy.com
            </a>
          </p>
        </div>

        {/* Account creation prompt */}
        {!isLesson && !accountCreated && customerEmail && (
          <div className="mb-6 p-4 bg-accent/30 rounded-lg space-y-3 border border-accent">
            <div className="flex items-center justify-center gap-2 text-primary">
              <UserPlus className="h-5 w-5" />
              <span className="font-medium">Create an Account (Optional)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create a free account to access all your downloads anytime from{' '}
              <strong>My Purchases</strong> — no digging through email required!
            </p>
            
            {!showAccountCreate ? (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setShowAccountCreate(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Set Up Account
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="text-left space-y-1">
                  <Label htmlFor="account-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input 
                    id="account-email"
                    value={customerEmail} 
                    disabled 
                    className="bg-muted"
                  />
                </div>
                <div className="text-left space-y-1">
                  <Label htmlFor="account-password">Set a Password</Label>
                  <div className="relative">
                    <Input
                      id="account-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
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
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleCreateAccount}
                  disabled={creatingAccount}
                >
                  {creatingAccount ? "Creating..." : "Create Account"}
                </Button>
              </div>
            )}
          </div>
        )}

        {accountCreated && !isLesson && (
          <div className="mb-6 p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-primary">
              ✅ Account set up! Access your downloads anytime from{' '}
              <Link to="/my-purchases" className="font-medium underline">My Purchases</Link>
            </p>
          </div>
        )}

        <Button asChild variant="outline" className="w-full">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Back to Store
          </Link>
        </Button>

        {sessionId && (
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">Session ID:</p>
            <p className="text-xs font-mono break-all text-muted-foreground">{sessionId}</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaymentSuccess;