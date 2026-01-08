"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Certificate } from "@/types/game";
import { getCertificate } from "@/lib/api/certificate";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { QRCodeSVG } from "qrcode.react";
import Header from "@/components/Header/Header";

export default function CertificateViewPage() {
   const params = useParams();
   const router = useRouter();
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
         // Otherwise, construct the PDF URL based on certificate_id
         return `https://cms.play50.games/wp-content/uploads/play50-certificates/certificate-${certificate.certificate_id}.pdf`;
      }
      return "";
   };

   if (loading) {
      return (
         <div className="certificate-page">
            <div className="certificate-loading">
               <span className="loader"></span>
            </div>
         </div>
      );
   }

   if (error || !certificate) {
      return (
         <div className="certificate-page">
            <div className="certificate-error">
               <h2>Certificate Not Found</h2>
               <p>
                  {error ||
                     "The certificate you are looking for does not exist."}
               </p>
               <Link href="/certificate" className="back-button">
                  <ArrowLeftIcon style={{ width: 16, height: 16 }} />
                  Back to Certificate
               </Link>
            </div>
         </div>
      );
   }

   return (
      <div className="certificate-page">
         <Header
            showSubtitle={false}
            onShowLoginModal={() => {}}
            onShowRegisterModal={() => {}}
         />

         <div className="certificate-view">
            <div className="certificate-display">
               <div className="certificate-badge">
                  <svg
                     width="80"
                     height="80"
                     viewBox="0 0 80 80"
                     fill="none"
                     xmlns="http://www.w3.org/2000/svg"
                  >
                     <circle
                        cx="40"
                        cy="40"
                        r="38"
                        stroke="var(--accent)"
                        strokeWidth="4"
                        fill="none"
                     />
                     <path
                        d="M25 40 L35 50 L55 30"
                        stroke="var(--accent)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                     />
                  </svg>
               </div>

               <h1 className="certificate-title">Certificate of Completion</h1>

               <div className="certificate-content">
                  <p className="certificate-text">This is to certify that</p>
                  <div className="player-name-large">
                     {certificate.player_name}
                  </div>
                  <p className="certificate-text">
                     has successfully completed all 5 games
                     <br />
                     demonstrating exceptional skills in logic, memory, speed,
                     and coordination.
                  </p>

                  <div className="certificate-details">
                     <div className="detail-item">
                        <span className="detail-label">Completion Date</span>
                        <span className="detail-value">
                           {new Date(
                              certificate.completion_date
                           ).toLocaleDateString()}
                        </span>
                     </div>
                     <div className="detail-item">
                        <span className="detail-label">Total Score</span>
                        <span className="detail-value">
                           {certificate.total_score}
                        </span>
                     </div>
                     <div className="detail-item">
                        <span className="detail-label">Rank</span>
                        <span className="detail-value">{certificate.rank}</span>
                     </div>
                  </div>

                  <div className="certificate-qr-section">
                     <div className="qr-code-container">
                        <QRCodeSVG
                           value={getCertificateUrl()}
                           size={150}
                           level="H"
                           includeMargin={true}
                           fgColor="var(--text)"
                           bgColor="transparent"
                        />
                     </div>
                     <p className="qr-hint">Scan to verify this certificate</p>
                  </div>

                  <div className="certificate-id">
                     Certificate ID:{" "}
                     <span className="cert-id-value">
                        {certificate.certificate_id}
                     </span>
                  </div>
               </div>
            </div>

            <div className="certificate-footer">
               <div className="certificate-brand">
                  <strong>Play50Games</strong>
                  <span>Learn. Play. Achieve.</span>
               </div>
            </div>
         </div>
      </div>
   );
}
