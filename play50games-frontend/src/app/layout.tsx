import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PrivacyConsent from "@/components/PrivacyConsent/PrivacyConsent";
import { OG_IMAGES, ogImage } from "@/lib/seo/ogImages";
import { getApiBase } from "@/lib/api/apiBase";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

function apiOrigin(): string | null {
   try {
      return new URL(getApiBase()).origin;
   } catch {
      return null;
   }
}

const API_ORIGIN = apiOrigin();

const DEFAULT_TITLE = "Play50Games – classic brain games and a 3D Arcade";
const DEFAULT_DESCRIPTION =
   "One place to play: 50 classic brain games with a certificate at the end, plus a 3D Arcade of quick mini-games that each keep their own best score.";
const DEFAULT_IMAGE = ogImage(SITE_URL, OG_IMAGES.hub, "Play50Games - classic brain games and a 3D Arcade");

export const metadata: Metadata = {
   metadataBase: new URL(SITE_URL),
   title: {
      default: DEFAULT_TITLE,
      template: "%s | Play50Games",
   },
   description: DEFAULT_DESCRIPTION,
   keywords: [
      "browser games",
      "online games",
      "free online games",
      "brain games",
      "logic games",
      "memory games",
      "speed games",
      "skill games",
      "brain training",
      "3d games",
      "3d arcade",
      "arcade games",
      "mini games",
      "certificate",
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
      // small copies of favicon.png (536 x 598, 244 KB), which every page used to download
      icon: "/images/logo/favicon-64.png",
      shortcut: "/images/logo/favicon-64.png",
      apple: "/images/logo/favicon-180.png",
   },
   openGraph: {
      type: "website",
      locale: "en_US",
      url: SITE_URL,
      siteName: "Play50Games",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_IMAGE],
   },
   twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [DEFAULT_IMAGE.url],
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
         <head>
            {/* warm the connection the first client request needs (WP API, CORS fetch) */}
            {API_ORIGIN ? <link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" /> : null}
         </head>
         <body suppressHydrationWarning>
            {/* Google Tag Manager: the standard snippet split in two. The dataLayer and the
               gtm.js start event are set up right after hydration, as before, so every
               dataLayer.push (e.g. the arcade events) is queued; gtm.js itself (117 KB) loads
               once the page has finished loading and replays the queue. */}
            <Script
               id="gtm-init"
               strategy="afterInteractive"
               dangerouslySetInnerHTML={{
                  __html: `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`,
               }}
            />
            <Script
               id="gtm-script"
               strategy="lazyOnload"
               src="https://www.googletagmanager.com/gtm.js?id=GTM-M8N7FT9M"
            />
            {/* Google Tag Manager (noscript) */}
            <noscript>
               <iframe
                  src="https://www.googletagmanager.com/ns.html?id=GTM-M8N7FT9M"
                  height="0"
                  width="0"
                  style={{ display: "none", visibility: "hidden" }}
               />
            </noscript>
            {/* End Google Tag Manager (noscript) */}
            <AuthProvider>
               {children}
               <PrivacyConsent />
            </AuthProvider>
         </body>
      </html>
   );
}
