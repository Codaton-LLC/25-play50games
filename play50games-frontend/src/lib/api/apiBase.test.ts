import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApiBase } from "./apiBase";

const LIVE_API_URL = "https://cms.play50.games/wp-json/play50/v1";
const GAME_API_URL = "https://cms.play50.game/wp-json/play50/v1";

describe("getApiBase", () => {
   const originalEnv = { ...process.env };
   const originalWindow = (globalThis as unknown as { window?: unknown }).window;

   beforeEach(() => {
      process.env = { ...originalEnv };
      delete process.env.WORDPRESS_API_URL;
      delete process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete (globalThis as unknown as { window?: unknown }).window;
   });

   afterEach(() => {
      process.env = { ...originalEnv };
      if (originalWindow === undefined) {
         delete (globalThis as unknown as { window?: unknown }).window;
      } else {
         (globalThis as unknown as { window?: unknown }).window = originalWindow;
      }
   });

   const stubBrowser = (origin: string) => {
      (globalThis as unknown as { window: { location: { origin: string } } }).window = {
         location: { origin },
      };
   };

   describe("server-side (typeof window === 'undefined')", () => {
      it("returns the live API fallback when all env vars are unset", () => {
         expect(getApiBase()).toBe(LIVE_API_URL);
      });

      it("returns WORDPRESS_API_URL when set to a valid non-localhost URL", () => {
         process.env.WORDPRESS_API_URL = "https://backend.example.com/wp-json/play50/v1";
         expect(getApiBase()).toBe("https://backend.example.com/wp-json/play50/v1");
      });

      it("prefers WORDPRESS_API_URL over NEXT_PUBLIC_WORDPRESS_API_URL on the server", () => {
         process.env.WORDPRESS_API_URL = "https://server.internal/wp-json/play50/v1";
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "https://public.example.com/wp-json/play50/v1";
         expect(getApiBase()).toBe("https://server.internal/wp-json/play50/v1");
      });

      it("rejects WORDPRESS_API_URL containing localhost by default and falls back", () => {
         process.env.WORDPRESS_API_URL = "http://localhost:8080/wp-json/play50/v1";
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "https://public.example.com/wp-json/play50/v1";
         expect(getApiBase()).toBe("https://public.example.com/wp-json/play50/v1");
      });

      it("allows WORDPRESS_API_URL containing localhost when allowLocalhost is true", () => {
         process.env.WORDPRESS_API_URL = "http://localhost:8080/wp-json/play50/v1";
         expect(getApiBase({ allowLocalhost: true })).toBe("http://localhost:8080/wp-json/play50/v1");
      });

      it("returns NEXT_PUBLIC_WORDPRESS_API_URL when WORDPRESS_API_URL is unset", () => {
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "https://public.example.com/wp-json/play50/v1";
         expect(getApiBase()).toBe("https://public.example.com/wp-json/play50/v1");
      });

      it("rejects NEXT_PUBLIC_WORDPRESS_API_URL containing localhost on the server", () => {
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "http://localhost/wp-json/play50/v1";
         expect(getApiBase()).toBe(LIVE_API_URL);
      });

      it("allows NEXT_PUBLIC_WORDPRESS_API_URL containing localhost when allowLocalhost is true", () => {
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "http://localhost/wp-json/play50/v1";
         expect(getApiBase({ allowLocalhost: true })).toBe("http://localhost/wp-json/play50/v1");
      });

      it("detects play50.game from NEXT_PUBLIC_SITE_URL on the server", () => {
         process.env.NEXT_PUBLIC_SITE_URL = "https://play50.game";
         expect(getApiBase()).toBe(GAME_API_URL);
      });

      it("detects play50.games from NEXT_PUBLIC_SITE_URL on the server", () => {
         process.env.NEXT_PUBLIC_SITE_URL = "https://play50.games";
         expect(getApiBase()).toBe(LIVE_API_URL);
      });
   });

   describe("browser (typeof window !== 'undefined')", () => {
      it("returns NEXT_PUBLIC_WORDPRESS_API_URL when set to a valid non-localhost URL", () => {
         stubBrowser("https://play50.games");
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "https://cdn.example.com/wp-json/play50/v1";
         expect(getApiBase()).toBe("https://cdn.example.com/wp-json/play50/v1");
      });

      it("ignores WORDPRESS_API_URL on the client", () => {
         stubBrowser("https://play50.games");
         process.env.WORDPRESS_API_URL = "https://server.internal/wp-json/play50/v1";
         expect(getApiBase()).toBe(LIVE_API_URL);
      });

      it("rejects NEXT_PUBLIC_WORDPRESS_API_URL containing localhost and falls back to origin rules", () => {
         stubBrowser("https://play50.game");
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "http://localhost:3000/api";
         expect(getApiBase()).toBe(GAME_API_URL);
      });

      it("allows NEXT_PUBLIC_WORDPRESS_API_URL containing localhost when allowLocalhost is true", () => {
         stubBrowser("https://play50.game");
         process.env.NEXT_PUBLIC_WORDPRESS_API_URL = "http://localhost:3000/api";
         expect(getApiBase({ allowLocalhost: true })).toBe("http://localhost:3000/api");
      });

      describe("origin detection when env vars are unset", () => {
         it("resolves play50.games to the live CMS URL", () => {
            stubBrowser("https://play50.games");
            expect(getApiBase()).toBe(LIVE_API_URL);
         });

         it("resolves subdomain on play50.games to the live CMS URL", () => {
            stubBrowser("https://preview.play50.games");
            expect(getApiBase()).toBe(LIVE_API_URL);
         });

         it("resolves play50.game to the .game CMS URL", () => {
            stubBrowser("https://play50.game");
            expect(getApiBase()).toBe(GAME_API_URL);
         });

         it("resolves subdomain on play50.game to the .game CMS URL", () => {
            stubBrowser("https://staging.play50.game");
            expect(getApiBase()).toBe(GAME_API_URL);
         });

         it("falls back to LIVE_API_URL for 25-play50games.vercel.app", () => {
            stubBrowser("https://25-play50games.vercel.app");
            expect(getApiBase()).toBe(LIVE_API_URL);
         });

         it("falls back to LIVE_API_URL for localhost dev origin", () => {
            stubBrowser("http://localhost:3000");
            expect(getApiBase()).toBe(LIVE_API_URL);
         });

         it("falls back to LIVE_API_URL for 127.0.0.1 dev origin", () => {
            stubBrowser("http://127.0.0.1:3400");
            expect(getApiBase()).toBe(LIVE_API_URL);
         });
      });
   });
});
