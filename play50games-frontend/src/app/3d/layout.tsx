import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

const TITLE = "3D Arcade";
const SOCIAL_TITLE = "3D Arcade | Play50Games";
const DESCRIPTION =
   "Quick 3D mini-games you can play in your browser with keyboard or touch. No unlocks: pick any game, chase your best score and climb its leaderboard.";

export const metadata: Metadata = {
   title: {
      default: TITLE,
      template: "%s | 3D Arcade | Play50Games",
   },
   description: DESCRIPTION,
   alternates: {
      canonical: "/3d",
   },
   openGraph: {
      type: "website",
      locale: "en_US",
      url: `${SITE_URL}/3d`,
      siteName: "Play50Games",
      title: SOCIAL_TITLE,
      description: DESCRIPTION,
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "3D Arcade - Play50Games",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: SOCIAL_TITLE,
      description: DESCRIPTION,
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
};

export default function ArcadeLayout({ children }: { children: React.ReactNode }) {
   return <>{children}</>;
}
