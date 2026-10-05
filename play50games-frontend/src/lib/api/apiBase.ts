// Single source for the WordPress REST base URL (play50/v1).
// New code (3D Arcade) uses this; the older lib/api/*.ts copies move here in Phase 5.

const LIVE_API_URL = "https://cms.play50.games/wp-json/play50/v1";

const usable = (url: string | undefined): url is string => !!url && !url.includes("localhost");

export function getApiBase(): string {
   if (typeof window !== "undefined") {
      const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
      if (usable(envUrl)) return envUrl;

      const origin = window.location.origin;
      if (origin.includes("play50.games")) return LIVE_API_URL;
      if (origin.includes("play50.game")) return "https://cms.play50.game/wp-json/play50/v1";
      return LIVE_API_URL;
   }

   if (usable(process.env.WORDPRESS_API_URL)) return process.env.WORDPRESS_API_URL;
   if (usable(process.env.NEXT_PUBLIC_WORDPRESS_API_URL)) return process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
   return LIVE_API_URL;
}
