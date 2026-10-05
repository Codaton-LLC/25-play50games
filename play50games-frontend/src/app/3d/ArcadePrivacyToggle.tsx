"use client";

// "Show my name on leaderboards" switch on /3d (rendered only with the leaderboard flag on).
// Logged-in players with a JWT only: GET/POST /arcade/me/privacy need one (docs/arcade-api.md §6.5).
// Off = leaderboards show the player as "Anonymous"; the score stays ranked (§10).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { User } from "@/lib/api/auth";
import { getJwtToken, removeJwtToken } from "@/lib/api/apiUtils";
import { arcadeApi, ArcadeApiError } from "@/lib/api/arcade";
import styles from "./ArcadePrivacyToggle.module.css";

// "expired": the server rejected the token (401); it is dropped and only a new login helps, so no Retry
type Phase = "idle" | "loading" | "ready" | "saving" | "load-error" | "expired";

/** Same shape as the server's public name ("Ana K."), only for the hint text. */
function previewName(user: User): string {
   // the server trims again after the 20-character cut (play50_arcade_public_name)
   const first = Array.from((user.first_name || "").trim()).slice(0, 20).join("").trim();
   if (!first) return "Player";
   const initial = Array.from((user.last_name || "").trim())[0];
   return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

const EXPIRED_MESSAGE = "Your session has expired. Log in again to change this setting.";

function errorMessage(error: unknown, action: "load" | "save"): string {
   if (error instanceof ArcadeApiError) {
      switch (error.code) {
         case "rate_limited":
            return "Too many changes. Wait a minute and try again.";
         case "network":
            return "You seem to be offline. Check your connection and try again.";
         default:
            break;
      }
   }
   return action === "load" ? "Could not load your leaderboard setting." : "Could not save your setting. Try again.";
}

function isUnauthorized(error: unknown): boolean {
   return error instanceof ArcadeApiError && error.code === "unauthorized";
}

export default function ArcadePrivacyToggle() {
   const { user, refreshAuth } = useAuth();
   const labelId = useId();
   const hintId = useId();

   const [phase, setPhase] = useState<Phase>("idle");
   const [hideName, setHideName] = useState<boolean | null>(null);
   const [message, setMessage] = useState("");
   const [isError, setIsError] = useState(false);
   const [loadFailed, setLoadFailed] = useState(false);
   const switchRef = useRef<HTMLButtonElement>(null);
   const retryRef = useRef<HTMLButtonElement>(null);
   // after a successful Retry the Retry button goes away: move focus to the switch that replaces it
   const focusSwitchRef = useRef(false);
   // bumps on every request, user change and unmount, so late responses are ignored
   const requestRef = useRef(0);
   const refreshAuthRef = useRef(refreshAuth);
   refreshAuthRef.current = refreshAuth;

   // Dead, expired or forged token (401 unauthorized): drop it like core/scores.ts does, so
   // Retry cannot loop on it, and let AuthContext re-check the session so the header offers a
   // fresh login. The new user object then hides this panel (no JWT) until the next login.
   const expire = useCallback((sentToken: string | null) => {
      if (sentToken && getJwtToken() === sentToken) {
         removeJwtToken();
      }
      setPhase("expired");
      setIsError(true);
      setMessage(EXPIRED_MESSAGE);
      void refreshAuthRef.current();
   }, []);

   const load = useCallback(() => {
      const id = ++requestRef.current;
      const sentToken = getJwtToken();
      setPhase("loading");
      setIsError(false);
      setMessage("Loading your leaderboard setting…");
      arcadeApi.getPrivacy().then(
         (res) => {
            if (id !== requestRef.current) return;
            focusSwitchRef.current = document.activeElement === retryRef.current;
            setHideName(res.hide_name);
            setLoadFailed(false);
            setPhase("ready");
            setMessage("");
         },
         (error: unknown) => {
            if (id !== requestRef.current) return;
            setLoadFailed(true);
            if (isUnauthorized(error)) {
               expire(sentToken);
               return;
            }
            setPhase("load-error");
            setIsError(true);
            setMessage(errorMessage(error, "load"));
         }
      );
   }, [expire]);

   // keyed on the user object, not only its id: a new login with the same account
   // (after an expired token) stores a new JWT and must load again
   useEffect(() => {
      setHideName(null);
      setLoadFailed(false);
      setIsError(false);
      setMessage("");
      // cookie-only sessions have no JWT; the endpoint would answer 401
      if (user && getJwtToken()) {
         load();
      } else {
         requestRef.current++;
         setPhase("idle");
      }
      return () => {
         requestRef.current++;
      };
   }, [user, load]);

   useEffect(() => {
      if (hideName !== null && focusSwitchRef.current) {
         focusSwitchRef.current = false;
         switchRef.current?.focus();
      }
   }, [hideName]);

   if (!user || phase === "idle") return null;

   const busy = phase !== "ready";

   const toggle = () => {
      if (busy || hideName === null) return;
      const next = !hideName;
      const id = ++requestRef.current;
      const sentToken = getJwtToken();
      setPhase("saving");
      setIsError(false);
      setMessage("Saving…");
      arcadeApi.setPrivacy(next).then(
         (res) => {
            if (id !== requestRef.current) return;
            setHideName(res.hide_name);
            setPhase("ready");
            setMessage(
               res.hide_name
                  ? "Saved. Leaderboards now show you as “Anonymous”."
                  : "Saved. Leaderboards now show your name."
            );
         },
         (error: unknown) => {
            if (id !== requestRef.current) return;
            if (isUnauthorized(error)) {
               expire(sentToken);
               return;
            }
            setPhase("ready");
            setIsError(true);
            setMessage(errorMessage(error, "save"));
         }
      );
   };

   return (
      <section className={styles.panel} aria-labelledby={labelId}>
         <div className={styles.row}>
            <div className={styles.text}>
               <span id={labelId} className={styles.label}>
                  Show my name on leaderboards
               </span>
               <span id={hintId} className={styles.hint}>
                  On: you appear as &ldquo;{previewName(user)}&rdquo;. Off: you appear as &ldquo;Anonymous&rdquo;. Your
                  scores count either way.
               </span>
            </div>
            {hideName !== null ? (
               <button
                  ref={switchRef}
                  type="button"
                  role="switch"
                  className={styles.switch}
                  aria-checked={!hideName}
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                  aria-disabled={busy}
                  aria-busy={phase === "saving"}
                  onClick={toggle}
               >
                  <span className={styles.thumb} aria-hidden="true" />
               </button>
            ) : null}
         </div>
         <p className={isError ? `${styles.status} ${styles.error}` : styles.status} role="status" aria-live="polite">
            {message}
         </p>
         {loadFailed && hideName === null && phase !== "expired" ? (
            // stays mounted (aria-disabled) while retrying, so keyboard focus is not lost
            <button
               ref={retryRef}
               type="button"
               className={styles.retry}
               aria-disabled={phase === "loading"}
               onClick={() => {
                  if (phase !== "loading") load();
               }}
            >
               Retry
            </button>
         ) : null}
      </section>
   );
}
