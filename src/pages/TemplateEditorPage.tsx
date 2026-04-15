import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TiptapEditor from "@/components/TiptapEditor";
import {
  fetchTemplate,
  createTemplate,
  updateTemplate,
} from "@/lib/api";

export default function TemplateEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(slug);

  const [name, setName] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (slug) {
      fetchTemplate(slug)
        .then((t) => {
          setName(t.name);
          setSlugValue(t.slug);
          setSubject(t.subject);
          setBodyHtml(t.bodyHtml);
        })
        .catch(() => setError("Template not found"))
        .finally(() => setLoading(false));
    }
  }, [slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await updateTemplate(slug!, { name, subject, bodyHtml });
      } else {
        await createTemplate({
          slug: slugValue,
          name,
          subject,
          bodyHtml,
        });
      }
      navigate("/templates");
    } catch {
      setError("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-neutral-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link
          to="/templates"
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          &larr; Templates
        </Link>
        <h1 className="mt-2 text-lg font-semibold">
          {isEdit ? "Edit Template" : "New Template"}
        </h1>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Welcome Email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            value={slugValue}
            onChange={(e) => setSlugValue(e.target.value)}
            placeholder="welcome-email"
            pattern="[a-z0-9-]+"
            title="Lowercase letters, numbers, and hyphens only"
            disabled={isEdit}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Welcome, {{name}}!"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Body</Label>
          <TiptapEditor content={bodyHtml} onUpdate={setBodyHtml} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/templates")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
