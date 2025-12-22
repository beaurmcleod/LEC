import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Calendar, CheckCircle, XCircle } from "lucide-react";
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
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [connectingCalendar, setConnectingCalendar] = useState(false);

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
      await Promise.all([fetchAnalytics(), checkCalendarConnection()]);
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

  const checkCalendarConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-calendar-busy-times", {
        body: { startDate: new Date().toISOString(), endDate: new Date().toISOString() },
      });
      setCalendarConnected(data?.connected || false);
    } catch (error) {
      console.error("Error checking calendar connection:", error);
    }
  };

  const connectGoogleCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in first");
        return;
      }

      const { data, error } = await supabase.functions.invoke("google-calendar-auth", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        toast.error("Failed to start Google Calendar authorization");
        return;
      }

      // Open Google OAuth in a new window
      const authWindow = window.open(data.authUrl, "_blank", "width=500,height=600");
      
      // Poll to check if the connection was successful
      const pollInterval = setInterval(async () => {
        await checkCalendarConnection();
        if (calendarConnected || !authWindow || authWindow.closed) {
          clearInterval(pollInterval);
          if (calendarConnected) {
            toast.success("Google Calendar connected successfully!");
          }
        }
      }, 2000);

      // Stop polling after 2 minutes
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch (error) {
      console.error("Error connecting Google Calendar:", error);
      toast.error("Failed to connect Google Calendar");
    } finally {
      setConnectingCalendar(false);
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

        {/* Google Calendar Connection */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>
              Connect your Google Calendar to automatically block unavailable time slots on the lessons booking page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {calendarConnected ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-500 font-medium">Calendar Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>
              <Button 
                onClick={connectGoogleCalendar} 
                disabled={connectingCalendar}
                variant={calendarConnected ? "outline" : "default"}
              >
                {connectingCalendar && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {calendarConnected ? "Reconnect Calendar" : "Connect Google Calendar"}
              </Button>
            </div>
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
