import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Home, Mail, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [notificationSent, setNotificationSent] = useState(false);
  
  const sessionId = searchParams.get("session_id");
  const productId = searchParams.get("product_id");
  const customerEmail = searchParams.get("customer_email");
  const isFree = searchParams.get("free") === "true";
  const lessonDate = searchParams.get("lesson_date");
  const lessonTime = searchParams.get("lesson_time");
  
  // Determine if this is a lesson booking
  const isLesson = !!(lessonDate && lessonTime);

  useEffect(() => {
    const handleFreePurchase = async () => {
      if (!isFree || !customerEmail || !productId || notificationSent) return;

      try {
        console.log("Processing free purchase...", { productId, customerEmail, isLesson });

        // Get product info
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
          // Send lesson notification for free lessons
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
          } else {
            console.log("Lesson notification sent successfully");
          }
        } else {
          // Send purchase email with download link for free product purchases
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
            console.log("Free purchase processed, email sent:", data);
          }
        }

        setNotificationSent(true);
      } catch (err) {
        console.error("Error processing free purchase:", err);
      }
    };

    handleFreePurchase();
  }, [isFree, customerEmail, productId, isLesson, lessonDate, lessonTime, notificationSent]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isLesson ? "Lesson Booked!" : "Payment Successful!"}
          </h1>
          <p className="text-muted-foreground">
            {isLesson 
              ? "Your lesson has been confirmed. Check your email for details and a calendar invite!"
              : "Thank you for your purchase. Your download link has been sent to your email."
            }
          </p>
        </div>

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
              : "Please also check your spam/junk folder if you don't see the email right away."
            }
          </p>
          <p className="text-sm text-muted-foreground">
            If you haven't received your email within <strong>10 minutes</strong>, please contact us at{' '}
            <a href="mailto:beau@lowendcandy.com" className="text-primary hover:text-primary/80 font-medium">
              beau@lowendcandy.com
            </a>
          </p>
        </div>

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
