import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LinkClickData {
  link_title: string;
  link_url: string;
  click_count: number;
}

interface TimeSeriesData {
  date: string;
  clicks: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [popularLinks, setPopularLinks] = useState<LinkClickData[]>([]);
  const [clickTrends, setClickTrends] = useState<TimeSeriesData[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [sendingManual, setSendingManual] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to access the admin dashboard");
        navigate("/auth");
        return;
      }

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError || !roleData) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await fetchAnalytics();
    } catch (error) {
      console.error('Error checking admin access:', error);
      toast.error("Failed to verify access");
      navigate("/");
    }
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch all link clicks
      const { data: clicks, error } = await supabase
        .from('link_clicks')
        .select('*')
        .order('clicked_at', { ascending: false });

      if (error) throw error;

      if (!clicks || clicks.length === 0) {
        setLoading(false);
        return;
      }

      setTotalClicks(clicks.length);

      // Aggregate clicks by link
      const linkMap = new Map<string, LinkClickData>();
      clicks.forEach(click => {
        const key = click.link_url;
        if (linkMap.has(key)) {
          const existing = linkMap.get(key)!;
          existing.click_count += 1;
        } else {
          linkMap.set(key, {
            link_title: click.link_title,
            link_url: click.link_url,
            click_count: 1,
          });
        }
      });

      // Sort by click count and get top links
      const sortedLinks = Array.from(linkMap.values())
        .sort((a, b) => b.click_count - a.click_count)
        .slice(0, 10);
      setPopularLinks(sortedLinks);

      // Aggregate clicks by date for trend analysis
      const dateMap = new Map<string, number>();
      clicks.forEach(click => {
        const date = new Date(click.clicked_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });

      // Convert to array and sort by date
      const trendData = Array.from(dateMap.entries())
        .map(([date, clicks]) => ({ date, clicks }))
        .slice(-14); // Last 14 days
      setClickTrends(trendData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const handleSendManualPurchases = async () => {
    setSendingManual(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const purchases = [
        { email: "jnmalgas@gmail.com", name: "Jon Casey" },
        { email: "wtfischee@gmail.com", name: "Lee Chee" },
        { email: "arnold@reinvented.ai", name: "Arnold Adel" },
        { email: "Strongbycory@gmail.com", name: "Cory Etchason" },
        { email: "danemorrismusic@gmail.com", name: "Dane Morris" },
        { email: "Pdawgsurf@gmail.com", name: "Perry Morrison" },
        { email: "emileestech@gmail.com", name: "Emi Stech" },
      ];

      const response = await fetch(
        "https://ocydkbblpnshbvkilngl.supabase.co/functions/v1/add-manual-purchases",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productId: "8fbb3028-e57f-4e44-91ab-44f9229aaf8f",
            productTitle: "Key & BPM Finder",
            purchases,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send");
      }

      toast.success(`Sent ${result.results.length} purchases to GHL!`);
      console.log("Results:", result.results);
    } catch (error) {
      console.error("Error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send");
    } finally {
      setSendingManual(false);
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

  if (!isAdmin) {
    return null;
  }

  const chartConfig = {
    clicks: {
      label: "Clicks",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Link click analytics and trends</p>
        </div>

        {/* Manual Purchases Card - Temporary */}
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <CardTitle>Add Manual Purchases</CardTitle>
            <CardDescription>Send 7 Key & BPM Finder purchases to GHL</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Button
              onClick={handleSendManualPurchases}
              disabled={sendingManual}
              className="gap-2"
            >
              {sendingManual ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sendingManual ? "Sending..." : "Send 7 Purchases"}
            </Button>
          </CardContent>
        </Card>


        {/* Summary Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Total Link Clicks</CardTitle>
            <CardDescription>All-time link engagement</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{totalClicks.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Popular Links Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Most Popular Links</CardTitle>
            <CardDescription>Top 10 links by click count</CardDescription>
          </CardHeader>
          <CardContent>
            {popularLinks.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularLinks} layout="vertical" margin={{ left: 150, right: 20, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="link_title" 
                      type="category" 
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="click_count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No click data available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Click Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Click Trends Over Time</CardTitle>
            <CardDescription>Daily click activity (last 14 days)</CardDescription>
          </CardHeader>
          <CardContent>
            {clickTrends.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={clickTrends} margin={{ left: 20, right: 20, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="clicks" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No trend data available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Breakdown Table */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Click Breakdown</CardTitle>
            <CardDescription>Detailed view of clicks by day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clickTrends.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        No click data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    clickTrends.slice().reverse().map((day, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{day.date}</TableCell>
                        <TableCell className="text-right">{day.clicks}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default AdminDashboard;
