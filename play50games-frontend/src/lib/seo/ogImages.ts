// Static Open Graph cards (1200x630 PNG, built by tools/og/generate.mjs into public/images/og).
// Pages attach them with absolute URLs on NEXT_PUBLIC_SITE_URL; ogImages.test.ts checks that
// every path here (and every game's card) exists in public/.

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const OG_IMAGES = {
   hub: "/images/og/hub.png",
   classic: "/images/og/classic.png",
   arcade: "/images/og/arcade.png",
} as const;

/** The category cards of the classic games (game_type of the WordPress API). */
export const CLASSIC_OG_TYPES = ["logic", "memory", "speed", "skill", "final"] as const;
export type ClassicOgType = (typeof CLASSIC_OG_TYPES)[number];

/** The card of one classic game: its category's card, or the Classic 50 card for an unknown type. */
export function classicOgImagePath(gameType: string | undefined): string {
   return (CLASSIC_OG_TYPES as readonly string[]).includes(gameType ?? "")
      ? `/images/og/classic/${gameType}.png`
      : OG_IMAGES.classic;
}

/** The card of one 3D Arcade game. */
export function gameOgImagePath(slug: string): string {
   return `/images/og/3d/${slug}.png`;
}

/** An openGraph.images entry: absolute URL on siteUrl, card size, alt text. */
export function ogImage(siteUrl: string, imagePath: string, alt: string) {
   return {
      url: `${siteUrl.replace(/\/+$/, "")}${imagePath}`,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      alt,
   };
}
