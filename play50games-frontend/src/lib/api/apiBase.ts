// Single source for the WordPress REST base URL (play50/v1).
// Replaces the older lib/api/*.ts, verify, and sitemap copies in Phase 5.

const LIVE_API_URL = "https://cms.play50.games/wp-json/play50/v1";

const usable = (url: string | undefined): url is string => !!url && !url.includes("localhost");

export interface ApiBaseOptions {
   /**
    * Allow localhost URLs in environment variables (disabled by default
    * to prevent accidental requests to non-existent local WordPress servers).
    */
   allowLocalhost?: boolean;
}

export function getApiBase(options?: ApiBaseOptions): string {
   const isUsable = options?.allowLocalhost
      ? (url: string | undefined): url is string => !!url
      : usable;

   if (typeof window !== "undefined") {
      const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
      if (isUsable(envUrl)) return envUrl;

      const origin = window.location.origin;
      if (origin.includes("play50.games")) return LIVE_API_URL;
      if (origin.includes("play50.game")) return "https://cms.play50.game/wp-json/play50/v1";
      return LIVE_API_URL;
   }

   if (isUsable(process.env.WORDPRESS_API_URL)) return process.env.WORDPRESS_API_URL;
   if (isUsable(process.env.NEXT_PUBLIC_WORDPRESS_API_URL)) return process.env.NEXT_PUBLIC_WORDPRESS_API_URL;

   const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
   if (isUsable(siteUrl)) {
      if (siteUrl.includes("play50.games")) return LIVE_API_URL;
      if (siteUrl.includes("play50.game")) return "https://cms.play50.game/wp-json/play50/v1";
   }

   return LIVE_API_URL;
}

