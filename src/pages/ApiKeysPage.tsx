import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchApiKeyInfo,
  generateApiKey,
  revokeApiKey,
} from "@/lib/api";
import type { ApiKeyInfo } from "@/lib/api";

export default function ApiKeysPage() {
  const [keyInfo, setKeyInfo] = useState<ApiKeyInfo | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<
    "regenerate" | "revoke" | null
  >(null);

  useEffect(() => {
    fetchApiKeyInfo()
      .then((res) => setKeyInfo(res.key))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    const res = await generateApiKey();
    setNewKey(res.key);
    setKeyInfo({ prefix: res.prefix, createdAt: res.createdAt });
    setConfirmAction(null);
  }

  async function handleRevoke() {
    await revokeApiKey();
    setKeyInfo(null);
    setNewKey(null);
    setConfirmAction(null);
  }

  function handleCopy() {
    if (newKey) navigator.clipboard.writeText(newKey);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          &larr; Inbox
        </Link>
        <h1 className="text-lg font-semibold">API Access</h1>
      </div>

      {/* Newly generated key — show once */}
      {newKey && (
        <Card className="mb-6 border-amber-300 bg-amber-50">
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium text-amber-800">
              Your API key (copy it now — it won't be shown again):
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={newKey}
                className="font-mono text-sm"
              />
              <Button size="sm" variant="outline" onClick={handleCopy}>
                Copy
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => setNewKey(null)}
            >
              Done
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current key info */}
      {keyInfo && !newKey && (
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm">{keyInfo.prefix}</p>
                <p className="text-xs text-neutral-500">
                  Created{" "}
                  {new Date(keyInfo.createdAt * 1000).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmAction("regenerate")}
                >
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => setConfirmAction("revoke")}
                >
                  Revoke
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No key yet */}
      {!keyInfo && !newKey && (
        <Card className="mb-6">
          <CardContent className="py-4 text-center">
            <p className="mb-3 text-sm text-neutral-500">
              No API key generated yet.
            </p>
            <Button size="sm" onClick={handleGenerate}>
              Generate API Key
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage instructions */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-2 text-sm font-semibold">Usage</h2>
        <p className="mb-2 text-sm text-neutral-600">
          Include your API key in the <code>Authorization</code> header:
        </p>
        <pre className="rounded bg-neutral-100 p-3 text-xs">
{`curl -H "Authorization: Bearer sk_..." \\
  https://your-domain/api/senders`}
        </pre>
        <p className="mt-2 text-sm text-neutral-600">
          The key grants full access to the API as your user account. See{" "}
          <a href="/swagger-ui" className="text-blue-600 hover:underline">
            API docs
          </a>{" "}
          for available endpoints.
        </p>
      </div>

      {/* Confirmation dialog */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={() => setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "regenerate"
                ? "Regenerate API Key?"
                : "Revoke API Key?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "regenerate"
                ? "This will invalidate your current key and generate a new one. Any integrations using the old key will stop working."
                : "This will permanently delete your API key. Any integrations using it will stop working."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirmAction === "revoke" ? "destructive" : "default"
              }
              onClick={
                confirmAction === "regenerate"
                  ? handleGenerate
                  : handleRevoke
              }
            >
              {confirmAction === "regenerate" ? "Regenerate" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
