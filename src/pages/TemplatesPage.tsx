import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchTemplates, deleteTemplate } from "@/lib/api";
import type { EmailTemplate } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(slug: string) {
    if (!confirm("Delete this template?")) return;
    await deleteTemplate(slug);
    setTemplates((prev) => prev.filter((t) => t.slug !== slug));
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-700">
            &larr; Inbox
          </Link>
          <h1 className="text-lg font-semibold">Email Templates</h1>
        </div>
        <Button size="sm" onClick={() => navigate("/templates/new")}>
          New Template
        </Button>
      </div>

      {loading ? (
        <p className="text-neutral-500">Loading...</p>
      ) : templates.length === 0 ? (
        <p className="text-neutral-500">No templates yet.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-sm text-neutral-500">
                    {t.slug} &middot; {t.subject}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/templates/${t.slug}/edit`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleDelete(t.slug)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
