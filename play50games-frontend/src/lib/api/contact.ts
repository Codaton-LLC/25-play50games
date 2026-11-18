// Contact form client: POST play50/v1/contact (play50games-backend includes/contact-api.php).
// validateContact mirrors the server rules, so most mistakes show before a request is sent;
// the server checks everything again and its per-field errors win.
import { getApiBase } from "./apiBase";
import { getApiHeaders } from "./apiUtils";

export const CONTACT_LIMITS = {
   name: 80,
   subject: 120,
   messageMin: 10,
   messageMax: 4000,
} as const;

export interface ContactValues {
   name: string;
   email: string;
   subject: string;
   message: string;
}

export type ContactField = keyof ContactValues;
export type ContactFieldErrors = Partial<Record<ContactField, string>>;

export interface ContactPayload extends ContactValues {
   /** Honeypot: hidden from people, must stay empty. */
   website: string;
   /** Milliseconds between the form being shown and the submit (the client's own clock). */
   elapsed_ms: number;
}

export type ContactResult =
   | { ok: true; saved?: boolean }
   | { ok: false; kind: "invalid"; fields: ContactFieldErrors; message: string }
   | { ok: false; kind: "rate_limited"; retryAfter: number; message: string }
   | { ok: false; kind: "too_fast"; message: string }
   | { ok: false; kind: "error"; message: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(values: ContactValues): ContactFieldErrors {
   const errors: ContactFieldErrors = {};
   const name = values.name.trim();
   const email = values.email.trim();
   const subject = values.subject.trim();
   const message = values.message.trim();

   if (!name) errors.name = "Enter your name.";
   else if (name.length > CONTACT_LIMITS.name) errors.name = `Use ${CONTACT_LIMITS.name} characters or fewer.`;

   if (!email) errors.email = "Enter your email address.";
   else if (!EMAIL.test(email)) errors.email = "Enter a valid email address.";

   if (subject.length > CONTACT_LIMITS.subject) errors.subject = `Use ${CONTACT_LIMITS.subject} characters or fewer.`;

   if (!message) errors.message = "Write a message.";
   else if (message.length < CONTACT_LIMITS.messageMin) errors.message = `Write at least ${CONTACT_LIMITS.messageMin} characters.`;
   else if (message.length > CONTACT_LIMITS.messageMax) errors.message = `Use ${CONTACT_LIMITS.messageMax} characters or fewer.`;

   return errors;
}

const GENERIC = "We could not send your message. Please try again.";
const FIELDS: ContactField[] = ["name", "email", "subject", "message"];

function pickFields(raw: unknown): ContactFieldErrors {
   const out: ContactFieldErrors = {};
   if (!raw || typeof raw !== "object") return out;
   for (const key of FIELDS) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "string" && value) out[key] = value;
   }
   return out;
}

/** Sends one message. Never throws: every outcome is a ContactResult. */
export async function sendContact(payload: ContactPayload): Promise<ContactResult> {
   // The API key goes along like every other call; no login is needed, so no Authorization header.
   const headers = getApiHeaders();
   delete headers.Authorization;

   let response: Response;
   try {
      response = await fetch(`${getApiBase()}/contact`, {
         method: "POST",
         headers,
         body: JSON.stringify({
            name: payload.name.trim(),
            email: payload.email.trim(),
            subject: payload.subject.trim(),
            message: payload.message.trim(),
            website: payload.website,
            elapsed_ms: Math.max(0, Math.round(payload.elapsed_ms)),
         }),
      });
   } catch {
      return { ok: false, kind: "error", message: "We could not reach the server. Check your connection and try again." };
   }

   let body: Record<string, unknown> = {};
   try {
      const parsed = await response.json();
      if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
   } catch {
      // not JSON: handled by the status below
   }

   if (response.ok && body.ok === true) return { ok: true };

   // WP_Error body: { code, message, data: { status, fields?, retry_after?, saved? } }
   const code = typeof body.code === "string" ? body.code : "";
   const message = typeof body.message === "string" && body.message ? body.message : GENERIC;
   const data = (body.data && typeof body.data === "object" ? body.data : {}) as Record<string, unknown>;

   if (code === "mail_failed" && data.saved === true) return { ok: true, saved: true };
   if (code === "invalid_data") return { ok: false, kind: "invalid", fields: pickFields(data.fields), message };
   if (code === "rate_limited" || response.status === 429) {
      const retryAfter = typeof data.retry_after === "number" && data.retry_after > 0 ? data.retry_after : 600;
      return { ok: false, kind: "rate_limited", retryAfter, message };
   }
   if (code === "too_fast") return { ok: false, kind: "too_fast", message };
   return { ok: false, kind: "error", message: GENERIC };
}

/** "about 7 minutes", "about 1 hour": for the rate-limit notice. */
export function waitText(seconds: number): string {
   if (seconds < 90) return "a minute";
   const minutes = Math.ceil(seconds / 60);
   if (minutes < 90) return `about ${minutes} minutes`;
   const hours = Math.round(minutes / 60);
   return hours === 1 ? "about an hour" : `about ${hours} hours`;
}
