import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, AlertTriangle, Home, Loader2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CancelLesson = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"loading" | "confirming" | "success" | "error">("confirming");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [bookingDetails, setBookingDetails] = useState<{
    productTitle: string;
    lessonDate: string;
    lessonTime: string;
  } | null>(null);

  const handleCancel = async () => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No cancellation token provided");
      return;
    }

    setStatus("loading");

    try {
      const { data, error } = await supabase.functions.invoke("cancel-lesson", {
        body: { token },
      });

      if (error) {
        console.error("Cancellation error:", error);
        setStatus("error");
        setErrorMessage(error.message || "Failed to cancel lesson");
        return;
      }

      if (data?.error) {
        setStatus("error");
        setErrorMessage(data.error);
        return;
      }

      setBookingDetails(data.booking);
      setStatus("success");
    } catch (err) {
      console.error("Unexpected error:", err);
      setStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground mb-6">
            This cancellation link is invalid or has expired.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === "confirming" && (
          <>
            <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Cancel Your Lesson?</h1>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to cancel this lesson? This action cannot be undone.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              <strong>Note:</strong> Lessons can only be cancelled at least 24 hours before the scheduled time.
            </p>
            <div className="flex flex-col gap-3">
              <Button 
                variant="destructive" 
                className="w-full"
                onClick={handleCancel}
              >
                Yes, Cancel My Lesson
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  No, Go Back
                </Link>
              </Button>
            </div>
          </>
        )}

        {status === "loading" && (
          <>
            <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Cancelling...</h1>
            <p className="text-muted-foreground">
              Please wait while we process your cancellation.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Lesson Cancelled</h1>
            <p className="text-muted-foreground mb-6">
              Your lesson has been successfully cancelled. You'll receive a confirmation email shortly.
            </p>
            
            {bookingDetails && (
              <div className="mb-6 p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Calendar className="h-5 w-5" />
                  <span className="font-medium">Cancelled Lesson</span>
                </div>
                <p className="text-sm">
                  <strong>Lesson:</strong> {bookingDetails.productTitle}
                </p>
                <p className="text-sm">
                  <strong>Date:</strong> {new Date(bookingDetails.lessonDate + 'T12:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="text-sm">
                  <strong>Time:</strong> {bookingDetails.lessonTime} PST
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link to="/lessons">
                  Reschedule a Lesson
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Cancellation Failed</h1>
            <p className="text-muted-foreground mb-6">
              {errorMessage}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              If you need help, please contact us at{' '}
              <a href="mailto:beau@lowendcandy.com" className="text-primary hover:text-primary/80 font-medium">
                beau@lowendcandy.com
              </a>
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Back to Home
              </Link>
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default CancelLesson;
