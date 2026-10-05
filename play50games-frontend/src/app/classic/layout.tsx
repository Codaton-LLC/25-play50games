import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

const TITLE = "Play Classic 50 Games";
const DESCRIPTION =
   "Play 50 classic browser brain games across logic, memory, speed and skill. Unlock them one by one, then finish all 50 to earn your certificate.";

export const metadata: Metadata = {
   title: TITLE,
   description: DESCRIPTION,
   alternates: {
      canonical: "/classic",
   },
   openGraph: {
      type: "website",
      locale: "en_US",
      url: `${SITE_URL}/classic`,
      siteName: "Play50Games",
      title: `${TITLE} | Play50Games`,
      description: DESCRIPTION,
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "Play Classic 50 Games - Play50Games",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: `${TITLE} | Play50Games`,
      description: DESCRIPTION,
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
};

export default function ClassicLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
