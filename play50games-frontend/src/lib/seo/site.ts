// The one place that reads the site address. Canonicals, Open Graph URLs, the sitemap, robots.txt
// and JSON-LD all build on SITE_URL, so NEXT_PUBLIC_SITE_URL (set on the host) drives every one of
// them. The default below only applies when the variable is missing.

/** A site address without trailing slashes; `fallback` when the value is empty. */
export function normalizeSiteUrl(value: string | undefined, fallback = "https://play50games.com"): string {
   const trimmed = (value ?? "").trim().replace(/\/+$/, "");
   return trimmed || fallback;
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_NAME = "Play50Games";

/** An absolute URL on the site for a path that starts with "/". */
export function absoluteUrl(path: string, siteUrl: string = SITE_URL): string {
   return `${siteUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

// The browser bar colour: the page canvas of each theme (--p50-canvas in app/theme.css;
// site.test.ts fails when the two drift apart).
export const THEME_COLOR_LIGHT = "#f2f4f8";
export const THEME_COLOR_DARK = "#0b0f1a";
