import 'server-only';
import { DEMO_MODE } from '@/lib/demo';

import { Resend } from 'resend';

/**
 * The one place Resend is spoken to.
 *
 * An interface, so the service can be tested against a memory double and
 * so a provider change is one file. Nothing else in the codebase imports
 * `resend`.
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  /** Set for an inline image referenced as `cid:<contentId>` from the HTML. */
  contentId?: string;
}

export interface EmailMessage {
  from: string;
  to: string;
  replyTo?: string | null;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  /** Resend tags, for filtering in their dashboard. Values: letters, numbers, `_` and `-` only. */
  tags?: Record<string, string>;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

let cached: EmailTransport | null | undefined;

export function resendTransport(): EmailTransport | null {
  if (DEMO_MODE) return null;
  if (cached !== undefined) return cached;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    cached = null;
    return cached;
  }
  const client = new Resend(key);
  cached = {
    async send(message) {
      const { data, error } = await client.emails.send({
        from: message.from,
        to: message.to,
        replyTo: message.replyTo ?? undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        attachments: message.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          contentType: attachment.contentType,
          contentId: attachment.contentId,
        })),
        tags: message.tags ? Object.entries(message.tags).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, '_') })) : undefined,
      });
      if (error) throw new Error(error.message);
      return { id: data?.id ?? null };
    },
  };
  return cached;
}
