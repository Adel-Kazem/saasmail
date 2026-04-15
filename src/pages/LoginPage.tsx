import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/setup/status");
        const data = (await res.json()) as { setupRequired: boolean };
        if (!cancelled) setSetupRequired(data.setupRequired);
      } catch {
        if (!cancelled) setSetupRequired(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (setupRequired === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-main">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (setupRequired) {
    return <Navigate to="/onboarding" replace />;
  }

  async function handlePasskeyLogin() {
    setLoading(true);
    setError("");
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setError(result.error.message || "Passkey sign-in failed");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Passkey sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-main">
      <Card className="w-full max-w-sm border-border-dark bg-card">
        <CardHeader>
          <CardTitle className="text-xl text-text-primary">cmail</CardTitle>
          <p className="text-xs text-text-secondary">
            Sign in with your passkey to continue.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            className="w-full rounded-md bg-accent py-2 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            onClick={handlePasskeyLogin}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in with Passkey"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
