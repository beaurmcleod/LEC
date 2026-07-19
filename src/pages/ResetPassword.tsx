import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft, CheckCircle } from "lucide-react";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    // The recovery link carries its token in the URL. Supabase's detectSessionInUrl
    // consumes that token at client-init time — usually BEFORE this component mounts —
    // which establishes a session, emits PASSWORD_RECOVERY, and strips the token from
    // the URL. So by the time we get here the event has often already fired and the
    // hash is gone. Relying only on catching the event / reading the hash therefore
    // shows a false "Invalid Reset Link" for perfectly valid links. The reliable
    // signal is the session the link left behind, so we check that first.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      // Covers the rarer case where detection completes AFTER we've mounted.
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      // getSession() awaits client initialization (including URL token detection), so
      // if the recovery link was valid a session exists here regardless of timing.
      setStatus(session ? "ready" : "invalid");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
      } else {
        setSuccess(true);
        toast.success("Password updated successfully!");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Password Updated!</h1>
          <p className="text-muted-foreground mb-6">Your password has been reset successfully.</p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Go to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-4 animate-spin" />
          <p className="text-muted-foreground">Verifying your reset link…</p>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Reset Link</h1>
          <p className="text-muted-foreground mb-6">
            This link is invalid or has expired. Please request a new password reset.
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Back to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={() => navigate("/auth")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sign In
        </Button>

        <Card className="p-8">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold mb-2">Set New Password</h1>
            <p className="text-muted-foreground">Enter your new password below.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
