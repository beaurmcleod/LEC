import { useEffect } from "react";

const SKOOL_URL = "https://www.skool.com/low-end-candy-collective-1686/about?ref=0475f2cfd1a94b63a5a389be8a3cb450";

export default function SkoolRedirect() {
  useEffect(() => {
    window.location.href = SKOOL_URL;
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Skool...</p>
    </div>
  );
}
