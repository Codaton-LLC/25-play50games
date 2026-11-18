"use client";

// The sign-in sheet shared by the login and register modals (docs/design/DESIGN.md §6 item 8):
// the frame (scrim, sheet, close, title, the server's error, the alternative link) and one field
// (label above, input, then the error or the helper text below).
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { BrandMark, CloseIcon } from "@/components/Site/icons";
import form from "@/components/Site/form.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./AuthModal.module.css";

export interface AuthSheetProps {
   /** the id of the title, for aria-labelledby */
   id: string;
   title: string;
   lead: string;
   /** the answer of the server when the request failed, "" when there is none */
   error: string;
   /** a wider sheet for the paired fields of the register form */
   wide?: boolean;
   onClose: () => void;
   /** the form */
   children: ReactNode;
   /** the alternative: "New here? Create an account" */
   footer: ReactNode;
}

export function AuthSheet({ id, title, lead, error, wide, onClose, children, footer }: AuthSheetProps) {
   const sheetRef = useRef<HTMLDivElement>(null);
   // a press that starts inside the sheet (selecting text in a field) and ends on the scrim
   // must not close it
   const pressedScrim = useRef(false);
   const onCloseRef = useRef(onClose);
   onCloseRef.current = onClose;

   useEffect(() => {
      sheetRef.current?.focus({ preventScroll: true });
      const onKey = (event: KeyboardEvent) => {
         if (event.key === "Escape") onCloseRef.current();
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
   }, []);

   return (
      <div
         className={styles.overlay}
         onMouseDown={(event) => {
            pressedScrim.current = event.target === event.currentTarget;
         }}
         onClick={(event) => {
            if (pressedScrim.current && event.target === event.currentTarget) onClose();
         }}
      >
         <div
            ref={sheetRef}
            className={wide ? `${styles.sheet} ${styles.wide}` : styles.sheet}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            tabIndex={-1}
         >
            <button type="button" className={`${ui.iconBtn} ${styles.close}`} onClick={onClose} aria-label="Close">
               <CloseIcon />
            </button>

            <BrandMark className={styles.mark} />
            <h2 id={id} className={styles.title}>
               {title}
            </h2>
            <p className={styles.lead}>{lead}</p>

            {error ? (
               <p className={styles.alert} role="alert">
                  {error}
               </p>
            ) : null}

            {children}

            <p className={styles.foot}>{footer}</p>
         </div>
      </div>
   );
}

export interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> {
   id: string;
   label: string;
   /** shown below the field in red, in place of the hint */
   error?: string;
   /** helper text below the field */
   hint?: string;
}

export function AuthField({ id, label, error, hint, ...input }: AuthFieldProps) {
   const note = error || hint;
   return (
      <div className={form.field}>
         <label htmlFor={id} className={form.label}>
            {label}
         </label>
         <input
            {...input}
            id={id}
            className={form.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={note ? `${id}-note` : undefined}
         />
         {note ? (
            <p id={`${id}-note`} className={error ? form.error : form.hint}>
               {note}
            </p>
         ) : null}
      </div>
   );
}

/** The one primary button of a sheet. */
export function AuthSubmit({ busy, children }: { busy: boolean; children: ReactNode }) {
   return (
      <button type="submit" disabled={busy} className={`${ui.btn} ${ui.btnPrimary} ${ui.btnWide} ${styles.submit}`}>
         {children}
      </button>
   );
}

/** The alternative as a text link. */
export function AuthAlt({ onClick, children }: { onClick: () => void; children: ReactNode }) {
   return (
      <button type="button" className={styles.alt} onClick={onClick}>
         {children}
      </button>
   );
}

export { styles as authStyles };
