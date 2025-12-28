"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

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

   if (!isOpen) return null;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);

      try {
         await onLogin(email, password);
         setEmail("");
         setPassword("");
         onClose();
      } catch (err: any) {
         setError(err.message || "Login failed. Please try again.");
      } finally {
         setLoading(false);
      }
   };

   return (
      <div className="modal-overlay" onClick={onClose}>
         <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={onClose}>
               <XMarkIcon style={{ width: 24, height: 24 }} />
            </button>

            <h2>Login</h2>

            {error && (
               <div
                  className="error-message"
                  style={{
                     padding: "0.75rem",
                     backgroundColor: "rgba(252, 165, 165, 0.15)",
                     border: "1px solid rgba(252, 165, 165, 0.4)",
                     borderRadius: "12px",
                     color: "var(--warn)",
                     marginBottom: "1rem",
                     fontSize: "14px",
                  }}
               >
                  {error}
               </div>
            )}

            <form onSubmit={handleSubmit}>
               <div className="form-group">
                  <label htmlFor="login-email">Email or Username</label>
                  <input
                     id="login-email"
                     type="text"
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     required
                     placeholder="your@email.com or username"
                  />
               </div>

               <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <input
                     id="login-password"
                     type="password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     required
                     placeholder="••••••••"
                  />
               </div>

               <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Logging in..." : "Login"}
               </button>
            </form>

            <div style={{ marginTop: "1rem", textAlign: "center" }}>
               <p
                  style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}
               >
                  Don't have an account?{" "}
                  <button
                     type="button"
                     onClick={onSwitchToRegister}
                     style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontSize: "14px",
                        fontWeight: "600",
                     }}
                  >
                     Register here
                  </button>
               </p>
            </div>
         </div>
      </div>
   );
}
