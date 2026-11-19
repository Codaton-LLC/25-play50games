import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OG_IMAGES } from "./ogImages";
import { pageSocial } from "./pageMetadata";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, absoluteUrl, normalizeSiteUrl } from "./site";

afterEach(() => {
   vi.unstubAllEnvs();
   vi.unstubAllGlobals();
   vi.resetModules();
});

describe("site url", () => {
   it("strips trailing slashes and falls back when the variable is empty", () => {
      expect(normalizeSiteUrl("https://play50games.netlify.app/")).toBe("https://play50games.netlify.app");
      expect(normalizeSiteUrl("  https://a.example//  ")).toBe("https://a.example");
      expect(normalizeSiteUrl(undefined, "https://fallback.example")).toBe("https://fallback.example");
      expect(normalizeSiteUrl("", "https://fallback.example")).toBe("https://fallback.example");
   });

   it("builds absolute urls", () => {
      expect(absoluteUrl("/faq", "https://a.example/")).toBe("https://a.example/faq");
      expect(absoluteUrl("faq", "https://a.example")).toBe("https://a.example/faq");
   });

   it("NEXT_PUBLIC_SITE_URL drives robots.txt and the sitemap", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://play50games.netlify.app/");
      // no network in a unit test: the sitemap falls back to its list of fifty game ids
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      vi.resetModules();

      const robots = (await import("@/app/robots")).default();
      expect(robots.sitemap).toBe("https://play50games.netlify.app/sitemap.xml");
      const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
      // a prefix without a trailing slash: /diagnostics itself is covered
      expect(rules.disallow).toContain("/diagnostics");
      // the bundles and next/image live under /_next: crawlers need them to render the pages
      expect(rules.disallow).not.toContain("/_next/");

      const entries = await (await import("@/app/sitemap")).default();
      expect(entries.length).toBeGreaterThan(50);
      for (const entry of entries) expect(entry.url.startsWith("https://play50games.netlify.app/")).toBe(true);
      const urls = entries.map((entry) => entry.url);
      expect(urls).toContain("https://play50games.netlify.app/games/18");
      expect(urls.filter((url) => /diagnostics|scale-squad|pangoroll/.test(url))).toEqual([]);
   // importing the sitemap loads the whole arcade registry: slow on a busy machine
   }, 30_000);

   it("lists both 3D worlds while the arcade is on", async () => {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://a.example");
      vi.stubEnv("NEXT_PUBLIC_ARCADE_ENABLED", "1");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      vi.resetModules();

      const urls = (await (await import("@/app/sitemap")).default()).map((entry) => entry.url);
      expect(urls).toContain("https://a.example/3d");
      expect(urls).toContain("https://a.example/pangoroll-worlds");
      // a Pangoroll Worlds game keeps its /3d/[slug] page
      expect(urls).toContain("https://a.example/3d/sky-tower-jump");
      expect(urls.filter((url) => /scale-squad/.test(url))).toEqual([]);
   }, 30_000);
});

describe("theme-color", () => {
   it("matches the page canvas of each theme in app/theme.css", () => {
      const css = readFileSync(fileURLToPath(new URL("../../app/theme.css", import.meta.url)), "utf8");
      const canvas = [...css.matchAll(/--p50-canvas:\s*(#[0-9a-f]{6})/gi)].map((match) => match[1].toLowerCase());
      // :root (light), the system-dark block, and data-theme="dark"
      expect(canvas[0]).toBe(THEME_COLOR_LIGHT);
      expect(canvas.slice(1)).toEqual([THEME_COLOR_DARK, THEME_COLOR_DARK]);
   });
});

describe("pageSocial", () => {
   it("gives a page its own canonical, og:url, titles and card", () => {
      const social = pageSocial({ title: "FAQ", description: "Answers.", path: "/faq", siteUrl: "https://a.example/" });
      expect(social.alternates).toEqual({ canonical: "/faq" });
      expect(social.openGraph).toMatchObject({
         url: "https://a.example/faq",
         title: "FAQ | Play50Games",
         description: "Answers.",
         siteName: "Play50Games",
         images: [{ url: `https://a.example${OG_IMAGES.hub}`, width: 1200, height: 630, alt: "FAQ - Play50Games" }],
      });
      expect(social.twitter).toMatchObject({
         card: "summary_large_image",
         title: "FAQ | Play50Games",
         images: [`https://a.example${OG_IMAGES.hub}`],
      });
   });

   it("takes another card", () => {
      const social = pageSocial({ title: "T", description: "D", path: "/x", image: OG_IMAGES.classic, siteUrl: "https://a.example" });
      expect(social.twitter?.images).toEqual([`https://a.example${OG_IMAGES.classic}`]);
   });
});
