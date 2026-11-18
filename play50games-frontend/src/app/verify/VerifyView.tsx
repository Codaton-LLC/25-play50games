"use client";

// The form and the result of the verify page. The request and the PDF address are the old
// page's, unchanged.
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Certificate } from "@/types/game";
import { getApiHeaders } from "@/lib/api/apiUtils";
import { getApiBase } from "@/lib/api/apiBase";
import { CheckIcon } from "@/components/Site/icons";
import form from "@/components/Site/form.module.css";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

export default function VerifyView() {
   const searchParams = useSearchParams();
   const [certId, setCertId] = useState("");
   const [certificate, setCertificate] = useState<Certificate | null>(null);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);

   // Get cert_id from URL query parameter
   useEffect(() => {
      const certIdParam = searchParams.get("cert_id");
      if (certIdParam) {
         setCertId(certIdParam);
         handleVerify(certIdParam);
      }
   }, [searchParams]);

   const handleVerify = async (certIdToVerify?: string) => {
      const idToVerify = certIdToVerify || certId.trim();

      if (!idToVerify) {
         setError("Please enter a Certificate ID");
         return;
      }

      setLoading(true);
      setError(null);
      setCertificate(null);

      try {
         const apiBase = getApiBase();
         const response = await fetch(`${apiBase}/certificate/verify/${encodeURIComponent(idToVerify)}`, {
            headers: getApiHeaders(),
         });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Certificate not found");
         }

         const certData = await response.json();
         setCertificate(certData);
      } catch (err: any) {
         setError(err.message || "Failed to verify certificate");
         setCertificate(null);
      } finally {
         setLoading(false);
      }
   };

   const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleVerify();
   };

   const getPdfUrl = () => {
      if (!certificate) return "";

      if (certificate.pdf_path) {
         return certificate.pdf_path;
      }

      // Construct PDF URL based on certificate_id
      const uploadBase = "https://cms.play50.games/wp-content/uploads/play50-certificates";
      const playerName = certificate.player_name || "player";
      const nameParts = playerName.split(" ");
      const firstname = nameParts[0]?.toLowerCase() || "player";
      const lastname = nameParts[1]?.toLowerCase() || "";
      const nameSlug = lastname ? `${firstname}-${lastname}` : firstname;
      const certIdDisplay = certificate.cert_id_display || certificate.certificate_id;

      return `${uploadBase}/${nameSlug}-${certIdDisplay}.pdf`;
   };

   return (
      <div className={styles.view}>
         <form onSubmit={handleSubmit} className={`${page.card} ${styles.form}`}>
            <div className={form.field}>
               <label htmlFor="certId" className={form.label}>
                  Certificate ID
               </label>
               <input
                  type="text"
                  id="certId"
                  className={`${form.input} ${styles.id}`}
                  value={certId}
                  onChange={(e) => setCertId(e.target.value.toUpperCase())}
                  placeholder="P50-2026-56966"
                  disabled={loading}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="certId-note"
               />
               <p id="certId-note" className={error ? form.error : form.hint} role={error ? "alert" : undefined}>
                  {error || "It is printed at the bottom of the certificate."}
               </p>
            </div>
            <button
               type="submit"
               disabled={loading || !certId.trim()}
               className={`${ui.btn} ${ui.btnPrimary} ${styles.submit}`}
            >
               {loading ? "Verifying…" : "Verify certificate"}
            </button>
         </form>

         {certificate ? (
            <section className={styles.result} aria-labelledby="verify-result">
               <h2 id="verify-result" className={styles.verified}>
                  <span className={styles.tick} aria-hidden="true">
                     <CheckIcon />
                  </span>
                  Certificate verified
               </h2>
               <dl className={page.facts}>
                  <div>
                     <dt>Player Name</dt>
                     <dd>{certificate.player_name}</dd>
                  </div>
                  <div>
                     <dt>Certificate ID</dt>
                     <dd className={page.mono}>{certificate.cert_id_display || certificate.certificate_id}</dd>
                  </div>
                  <div>
                     <dt>Completion Date</dt>
                     <dd>{new Date(certificate.completion_date).toLocaleDateString()}</dd>
                  </div>
                  <div>
                     <dt>Rank</dt>
                     <dd>{certificate.rank}</dd>
                  </div>
               </dl>

               <div className={styles.pdf}>
                  <iframe src={getPdfUrl()} width="100%" height="100%" title="Certificate PDF" />
               </div>
            </section>
         ) : null}
      </div>
   );
}
