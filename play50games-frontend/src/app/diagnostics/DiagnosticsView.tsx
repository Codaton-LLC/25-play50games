"use client";

// The checks of the diagnostics page. The requests are the old page's, unchanged: a GET of
// /games, a second GET for the CORS headers and, only when that GET shows none, an OPTIONS
// preflight. Nothing is written.
import { useEffect, useState } from "react";
import { CheckIcon, ClockIcon, CloseIcon } from "@/components/Site/icons";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

interface DiagnosticResult {
   name: string;
   status: "checking" | "success" | "error";
   message: string;
   details?: string;
}

const STATUS_LABEL: Record<DiagnosticResult["status"], string> = {
   checking: "Checking",
   success: "OK",
   error: "Failed",
};

function StatusIcon({ status }: { status: DiagnosticResult["status"] }) {
   if (status === "success") return <CheckIcon />;
   if (status === "error") return <CloseIcon />;
   return <ClockIcon />;
}

export default function DiagnosticsView() {
   const [results, setResults] = useState<DiagnosticResult[]>([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      runDiagnostics();
   }, []);

   const runDiagnostics = async () => {
      setLoading(true);
      const diagnostics: DiagnosticResult[] = [];

      // 1. Check environment variable
      const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
      diagnostics.push({
         name: "Environment variable",
         status: envUrl ? "success" : "error",
         message: envUrl ? `Set to: ${envUrl}` : "Not set (NEXT_PUBLIC_WORDPRESS_API_URL)",
         details: envUrl
            ? undefined
            : "Create .env.local file with NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1",
      });

      // 2. Detect API URL
      let detectedApiUrl = "http://localhost/wp-json/play50/v1";
      if (typeof window !== "undefined") {
         if (envUrl) {
            detectedApiUrl = envUrl;
         } else {
            const currentOrigin = window.location.origin;
            if (currentOrigin.includes("play50.games")) {
               detectedApiUrl = "https://cms.play50.games/wp-json/play50/v1";
            } else if (currentOrigin.includes("play50.game")) {
               detectedApiUrl = "https://cms.play50.game/wp-json/play50/v1";
            }
         }
      }

      diagnostics.push({
         name: "API address in use",
         status: "success",
         message: detectedApiUrl,
      });

      // 3. Test API connectivity
      diagnostics.push({
         name: "API connectivity",
         status: "checking",
         message: "Testing connection…",
      });
      setResults([...diagnostics]);

      try {
         const response = await fetch(`${detectedApiUrl}/games`, {
            method: "GET",
            headers: {
               "Content-Type": "application/json",
            },
         });

         if (response.ok) {
            const data = await response.json();
            diagnostics[2] = {
               name: "API connectivity",
               status: "success",
               message: `Connected. Received ${Array.isArray(data) ? data.length : 0} games.`,
            };
         } else {
            diagnostics[2] = {
               name: "API connectivity",
               status: "error",
               message: `HTTP ${response.status}: ${response.statusText}`,
               details: await response.text().catch(() => "No error details available"),
            };
         }
      } catch (error: any) {
         diagnostics[2] = {
            name: "API connectivity",
            status: "error",
            message: error.message || "Connection failed",
            details: error.toString(),
         };
      }

      // 4. Check CORS: the headers of a GET first
      diagnostics.push({
         name: "CORS headers",
         status: "checking",
         message: "Checking CORS configuration…",
      });
      setResults([...diagnostics]);

      try {
         const testResponse = await fetch(`${detectedApiUrl}/games`, {
            method: "GET",
            headers: {
               "Content-Type": "application/json",
            },
         });

         const corsHeadersFromGet = {
            "access-control-allow-origin": testResponse.headers.get("access-control-allow-origin"),
            "access-control-allow-methods": testResponse.headers.get("access-control-allow-methods"),
            "access-control-allow-headers": testResponse.headers.get("access-control-allow-headers"),
            "access-control-allow-credentials": testResponse.headers.get("access-control-allow-credentials"),
         };

         if (corsHeadersFromGet["access-control-allow-origin"]) {
            diagnostics[3] = {
               name: "CORS headers",
               status: "success",
               message: `CORS configured: ${corsHeadersFromGet["access-control-allow-origin"]}`,
               details: JSON.stringify(corsHeadersFromGet, null, 2),
            };
         } else {
            // an OPTIONS preflight as the fallback
            try {
               const corsResponse = await fetch(`${detectedApiUrl}/games`, {
                  method: "OPTIONS",
                  headers: {
                     Origin: window.location.origin,
                     "Access-Control-Request-Method": "GET",
                  },
               });

               const corsHeaders = {
                  "access-control-allow-origin": corsResponse.headers.get("access-control-allow-origin"),
                  "access-control-allow-methods": corsResponse.headers.get("access-control-allow-methods"),
                  "access-control-allow-headers": corsResponse.headers.get("access-control-allow-headers"),
                  "access-control-allow-credentials": corsResponse.headers.get("access-control-allow-credentials"),
               };

               if (corsHeaders["access-control-allow-origin"]) {
                  diagnostics[3] = {
                     name: "CORS headers",
                     status: "success",
                     message: `CORS configured: ${corsHeaders["access-control-allow-origin"]}`,
                     details: JSON.stringify(corsHeaders, null, 2),
                  };
               } else {
                  // the API works but shows no CORS headers: same origin, or headers not exposed
                  diagnostics[3] = {
                     name: "CORS headers",
                     status: "success",
                     message: "CORS works (API requests succeed). The headers may not be exposed in the response.",
                     details:
                        "Since API connectivity works, CORS is likely configured correctly. Some browsers don't expose CORS headers in responses for security reasons.",
                  };
               }
            } catch {
               // OPTIONS failed but GET works: CORS still works
               diagnostics[3] = {
                  name: "CORS headers",
                  status: "success",
                  message: "CORS works (API requests succeed).",
                  details:
                     "OPTIONS preflight may not be needed since GET requests work. CORS is configured correctly.",
               };
            }
         }
      } catch (error: any) {
         diagnostics[3] = {
            name: "CORS headers",
            status: "error",
            message: "Could not check CORS headers",
            details: error.toString(),
         };
      }

      // 5. Browser info
      if (typeof window !== "undefined") {
         diagnostics.push({
            name: "Browser",
            status: "success",
            message: `Origin: ${window.location.origin}`,
            details: `User Agent: ${navigator.userAgent}`,
         });
      }

      setResults(diagnostics);
      setLoading(false);
   };

   const failed = results.filter((r) => r.status === "error").length;

   return (
      <div className={styles.view}>
         <section className={page.card} aria-labelledby="diag-results">
            <div className={styles.bar}>
               <div>
                  <h2 id="diag-results" className={styles.h2}>
                     Checks
                  </h2>
                  <p className={styles.summary} aria-live="polite">
                     {loading
                        ? "Running…"
                        : failed
                          ? `${failed} of ${results.length} failed`
                          : `All ${results.length} passed`}
                  </p>
               </div>
               <button
                  type="button"
                  onClick={runDiagnostics}
                  disabled={loading}
                  className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm} ${styles.run}`}
               >
                  {loading ? "Running…" : "Run again"}
               </button>
            </div>

            <ol className={styles.list}>
               {results.length === 0
                  ? [0, 1, 2].map((i) => (
                       <li key={i} className={styles.row} aria-hidden="true">
                          <i className={page.bone} style={{ width: 28, height: 28, borderRadius: 999 }} />
                          <i className={page.bone} style={{ height: 18, width: "60%" }} />
                       </li>
                    ))
                  : results.map((result, index) => (
                       <li key={index} className={styles.row}>
                          <span className={`${styles.icon} ${styles[result.status]}`} aria-hidden="true">
                             <StatusIcon status={result.status} />
                          </span>
                          <div className={styles.body}>
                             <div className={styles.titleRow}>
                                <h3 className={styles.name}>{result.name}</h3>
                                <span className={`${styles.badge} ${styles[`badge_${result.status}`]}`}>
                                   {STATUS_LABEL[result.status]}
                                </span>
                             </div>
                             <p className={styles.message}>{result.message}</p>
                             {result.details && (
                                <details className={styles.details}>
                                   <summary>Details</summary>
                                   <pre className={styles.pre}>{result.details}</pre>
                                </details>
                             )}
                          </div>
                       </li>
                    ))}
            </ol>
         </section>

         <section className={page.prose} aria-labelledby="diag-help">
            <h2 id="diag-help">How to fix common issues</h2>
            <h3>Environment variable not set</h3>
            <p>
               Create a <code>.env.local</code> file in the frontend directory with:
            </p>
            <pre className={styles.pre}>NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1</pre>
            <h3>CORS error</h3>
            <p>
               Check the backend <code>wp-config.php</code> file and make sure CORS is configured. The{" "}
               <code>PLAY50_CORS_ORIGIN</code> should include <code>http://localhost:3000</code> for local
               development. See <code>CORS_SETUP.md</code> for details.
            </p>
            <h3>Network error</h3>
            <p>
               Check if you can open{" "}
               <a
                  href="https://cms.play50.games/wp-json/play50/v1/games"
                  target="_blank"
                  rel="noopener noreferrer"
               >
                  https://cms.play50.games/wp-json/play50/v1/games
               </a>{" "}
               directly in your browser.
            </p>
            <h3>SSL or certificate error</h3>
            <p>
               Check the browser console for SSL errors. You may need to accept the certificate or check your
               system&apos;s certificate store.
            </p>
         </section>
      </div>
   );
}
