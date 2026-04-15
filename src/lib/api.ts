export interface Sender {
  id: string;
  email: string;
  name: string | null;
  lastEmailAt: number;
  unreadCount: number;
  totalCount: number;
  latestSubject?: string | null;
}

export interface Email {
  id: string;
  type: "received" | "sent";
  senderId: string | null;
  recipient: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  subject: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  isRead: number | null;
  timestamp: number;
  attachmentCount?: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface Stats {
  totalSenders: number;
  totalEmails: number;
  unreadCount: number;
  recipients: string[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export async function fetchSenders(params?: {
  q?: string;
  recipient?: string;
  page?: number;
  limit?: number;
}): Promise<Sender[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.recipient) qs.set("recipient", params.recipient);
  if (params?.page) qs.set("page", params.page.toString());
  if (params?.limit) qs.set("limit", params.limit.toString());
  return apiFetch(`/api/senders?${qs}`);
}

export async function fetchSender(id: string): Promise<Sender> {
  return apiFetch(`/api/senders/${id}`);
}

export async function fetchSenderEmails(
  senderId: string,
  params?: { q?: string; page?: number; limit?: number }
): Promise<Email[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.page) qs.set("page", params.page.toString());
  if (params?.limit) qs.set("limit", params.limit.toString());
  return apiFetch(`/api/emails/by-sender/${senderId}?${qs}`);
}

export async function fetchEmail(id: string): Promise<Email> {
  return apiFetch(`/api/emails/${id}`);
}

export async function markEmailRead(id: string, isRead: boolean): Promise<void> {
  await apiFetch(`/api/emails/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isRead }),
  });
}

export async function sendEmail(data: {
  to: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}): Promise<{ id: string }> {
  return apiFetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function replyToEmail(
  emailId: string,
  data: { bodyHtml: string; bodyText?: string }
): Promise<{ id: string }> {
  return apiFetch(`/api/send/reply/${emailId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function fetchStats(recipient?: string): Promise<Stats> {
  const qs = recipient ? `?recipient=${recipient}` : "";
  return apiFetch(`/api/stats${qs}`);
}

export interface EmailTemplate {
  id: string;
  slug: string;
  name: string;
  subject: string;
  bodyHtml: string;
  createdAt: number;
  updatedAt: number;
}

export async function fetchTemplates(): Promise<EmailTemplate[]> {
  return apiFetch("/api/email-templates");
}

export async function fetchTemplate(slug: string): Promise<EmailTemplate> {
  return apiFetch(`/api/email-templates/${slug}`);
}

export async function createTemplate(data: {
  slug: string;
  name: string;
  subject: string;
  bodyHtml: string;
}): Promise<EmailTemplate> {
  return apiFetch("/api/email-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateTemplate(
  slug: string,
  data: { name?: string; subject?: string; bodyHtml?: string }
): Promise<EmailTemplate> {
  return apiFetch(`/api/email-templates/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteTemplate(
  slug: string
): Promise<{ success: boolean }> {
  return apiFetch(`/api/email-templates/${slug}`, {
    method: "DELETE",
  });
}
