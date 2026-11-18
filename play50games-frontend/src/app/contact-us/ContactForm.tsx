"use client";

// The message form of the contact page: a label above every field, the error below it, one
// primary button (docs/design/DESIGN.md §4). Sends to POST play50/v1/contact (lib/api/contact).
// States: idle, sending, sent, field errors, and a notice for rate limits and server errors.
import { useEffect, useRef, useState } from "react";
import form from "@/components/Site/form.module.css";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import {
   CONTACT_LIMITS,
   sendContact,
   validateContact,
   waitText,
   type ContactField,
   type ContactFieldErrors,
   type ContactValues,
} from "@/lib/api/contact";
import styles from "./page.module.css";

const EMPTY: ContactValues = { name: "", email: "", subject: "", message: "" };
const ORDER: ContactField[] = ["name", "email", "subject", "message"];

// The value is what lands in the email subject.
const SUBJECTS = ["General question", "Technical support", "Report a bug", "Certificate issue", "Account issue", "Other"];

type Notice = { tone: "error" | "info"; text: string; retry: boolean } | null;

export default function ContactForm() {
   const [values, setValues] = useState<ContactValues>(EMPTY);
   const [errors, setErrors] = useState<ContactFieldErrors>({});
   const [sending, setSending] = useState(false);
   const [sent, setSent] = useState(false);
   const [notice, setNotice] = useState<Notice>(null);
   const [honeypot, setHoneypot] = useState("");
   const shownAt = useRef(0);
   const formRef = useRef<HTMLFormElement>(null);
   const doneRef = useRef<HTMLParagraphElement>(null);

   // When the form appeared: a person takes longer than a few seconds to fill it in.
   useEffect(() => {
      if (!sent) shownAt.current = Date.now();
   }, [sent]);

   useEffect(() => {
      if (sent) doneRef.current?.focus();
   }, [sent]);

   const focusFirst = (errs: ContactFieldErrors) => {
      const first = ORDER.find((key) => errs[key]);
      if (first) formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus();
   };

   const submit = async () => {
      if (sending) return;
      const local = validateContact(values);
      setErrors(local);
      if (Object.keys(local).length) {
         setNotice(null);
         focusFirst(local);
         return;
      }

      setSending(true);
      setNotice(null);
      const result = await sendContact({
         ...values,
         website: honeypot,
         elapsed_ms: shownAt.current ? Date.now() - shownAt.current : 0,
      });
      setSending(false);

      if (result.ok) {
         setValues(EMPTY);
         setErrors({});
         setSent(true);
         return;
      }
      if (result.kind === "invalid") {
         setErrors(result.fields);
         if (Object.keys(result.fields).length) focusFirst(result.fields);
         else setNotice({ tone: "error", text: result.message, retry: false });
         return;
      }
      if (result.kind === "rate_limited") {
         setNotice({
            tone: "info",
            text: `You have sent several messages in a short time. Please try again in ${waitText(result.retryAfter)}, or write to support@play50.games.`,
            retry: false,
         });
         return;
      }
      if (result.kind === "too_fast") {
         shownAt.current = Date.now() - 3000; // the next press counts as a person's
         setNotice({ tone: "info", text: "That was quick. Please check your message and press Send message again.", retry: false });
         return;
      }
      setNotice({ tone: "error", text: result.message, retry: true });
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      void submit();
   };

   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const key = e.target.name as ContactField;
      setValues((prev) => ({ ...prev, [key]: e.target.value }));
      if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
   };

   if (sent) {
      return (
         <div className={`${page.card} ${styles.form}`}>
            <p ref={doneRef} tabIndex={-1} className={`${page.notice} ${page.noticeOk} ${styles.done}`} role="status">
               Thank you. Your message is on its way to us, and we will reply to your email address.
            </p>
            <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${styles.send}`} onClick={() => setSent(false)}>
               Write another message
            </button>
         </div>
      );
   }

   const describe = (key: ContactField, hint?: string) => (errors[key] ? `contact-${key}-error` : hint);

   return (
      <form ref={formRef} onSubmit={handleSubmit} className={`${page.card} ${styles.form}`} noValidate aria-busy={sending}>
         {notice ? (
            <div className={`${page.notice} ${notice.tone === "error" ? page.noticeError : ""} ${styles.notice}`} role="alert">
               <p>{notice.text}</p>
               {notice.retry ? (
                  <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`} onClick={() => void submit()} disabled={sending}>
                     Try again
                  </button>
               ) : null}
            </div>
         ) : null}

         <div className={styles.pair}>
            <div className={form.field}>
               <label htmlFor="contact-name" className={form.label}>
                  Name
               </label>
               <input
                  type="text"
                  id="contact-name"
                  name="name"
                  className={form.input}
                  autoComplete="name"
                  maxLength={CONTACT_LIMITS.name}
                  value={values.name}
                  onChange={handleChange}
                  required
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describe("name")}
               />
               {errors.name ? (
                  <p id="contact-name-error" className={form.error}>
                     {errors.name}
                  </p>
               ) : null}
            </div>

            <div className={form.field}>
               <label htmlFor="contact-email" className={form.label}>
                  Email
               </label>
               <input
                  type="email"
                  id="contact-email"
                  name="email"
                  className={form.input}
                  autoComplete="email"
                  inputMode="email"
                  value={values.email}
                  onChange={handleChange}
                  required
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describe("email")}
               />
               {errors.email ? (
                  <p id="contact-email-error" className={form.error}>
                     {errors.email}
                  </p>
               ) : null}
            </div>
         </div>

         <div className={form.field}>
            <label htmlFor="contact-subject" className={form.label}>
               Subject (optional)
            </label>
            <select
               id="contact-subject"
               name="subject"
               className={form.input}
               value={values.subject}
               onChange={handleChange}
               aria-invalid={errors.subject ? true : undefined}
               aria-describedby={describe("subject")}
            >
               <option value="">Select a subject</option>
               {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                     {s}
                  </option>
               ))}
            </select>
            {errors.subject ? (
               <p id="contact-subject-error" className={form.error}>
                  {errors.subject}
               </p>
            ) : null}
         </div>

         <div className={form.field}>
            <label htmlFor="contact-message" className={form.label}>
               Message
            </label>
            <textarea
               id="contact-message"
               name="message"
               className={form.input}
               maxLength={CONTACT_LIMITS.messageMax}
               value={values.message}
               onChange={handleChange}
               required
               rows={6}
               aria-invalid={errors.message ? true : undefined}
               aria-describedby={describe("message", "contact-message-hint")}
            />
            {errors.message ? (
               <p id="contact-message-error" className={form.error}>
                  {errors.message}
               </p>
            ) : (
               <p id="contact-message-hint" className={form.hint}>
                  Tell us how we can help, in at least {CONTACT_LIMITS.messageMin} characters.
               </p>
            )}
         </div>

         {/* Honeypot: off screen, out of the tab order and hidden from screen readers. People leave it empty. */}
         <div className={styles.trap} aria-hidden="true">
            <label htmlFor="contact-website">Website</label>
            <input
               type="text"
               id="contact-website"
               name="website"
               tabIndex={-1}
               autoComplete="off"
               value={honeypot}
               onChange={(e) => setHoneypot(e.target.value)}
            />
         </div>

         <button type="submit" disabled={sending} className={`${ui.btn} ${ui.btnPrimary} ${styles.send}`}>
            {sending ? "Sending" : "Send message"}
         </button>
      </form>
   );
}
