import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Home, Mail } from "lucide-react";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground">
            Thank you for your purchase. Your download link has been sent to your email.
          </p>
        </div>

        <div className="mb-6 p-4 bg-muted rounded-lg space-y-3">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Mail className="h-5 w-5" />
            <span className="font-medium">Check your inbox!</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Please also check your <strong>spam/junk folder</strong> if you don't see the email right away.
          </p>
          <p className="text-sm text-muted-foreground">
            If you haven't received your download link within <strong>10 minutes</strong>, please contact us at{' '}
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
