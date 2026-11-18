// Verify a certificate "/verify" (also opened by the QR code on a certificate, with ?cert_id=).
// Server component for the frame; the form and the result are VerifyView (client).
import { Suspense } from "react";
import type { Metadata } from "next";
import SitePage, { PageHead } from "@/components/Site/SitePage";
import page from "@/components/Site/SitePage.module.css";
import VerifyView from "./VerifyView";

export const metadata: Metadata = {
   title: "Verify a certificate",
   description: "Enter a Play50Games certificate ID to check that the certificate is real and to view it.",
   alternates: { canonical: "/verify" },
};

export default function VerifyPage() {
   return (
      <SitePage active="classic">
         <div className={`${page.split} ${page.splitEven}`}>
            <PageHead
               label="Certificate"
               title="Verify a certificate"
               lead="Enter the Certificate ID to verify and view the certificate."
            />
            {/* useSearchParams (the ?cert_id= of a QR code) needs a Suspense boundary */}
            <Suspense fallback={<i className={page.bone} style={{ height: 220, borderRadius: 28 }} />}>
               <VerifyView />
            </Suspense>
         </div>
      </SitePage>
   );
}
