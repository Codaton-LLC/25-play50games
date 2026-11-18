"use client";

// The login sheet (docs/design/DESIGN.md §6 item 8). The frame and the fields are AuthSheet.tsx.
import { useState } from "react";
import { AuthAlt, AuthField, AuthSheet, AuthSubmit, authStyles as styles } from "./AuthSheet";

interface LoginModalProps {
   isOpen: boolean;
   onClose: () => void;
   onLogin: (email: string, password: string) => Promise<void>;
   onSwitchToRegister: () => void;
}

export default function LoginModal({
   isOpen,
   onClose,
   onLogin,
   onSwitchToRegister,
}: LoginModalProps) {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);
   const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

   const validateEmailOrUsername = (value: string) => {
      if (!value.trim()) {
         return "Email or username is required";
      }
      return "";
   };

   const validatePassword = (value: string) => {
      if (!value) {
         return "Password is required";
      }
      return "";
   };

   const handleEmailChange = (value: string) => {
      setEmail(value);
      setFieldErrors((prev) => ({
         ...prev,
         email: validateEmailOrUsername(value),
      }));
   };

   const handlePasswordChange = (value: string) => {
      setPassword(value);
      setFieldErrors((prev) => ({
         ...prev,
         password: validatePassword(value),
      }));
   };

   if (!isOpen) return null;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      // Validate fields
      const errors: Record<string, string> = {
         email: validateEmailOrUsername(email),
         password: validatePassword(password),
      };

      setFieldErrors(errors);

      // Check if there are any errors
      if (Object.values(errors).some((err) => err !== "")) {
         return;
      }

      setLoading(true);

      try {
         await onLogin(email, password);
         setEmail("");
         setPassword("");
         setFieldErrors({});
         onClose();
      } catch (err: any) {
         setError(err.message || "Login failed. Please try again.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <AuthSheet
         id="login-title"
         title="Log in"
         lead="Your scores and your Classic 50 progress are saved to your account."
         error={error}
         onClose={onClose}
         footer={
            <>
               New here?
               <AuthAlt onClick={onSwitchToRegister}>Create an account</AuthAlt>
            </>
         }
      >
         {/* noValidate: the errors show under their fields, not in the browser's own bubbles */}
         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <AuthField
               id="login-email"
               label="Email or username"
               type="text"
               autoComplete="username"
               autoCapitalize="none"
               spellCheck={false}
               value={email}
               onChange={(e) => handleEmailChange(e.target.value)}
               onBlur={() =>
                  setFieldErrors((prev) => ({
                     ...prev,
                     email: validateEmailOrUsername(email),
                  }))
               }
               required
               error={fieldErrors.email}
            />

            <AuthField
               id="login-password"
               label="Password"
               type="password"
               autoComplete="current-password"
               value={password}
               onChange={(e) => handlePasswordChange(e.target.value)}
               onBlur={() =>
                  setFieldErrors((prev) => ({
                     ...prev,
                     password: validatePassword(password),
                  }))
               }
               required
               error={fieldErrors.password}
            />

            <AuthSubmit busy={loading}>{loading ? "Logging in…" : "Log in"}</AuthSubmit>
         </form>
      </AuthSheet>
   );
}
