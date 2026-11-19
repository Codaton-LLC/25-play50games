// One certificate "/certificate/[id]": the public view anyone with the link can open.
// Server component for the frame; the certificate loads on the client (CertificateDoc).
import type { Metadata } from "next";
import SitePage from "@/components/Site/SitePage";
import { OG_IMAGES } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";
import CertificateDoc from "./CertificateDoc";

const TITLE = "Play50Games certificate";
const DESCRIPTION =
   "A Play50Games certificate, awarded for finishing all 50 classic brain games. Open the link to view it and check that it is real.";

// The share preview names no one: the holder's name is on the page only. The page shows a
// person's name behind an opaque ID, so it is kept out of search engines.
export function generateMetadata({ params }: { params: { id: string } }): Metadata {
   return {
      title: { absolute: TITLE },
      description: DESCRIPTION,
      robots: { index: false, follow: false },
      ...pageSocial({
         title: "Certificate",
         description: DESCRIPTION,
         path: `/certificate/${encodeURIComponent(params.id)}`,
         image: OG_IMAGES.classic,
      }),
   };
}

export default function CertificateViewPage() {
   return (
      <SitePage active="classic">
         <CertificateDoc />
      </SitePage>
   );
}
