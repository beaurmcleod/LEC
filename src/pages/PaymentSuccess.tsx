import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Download, Home } from "lucide-react";

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
            Thank you for your purchase. Your payment has been processed successfully.
          </p>
        </div>

        {sessionId && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Session ID:</p>
            <p className="text-xs font-mono break-all">{sessionId}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button className="w-full" variant="default">
            <Download className="h-4 w-4 mr-2" />
            Download Your Files
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Store
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          Download links will also be sent to your email address.
        </p>
      </Card>
    </div>
  );
};

export default PaymentSuccess;