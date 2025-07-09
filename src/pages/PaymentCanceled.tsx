import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";

const PaymentCanceled = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <div className="mb-6">
          <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Payment Canceled</h1>
          <p className="text-muted-foreground">
            Your payment was canceled. No charges were made to your account.
          </p>
        </div>

        <div className="space-y-3">
          <Button asChild variant="default" className="w-full">
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Continue Shopping
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/#products">
              <ShoppingCart className="h-4 w-4 mr-2" />
              View Products
            </Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          If you experienced any issues, please contact our support team.
        </p>
      </Card>
    </div>
  );
};

export default PaymentCanceled;