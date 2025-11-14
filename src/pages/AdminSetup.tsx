import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const AdminSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [canClaimAdmin, setCanClaimAdmin] = useState(false);
  const [adminExists, setAdminExists] = useState(false);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in first");
        navigate("/auth");
        return;
      }

      setUser(user);

      // Check if any admin role exists in the system
      const { data: existingAdmins, error: adminCheckError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (adminCheckError) throw adminCheckError;

      if (existingAdmins && existingAdmins.length > 0) {
        setAdminExists(true);
        setCanClaimAdmin(false);
        toast.info("Admin already exists. Redirecting...");
        setTimeout(() => navigate("/"), 2000);
      } else {
        setCanClaimAdmin(true);
      }

    } catch (error) {
      console.error('Error checking setup status:', error);
      toast.error("Failed to check setup status");
    } finally {
      setLoading(false);
    }
  };

  const claimAdminRole = async () => {
    if (!user || !canClaimAdmin) return;

    setClaiming(true);
    try {
      // Double-check that no admin exists (race condition protection)
      const { data: existingAdmins, error: checkError } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (checkError) throw checkError;

      if (existingAdmins && existingAdmins.length > 0) {
        toast.error("An admin was just created. Please refresh the page.");
        setAdminExists(true);
        setCanClaimAdmin(false);
        return;
      }

      // Claim admin role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'admin'
        });

      if (insertError) throw insertError;

      toast.success("Admin role claimed successfully!");
      setTimeout(() => {
        navigate("/admin/dashboard");
      }, 1500);

    } catch (error: any) {
      console.error('Error claiming admin role:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error("Admin role already claimed");
      } else {
        toast.error("Failed to claim admin role");
      }
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          {canClaimAdmin ? (
            <Card className="border-primary/20">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Admin Setup</CardTitle>
                <CardDescription>
                  No admin exists yet. Claim the admin role to get started.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">You're signed in as:</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    As an admin, you'll be able to:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>View link click analytics</li>
                    <li>Access the admin dashboard</li>
                    <li>Manage products and content</li>
                  </ul>
                </div>

                <Button
                  onClick={claimAdminRole}
                  disabled={claiming}
                  className="w-full"
                  size="lg"
                >
                  {claiming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming Admin Role...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Claim Admin Role
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  This is a one-time setup. Once an admin is created, this page will no longer be accessible.
                </p>
              </CardContent>
            </Card>
          ) : adminExists ? (
            <Card>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <CardTitle>Admin Already Exists</CardTitle>
                <CardDescription>
                  An administrator has already been set up for this application.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => navigate("/")}
                  variant="outline"
                  className="w-full"
                >
                  Go to Home
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AdminSetup;
