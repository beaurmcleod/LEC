import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startDate, endDate } = await req.json();

    if (!startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: "Missing startDate or endDate" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate date range: must be valid dates, max 90 days, end after start, not too far in past/future
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = Date.now();
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid date format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rangeMs = end.getTime() - start.getTime();
    const maxRangeMs = 90 * 24 * 60 * 60 * 1000;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    if (rangeMs <= 0 || rangeMs > maxRangeMs) {
      return new Response(JSON.stringify({ error: "Date range must be 1-90 days" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (start.getTime() < now - 7 * 24 * 60 * 60 * 1000 || end.getTime() > now + oneYearMs) {
      return new Response(JSON.stringify({ error: "Date range out of bounds" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the first admin's calendar tokens (you can adjust this to a specific admin if needed)
    const { data: tokenData, error: tokenError } = await supabase
      .from("google_calendar_tokens")
      .select("*")
      .limit(1)
      .single();

    if (tokenError || !tokenData) {
      console.log("No calendar connected yet:", tokenError);
      // Return empty busy times if no calendar is connected
      return new Response(
        JSON.stringify({ busyTimes: [], connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.token_expiry);

    // Check if token is expired and refresh if needed
    if (tokenExpiry <= new Date()) {
      console.log("Token expired, refreshing...");
      
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: tokenData.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        console.error("Token refresh failed:", refreshData);
        return new Response(
          JSON.stringify({ error: "Failed to refresh token", connected: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accessToken = refreshData.access_token;
      const newExpiry = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

      // Update the stored token
      await supabase
        .from("google_calendar_tokens")
        .update({
          access_token: accessToken,
          token_expiry: newExpiry,
        })
        .eq("id", tokenData.id);

      console.log("Token refreshed successfully");
    }

    // Fetch busy times from Google Calendar
    const calendarId = tokenData.calendar_id || "primary";
    const freeBusyUrl = "https://www.googleapis.com/calendar/v3/freeBusy";

    const freeBusyResponse = await fetch(freeBusyUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: startDate,
        timeMax: endDate,
        items: [{ id: calendarId }],
      }),
    });

    const freeBusyData = await freeBusyResponse.json();

    if (!freeBusyResponse.ok) {
      console.error("Google Calendar API error:", freeBusyData);
      return new Response(
        JSON.stringify({ error: "Failed to fetch calendar data", connected: true }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const busyTimes = freeBusyData.calendars?.[calendarId]?.busy || [];
    console.log(`Found ${busyTimes.length} busy time slots`);

    return new Response(
      JSON.stringify({ busyTimes, connected: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-calendar-busy-times:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
