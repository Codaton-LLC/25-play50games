"use client";

// The message form of the contact page: a label above every field and one primary button.
// The submit handler is the old page's, unchanged.
import { useState } from "react";
import form from "@/components/Site/form.module.css";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

export default function ContactForm() {
   const [formData, setFormData] = useState({
      name: "",
      email: "",
      subject: "",
      message: "",
   });
   const [submitting, setSubmitting] = useState(false);
   const [submitted, setSubmitted] = useState(false);

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);

      // Simulate form submission (you can replace this with actual API call)
      setTimeout(() => {
         setSubmitting(false);
         setSubmitted(true);
         setFormData({ name: "", email: "", subject: "", message: "" });

         // Reset success message after 5 seconds
         setTimeout(() => {
            setSubmitted(false);
         }, 5000);
      }, 1000);
   };

   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormData((prev) => ({
         ...prev,
         [e.target.name]: e.target.value,
      }));
   };

   return (
      <form onSubmit={handleSubmit} className={`${page.card} ${styles.form}`}>
         {submitted ? (
            <p className={`${page.notice} ${page.noticeOk}`} role="status">
               Thank you for contacting us! We&apos;ll get back to you soon.
            </p>
         ) : null}

         <div className={styles.pair}>
            <div className={form.field}>
               <label htmlFor="name" className={form.label}>
                  Name
               </label>
               <input
                  type="text"
                  id="name"
                  name="name"
                  className={form.input}
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
               />
            </div>

            <div className={form.field}>
               <label htmlFor="email" className={form.label}>
                  Email
               </label>
               <input
                  type="email"
                  id="email"
                  name="email"
                  className={form.input}
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
               />
            </div>
         </div>

         <div className={form.field}>
            <label htmlFor="subject" className={form.label}>
               Subject
            </label>
            <select
               id="subject"
               name="subject"
               className={form.input}
               value={formData.subject}
               onChange={handleChange}
               required
            >
               <option value="">Select a subject</option>
               <option value="general">General Inquiry</option>
               <option value="technical">Technical Support</option>
               <option value="bug">Report a Bug</option>
               <option value="certificate">Certificate Issue</option>
               <option value="account">Account Issue</option>
               <option value="other">Other</option>
            </select>
         </div>

         <div className={form.field}>
            <label htmlFor="message" className={form.label}>
               Message
            </label>
            <textarea
               id="message"
               name="message"
               className={form.input}
               value={formData.message}
               onChange={handleChange}
               required
               rows={6}
               aria-describedby="message-hint"
            />
            <p id="message-hint" className={form.hint}>
               Tell us how we can help. All four fields are needed.
            </p>
         </div>

         <button type="submit" disabled={submitting} className={`${ui.btn} ${ui.btnPrimary} ${styles.send}`}>
            {submitting ? "Sending…" : "Send message"}
         </button>
      </form>
   );
}
