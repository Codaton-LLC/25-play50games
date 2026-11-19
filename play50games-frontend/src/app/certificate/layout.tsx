import type { Metadata } from "next";
import { OG_IMAGES } from "@/lib/seo/ogImages";
import { pageSocial } from "@/lib/seo/pageMetadata";

const TITLE = "Certificate";
const DESCRIPTION =
   "Earn your certificate by completing all 50 games. Show off your achievement and skills!";

export const metadata: Metadata = {
   title: TITLE,
   description: DESCRIPTION,
   ...pageSocial({ title: TITLE, description: DESCRIPTION, path: "/certificate", image: OG_IMAGES.classic }),
};

export default function CertificateLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
