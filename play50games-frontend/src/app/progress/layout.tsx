import { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

export const metadata: Metadata = {
   title: "My Progress",
   description:
      "Track your progress across all 50 games. See which games you've completed and unlock new challenges.",
   openGraph: {
      title: "My Progress | Play50Games",
      description:
         "Track your progress across all 50 games. See which games you've completed and unlock new challenges.",
      url: `${SITE_URL}/progress`,
      type: "website",
      siteName: "Play50Games",
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "My Progress - Play50Games",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: "My Progress | Play50Games",
      description:
         "Track your progress across all 50 games. See which games you've completed and unlock new challenges.",
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
};

export default function ProgressLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return <>{children}</>;
}
