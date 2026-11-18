"use client";

// The certificate as a sheet: the name in Trophy Gold, the three facts, the QR code that opens
// the certificate file, and its ID. The request and the file address are the old page's.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Certificate } from "@/types/game";
import { getCertificate } from "@/lib/api/certificate";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeftIcon, AwardIcon } from "@/components/Site/icons";
import page from "@/components/Site/SitePage.module.css";
import ui from "@/components/Site/ui.module.css";
import styles from "../page.module.css";

export default function CertificateDoc() {
   const params = useParams();
   const certificateId = params.id as string;
   const [certificate, setCertificate] = useState<Certificate | null>(null);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      if (certificateId) {
         loadCertificate();
      }
   }, [certificateId]);

   const loadCertificate = async () => {
      try {
         setLoading(true);
         setError(null);
         const cert = await getCertificate(certificateId);
         setCertificate(cert);
      } catch (err: any) {
         setError(err.message || "Certificate not found");
      } finally {
         setLoading(false);
      }
   };

   const getCertificateUrl = () => {
      if (certificate) {
         // If pdf_path exists, use it directly
         if (certificate.pdf_path) {
            return certificate.pdf_path;
         }
         // Otherwise, construct the PDF URL based on new filename format
         if (certificate.cert_id_display) {
            // New format: firstname-lastname-cert_id_display.pdf
            const nameParts = certificate.player_name.split(" ");
            const firstname = nameParts[0]?.toLowerCase() || "player";
            const lastname = nameParts[1]?.toLowerCase() || "";
            const nameSlug = lastname ? `${firstname}-${lastname}` : firstname;
            return `https://cms.play50.games/wp-content/uploads/play50-certificates/${nameSlug}-${certificate.cert_id_display}.pdf`;
         }
         // Fallback to old format for backward compatibility
         return `https://cms.play50.games/wp-content/uploads/play50-certificates/certificate-${certificate.certificate_id}.pdf`;
      }
      return "";
   };

   if (loading) {
      return (
         <i
            className={page.bone}
            style={{ width: "100%", maxWidth: 880, height: 560, marginInline: "auto", borderRadius: 28 }}
            role="status"
            aria-label="Loading the certificate"
         />
      );
   }

   if (error || !certificate) {
      return (
         <div className={styles.missing} role="alert">
            <p className={ui.label}>Certificate</p>
            <h1 className={styles.title}>Certificate not found</h1>
            <p className={styles.text}>{error || "The certificate you are looking for does not exist."}</p>
            <div className={styles.actions}>
               <Link href="/certificate" className={`${ui.btn} ${ui.btnQuiet}`}>
                  <ArrowLeftIcon />
                  Back to Certificate
               </Link>
               <Link href="/verify" className={`${ui.btn} ${ui.btnQuiet}`}>
                  Verify a certificate
               </Link>
            </div>
         </div>
      );
   }

   return (
      <>
         <article className={styles.doc}>
            <span className={`${styles.medal} ${styles.medalOn}`} aria-hidden="true">
               <AwardIcon />
            </span>

            <h1 className={styles.docTitle}>Certificate of Completion</h1>

            <p className={styles.docText}>This is to certify that</p>
            <p className={styles.docName}>{certificate.player_name}</p>
            <p className={styles.docText}>
               has successfully completed all 50 games
               <br />
               demonstrating exceptional skills in logic, memory, speed, and coordination.
            </p>

            <dl className={styles.details}>
               <div>
                  <dt>Completion Date</dt>
                  <dd>{new Date(certificate.completion_date).toLocaleDateString()}</dd>
               </div>
               <div>
                  <dt>Total Score</dt>
                  <dd>{certificate.total_score}</dd>
               </div>
               <div>
                  <dt>Rank</dt>
                  <dd>{certificate.rank}</dd>
               </div>
            </dl>

            <div className={styles.qr}>
               <QRCodeSVG
                  value={getCertificateUrl()}
                  size={150}
                  level="H"
                  includeMargin={true}
                  fgColor="currentColor"
                  bgColor="transparent"
               />
               <p className={styles.qrHint}>Scan to verify this certificate</p>
            </div>

            <p className={styles.docId}>
               Certificate ID: <span>{certificate.cert_id_display || certificate.certificate_id}</span>
            </p>

            <div className={styles.brand}>
               <strong>Play50Games</strong>
               <span>Learn. Play. Achieve.</span>
            </div>
         </article>

         <div className={styles.docActions}>
            <a
               href={getCertificateUrl()}
               target="_blank"
               rel="noopener noreferrer"
               className={`${ui.btn} ${ui.btnQuiet}`}
            >
               Open the certificate file
            </a>
            <Link
               href={`/verify?cert_id=${encodeURIComponent(certificate.cert_id_display || certificate.certificate_id)}`}
               className={`${ui.btn} ${ui.btnQuiet}`}
            >
               Verify this certificate
            </Link>
         </div>
      </>
   );
}
