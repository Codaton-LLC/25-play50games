import { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

export const metadata: Metadata = {
   title: "Certificate",
   description: "Earn your certificate by completing all 50 games. Show off your achievement and skills!",
   openGraph: {
      title: "Certificate | Play50Games",
      description: "Earn your certificate by completing all 50 games. Show off your achievement and skills!",
      url: `${SITE_URL}/certificate`,
      type: "website",
      siteName: "Play50Games",
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "Certificate - Play50Games",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: "Certificate | Play50Games",
      description: "Earn your certificate by completing all 50 games. Show off your achievement and skills!",
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
};

export default function CertificateLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
