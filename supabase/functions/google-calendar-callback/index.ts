import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("Google OAuth error:", error);
      return new Response(
        generateHTML("error", "Authorization was denied or failed."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    if (!code || !state) {
      console.error("Missing code or state");
      return new Response(
        generateHTML("error", "Missing authorization code or state."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Decode state to get user ID
    let userId: string;
    try {
      const stateData = JSON.parse(atob(state));
      userId = stateData.userId;
    } catch (e) {
      console.error("Failed to decode state:", e);
      return new Response(
        generateHTML("error", "Invalid state parameter."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokenData);
      return new Response(
        generateHTML("error", "Failed to exchange authorization code."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    console.log("Token exchange successful for user:", userId);

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in database
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await supabase
      .from("google_calendar_tokens")
      .upsert({
        user_id: userId,
        access_token,
        refresh_token,
        token_expiry: tokenExpiry,
        calendar_id: "primary",
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to store tokens:", upsertError);
      return new Response(
        generateHTML("error", "Failed to save calendar connection."),
        { headers: { "Content-Type": "text/html" } }
      );
    }

    console.log("Tokens stored successfully for user:", userId);

    return new Response(
      generateHTML("success", "Google Calendar connected successfully! You can close this window."),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (error) {
    console.error("Error in google-calendar-callback:", error);
    return new Response(
      generateHTML("error", "An unexpected error occurred."),
      { headers: { "Content-Type": "text/html" } }
    );
  }
});

function generateHTML(status: "success" | "error", message: string): string {
  const color = status === "success" ? "#10b981" : "#ef4444";
  const icon = status === "success" ? "✓" : "✕";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendar Connection ${status === "success" ? "Complete" : "Failed"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #0f0f0f;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      color: ${color};
      margin-bottom: 1rem;
    }
    .message {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
    }
    .close-btn {
      background: ${color};
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 0.5rem;
      font-size: 1rem;
      cursor: pointer;
    }
    .close-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${icon}</div>
    <p class="message">${message}</p>
    <button class="close-btn" onclick="window.close()">Close Window</button>
  </div>
  <script>
    // Auto-close after 3 seconds on success
    ${status === "success" ? "setTimeout(() => window.close(), 3000);" : ""}
  </script>
</body>
</html>
  `;
}
