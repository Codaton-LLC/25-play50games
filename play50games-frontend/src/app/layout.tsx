import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PrivacyConsent from "@/components/PrivacyConsent/PrivacyConsent";
import { OG_IMAGES, ogImage } from "@/lib/seo/ogImages";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

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
      icon: "/images/logo/favicon.png",
      shortcut: "/images/logo/favicon.png",
      apple: "/images/logo/favicon.png",
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
         <body suppressHydrationWarning>
            {/* Google Tag Manager */}
            <Script
               id="gtm-script"
               strategy="afterInteractive"
               dangerouslySetInnerHTML={{
                  __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-M8N7FT9M');`,
               }}
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
