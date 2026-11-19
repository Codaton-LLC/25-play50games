"use client";

// The register sheet (docs/design/DESIGN.md §6 item 8). The frame and the fields are AuthSheet.tsx.
import { useState } from "react";
import { focusFirstInvalid } from "@/lib/a11y/modalStack";
import { AuthAlt, AuthField, AuthSheet, AuthSubmit, authStyles as styles } from "./AuthSheet";

interface RegisterModalProps {
   isOpen: boolean;
   onClose: () => void;
   onRegister: (firstName: string, lastName: string, username: string, email: string, password: string) => Promise<void>;
   onSwitchToLogin: () => void;
}

export default function RegisterModal({ isOpen, onClose, onRegister, onSwitchToLogin }: RegisterModalProps) {
   const [firstName, setFirstName] = useState("");
   const [lastName, setLastName] = useState("");
   const [username, setUsername] = useState("");
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [confirmPassword, setConfirmPassword] = useState("");
   const [error, setError] = useState("");
   const [loading, setLoading] = useState(false);

   // Field-specific errors
   const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

   // Validation functions
   const validateFirstName = (value: string) => {
      if (!value.trim()) {
         return "First name is required";
      }
      return "";
   };

   const validateLastName = (value: string) => {
      if (!value.trim()) {
         return "Last name is required";
      }
      return "";
   };

   const validateUsername = (value: string) => {
      if (!value.trim()) {
         return "Username is required";
      }
      if (value.length < 3) {
         return "Username must be at least 3 characters";
      }
      return "";
   };

   const validateEmail = (value: string) => {
      if (!value.trim()) {
         return "Email is required";
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
         return "Please enter a valid email address";
      }
      return "";
   };

   const validatePassword = (value: string) => {
      if (!value) {
         return "Password is required";
      }
      if (value.length < 6) {
         return "Password must be at least 6 characters";
      }
      return "";
   };

   const validateConfirmPassword = (value: string, passwordValue: string) => {
      if (!value) {
         return "Please confirm your password";
      }
      if (value !== passwordValue) {
         return "Passwords do not match";
      }
      return "";
   };

   // Handle field changes with validation
   const handleFirstNameChange = (value: string) => {
      setFirstName(value);
      setFieldErrors((prev) => ({ ...prev, firstName: validateFirstName(value) }));
   };

   const handleLastNameChange = (value: string) => {
      setLastName(value);
      setFieldErrors((prev) => ({ ...prev, lastName: validateLastName(value) }));
   };

   const handleUsernameChange = (value: string) => {
      setUsername(value);
      setFieldErrors((prev) => ({ ...prev, username: validateUsername(value) }));
   };

   const handleEmailChange = (value: string) => {
      setEmail(value);
      setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }));
   };

   const handlePasswordChange = (value: string) => {
      setPassword(value);
      setFieldErrors((prev) => ({
         ...prev,
         password: validatePassword(value),
         confirmPassword: confirmPassword ? validateConfirmPassword(confirmPassword, value) : "",
      }));
   };

   const handleConfirmPasswordChange = (value: string) => {
      setConfirmPassword(value);
      setFieldErrors((prev) => ({ ...prev, confirmPassword: validateConfirmPassword(value, password) }));
   };

   if (!isOpen) return null;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");

      // Validate all fields
      const errors: Record<string, string> = {
         firstName: validateFirstName(firstName),
         lastName: validateLastName(lastName),
         username: validateUsername(username),
         email: validateEmail(email),
         password: validatePassword(password),
         confirmPassword: validateConfirmPassword(confirmPassword, password),
      };

      setFieldErrors(errors);

      // Check if there are any errors
      if (Object.values(errors).some((err) => err !== "")) {
         // the first invalid field takes the focus; its label and error are read out with it
         focusFirstInvalid(e.currentTarget as HTMLFormElement);
         return;
      }

      setLoading(true);

      try {
         await onRegister(firstName, lastName, username, email, password);
         setFirstName("");
         setLastName("");
         setUsername("");
         setEmail("");
         setPassword("");
         setConfirmPassword("");
         onClose();
      } catch (err: any) {
         setError(err.message || "Registration failed. Please try again.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <AuthSheet
         id="register-title"
         title="Create your account"
         lead="Free. It keeps your scores and your Classic 50 progress."
         error={error}
         wide
         onClose={onClose}
         footer={
            <>
               Already have an account?
               <AuthAlt onClick={onSwitchToLogin}>Log in</AuthAlt>
            </>
         }
      >
         {/* noValidate: the errors show under their fields, not in the browser's own bubbles */}
         <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.pair}>
               <AuthField
                  id="register-firstname"
                  label="First name"
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => handleFirstNameChange(e.target.value)}
                  onBlur={() => setFieldErrors((prev) => ({ ...prev, firstName: validateFirstName(firstName) }))}
                  required
                  error={fieldErrors.firstName}
               />
               <AuthField
                  id="register-lastname"
                  label="Last name"
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => handleLastNameChange(e.target.value)}
                  onBlur={() => setFieldErrors((prev) => ({ ...prev, lastName: validateLastName(lastName) }))}
                  required
                  error={fieldErrors.lastName}
               />
            </div>

            <AuthField
               id="register-username"
               label="Username"
               type="text"
               autoComplete="username"
               autoCapitalize="none"
               spellCheck={false}
               value={username}
               onChange={(e) => handleUsernameChange(e.target.value)}
               onBlur={() => setFieldErrors((prev) => ({ ...prev, username: validateUsername(username) }))}
               required
               minLength={3}
               error={fieldErrors.username}
               hint="At least 3 characters"
            />

            <AuthField
               id="register-email"
               label="Email"
               type="email"
               autoComplete="email"
               value={email}
               onChange={(e) => handleEmailChange(e.target.value)}
               onBlur={() => setFieldErrors((prev) => ({ ...prev, email: validateEmail(email) }))}
               required
               error={fieldErrors.email}
            />

            <div className={styles.pair}>
               <AuthField
                  id="register-password"
                  label="Password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  onBlur={() => setFieldErrors((prev) => ({ ...prev, password: validatePassword(password) }))}
                  required
                  minLength={6}
                  error={fieldErrors.password}
                  hint="At least 6 characters"
               />
               <AuthField
                  id="register-confirm-password"
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  onBlur={() =>
                     setFieldErrors((prev) => ({
                        ...prev,
                        confirmPassword: validateConfirmPassword(confirmPassword, password),
                     }))
                  }
                  required
                  error={fieldErrors.confirmPassword}
               />
            </div>

            <p className={styles.note}>
               Your first name and last initial may appear on 3D Arcade leaderboards. You can hide it anytime.
            </p>

            <AuthSubmit busy={loading}>{loading ? "Creating account…" : "Create account"}</AuthSubmit>
         </form>
      </AuthSheet>
   );
}
