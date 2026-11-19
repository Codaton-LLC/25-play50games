import type { Metadata } from "next";
import { OG_IMAGES, ogImage } from "./ogImages";
import { SITE_NAME, SITE_URL, absoluteUrl } from "./site";

export interface PageSocialInput {
   /** the page title without the site name ("FAQ") */
   title: string;
   description: string;
   /** the page path ("/faq"): the canonical and the og:url */
   path: string;
   /** a card under public/ ("/images/og/hub.png"); the hub card when left out */
   image?: string;
   siteUrl?: string;
}

/**
 * Canonical, Open Graph and Twitter fields of one page. A page that sets no `openGraph` inherits
 * the root layout's whole block (the hub's title and URL), so every page spreads this in.
 * The root title template does not reach og:title, hence the site name is added here.
 */
export function pageSocial({
   title,
   description,
   path,
   image = OG_IMAGES.hub,
   siteUrl = SITE_URL,
}: PageSocialInput): Pick<Metadata, "alternates" | "openGraph" | "twitter"> {
   const socialTitle = `${title} | ${SITE_NAME}`;
   const card = ogImage(siteUrl, image, `${title} - ${SITE_NAME}`);
   return {
      alternates: { canonical: path },
      openGraph: {
         type: "website",
         locale: "en_US",
         url: absoluteUrl(path, siteUrl),
         siteName: SITE_NAME,
         title: socialTitle,
         description,
         images: [card],
      },
      twitter: {
         card: "summary_large_image",
         title: socialTitle,
         description,
         images: [card.url],
      },
   };
}
