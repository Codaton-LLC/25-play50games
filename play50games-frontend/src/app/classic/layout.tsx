import type { Metadata } from "next";
import { OG_IMAGES, ogImage } from "@/lib/seo/ogImages";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

const TITLE = "Play Classic 50 Games";
const DESCRIPTION =
   "Play 50 classic browser brain games across logic, memory, speed and skill. Unlock them one by one, then finish all 50 to earn your certificate.";
const IMAGE = ogImage(SITE_URL, OG_IMAGES.classic, "Play Classic 50 Games - Play50Games");

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
      images: [IMAGE],
   },
   twitter: {
      card: "summary_large_image",
      title: `${TITLE} | Play50Games`,
      description: DESCRIPTION,
      images: [IMAGE.url],
   },
};

export default function ClassicLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
