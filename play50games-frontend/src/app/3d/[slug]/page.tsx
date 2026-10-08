// One 3D Arcade game, full screen. The page is static (every slug); the game itself mounts on the
// client only (ArcadeGameMount -> GAME_LOADERS + GameShell), so three.js never ships with the page.
// "soon" games stay playable at their URL but are noindex (their cards are not clickable).
// "dev" games are 404 unless NEXT_PUBLIC_ARCADE_PREVIEW is on (preview builds), and noindex there.
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import { ARCADE_SLUGS, isArcadeSlug } from "@/arcade3d/types";
import { getGameMeta, isGameVisible } from "@/arcade3d/registry";
import ArcadeGameMount from "@/arcade3d/core/ArcadeGameMount";
import { gameJsonLd, serializeJsonLd } from "@/lib/seo/jsonLd";
import { gameOgImagePath, ogImage } from "@/lib/seo/ogImages";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://play50games.com";

interface PageProps {
   params: { slug: string };
}

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string }> {
   return ARCADE_SLUGS.map((slug) => ({ slug }));
}

export const viewport: Viewport = {
   width: "device-width",
   initialScale: 1,
   // lets the shell use env(safe-area-inset-*) around notches and home bars
   viewportFit: "cover",
   themeColor: "#0b1020",
};

export function generateMetadata({ params }: PageProps): Metadata {
   const meta = ARCADE_ENABLED ? getGameMeta(params.slug) : undefined;
   if (!meta || !isGameVisible(meta)) return {};

   const url = `${SITE_URL}/3d/${meta.slug}`;
   const socialTitle = `${meta.title} | 3D Arcade | Play50Games`;
   const image = ogImage(SITE_URL, gameOgImagePath(meta.slug), `${meta.title} - 3D Arcade`);

   return {
      title: meta.title,
      description: meta.description,
      alternates: { canonical: `/3d/${meta.slug}` },
      robots: meta.status === "live" ? undefined : { index: false, follow: true },
      openGraph: {
         type: "website",
         locale: "en_US",
         url,
         siteName: "Play50Games",
         title: socialTitle,
         description: meta.description,
         images: [image],
      },
      twitter: {
         card: "summary_large_image",
         title: socialTitle,
         description: meta.description,
         images: [image.url],
      },
   };
}

export default function ArcadeGamePage({ params }: PageProps) {
   const meta = ARCADE_ENABLED && isArcadeSlug(params.slug) ? getGameMeta(params.slug) : undefined;
   if (!meta || !isGameVisible(meta)) notFound();
   const jsonLd = gameJsonLd(SITE_URL, meta, ARCADE_ENABLED);
   return (
      <main>
         {jsonLd && (
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
         )}
         <ArcadeGameMount slug={meta.slug} />
      </main>
   );
}
