import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

export const metadata: Metadata = {
   metadataBase: new URL(SITE_URL),
   title: {
      default: "Play50Games - Learn. Play. Achieve.",
      template: "%s | Play50Games",
   },
   description:
      "Complete 50 browser games and earn your certificate! Challenge yourself with logic, memory, speed, and skill games.",
   keywords: [
      "browser games",
      "online games",
      "logic games",
      "memory games",
      "speed games",
      "skill games",
      "brain training",
      "cognitive games",
      "certificate",
      "achievement",
   ],
   authors: [{ name: "Play50Games" }],
   creator: "Play50Games",
   publisher: "Play50Games",
   formatDetection: {
      email: false,
      address: false,
      telephone: false,
   },
   icons: {
      icon: "/images/logo/favicon.png",
      shortcut: "/images/logo/favicon.png",
      apple: "/images/logo/favicon.png",
   },
   openGraph: {
      type: "website",
      locale: "en_US",
      url: SITE_URL,
      siteName: "Play50Games",
      title: "Play50Games - Learn. Play. Achieve.",
      description:
         "Complete 50 browser games and earn your certificate! Challenge yourself with logic, memory, speed, and skill games.",
      images: [
         {
            url: `${SITE_URL}/images/play50games-cover.jpg`,
            width: 1200,
            height: 630,
            alt: "Play50Games",
         },
      ],
   },
   twitter: {
      card: "summary_large_image",
      title: "Play50Games - Learn. Play. Achieve.",
      description:
         "Complete 50 browser games and earn your certificate! Challenge yourself with logic, memory, speed, and skill games.",
      images: [`${SITE_URL}/images/play50games-cover.jpg`],
   },
   robots: {
      index: true,
      follow: true,
      googleBot: {
         index: true,
         follow: true,
         "max-video-preview": -1,
         "max-image-preview": "large",
         "max-snippet": -1,
      },
   },
   verification: {
      // Add your verification codes here when available
      // google: "your-google-verification-code",
      // yandex: "your-yandex-verification-code",
      // bing: "your-bing-verification-code",
   },
};

export default function RootLayout({
   children,
}: {
   children: React.ReactNode;
}) {
   return (
      <html lang="en" suppressHydrationWarning>
         <body suppressHydrationWarning>
            <AuthProvider>{children}</AuthProvider>
         </body>
      </html>
   );
}
