import * as authSchema from "./auth.schema";
import { senders } from "./senders.schema";
import { emails } from "./emails.schema";
import { sentEmails } from "./sent-emails.schema";
import { attachments } from "./attachments.schema";
import { emailTemplates } from "./email-templates.schema";

export const schema = {
  ...authSchema,
  senders,
  emails,
  sentEmails,
  attachments,
  emailTemplates,
} as const;
