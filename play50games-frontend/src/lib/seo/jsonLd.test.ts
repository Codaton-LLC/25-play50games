import { describe, expect, it } from "vitest";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { robotCollectorMeta } from "@/arcade3d/games/robot-collector/meta";
import { arcadeJsonLd, gameJsonLd, hubJsonLd, serializeJsonLd } from "./jsonLd";

const SITE_URL = "https://games.example";
const LIVE: ArcadeGameMeta = {
   ...robotCollectorMeta,
   title: "Test robot",
   description: "Collect batteries.",
   status: "live",
   thumbnail: "/images/3d/robot-collector.webp",
};
const SOON: ArcadeGameMeta = { ...LIVE, slug: "tower-climb", status: "soon" };
const VIDEO_GAME = {
   "@context": "https://schema.org",
   "@type": "VideoGame",
   name: "Test robot",
   description: "Collect batteries.",
   url: "https://games.example/3d/robot-collector",
   image: "https://games.example/images/3d/robot-collector.webp",
   genre: "Arcade",
   gamePlatform: "Web browser",
   applicationCategory: "Game",
   operatingSystem: "Any",
   isAccessibleForFree: true,
};

describe("hub JSON-LD", () => {
   it("describes the website and both collections with absolute URLs", () => {
      expect(hubJsonLd(SITE_URL, true)).toEqual([
         { "@context": "https://schema.org", "@type": "WebSite", name: "Play50Games", url: "https://games.example/" },
         {
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: 2,
            itemListElement: [
               {
                  "@type": "ListItem", position: 1,
                  item: { "@type": "CollectionPage", name: "Classic 50 Games", url: "https://games.example/classic" },
               },
               {
                  "@type": "ListItem", position: 2,
                  item: { "@type": "CollectionPage", name: "3D Arcade", url: "https://games.example/3d" },
               },
            ],
         },
      ]);
   });

   it("omits the arcade collection when disabled", () => {
      expect(hubJsonLd(SITE_URL, false)).toEqual([
         { "@context": "https://schema.org", "@type": "WebSite", name: "Play50Games", url: "https://games.example/" },
         {
            "@context": "https://schema.org", "@type": "ItemList", numberOfItems: 1,
            itemListElement: [{
               "@type": "ListItem", position: 1,
               item: { "@type": "CollectionPage", name: "Classic 50 Games", url: "https://games.example/classic" },
            }],
         },
      ]);
   });

   it("normalizes a trailing slash on the configured site URL", () => {
      expect(hubJsonLd(`${SITE_URL}/`, true)).toEqual(hubJsonLd(SITE_URL, true));
   });
});

describe("arcade JSON-LD", () => {
   it("lists only live games with consecutive one-based positions", () => {
      const second: ArcadeGameMeta = { ...LIVE, slug: "office-escape", thumbnail: null };
      expect(arcadeJsonLd(SITE_URL, [SOON, LIVE, SOON, second], true)).toEqual({
         "@context": "https://schema.org", "@type": "ItemList", numberOfItems: 2,
         itemListElement: [
            { "@type": "ListItem", position: 1, item: VIDEO_GAME },
            {
               "@type": "ListItem", position: 2,
               item: {
                  "@context": "https://schema.org", "@type": "VideoGame",
                  name: "Test robot", description: "Collect batteries.",
                  url: "https://games.example/3d/office-escape", genre: "Arcade",
                  gamePlatform: "Web browser", applicationCategory: "Game",
                  operatingSystem: "Any", isAccessibleForFree: true,
               },
            },
         ],
      });
   });

   it("emits nothing when the arcade flag is off", () => {
      expect(arcadeJsonLd(SITE_URL, [LIVE], false)).toBeNull();
   });

   it("supports a collection with no live games", () => {
      expect(arcadeJsonLd(SITE_URL, [SOON], true)).toEqual({
         "@context": "https://schema.org", "@type": "ItemList", numberOfItems: 0, itemListElement: [],
      });
   });
});

describe("game JSON-LD", () => {
   it("describes a live game with the requested VideoGame properties", () => {
      expect(gameJsonLd(SITE_URL, LIVE, true)).toEqual(VIDEO_GAME);
   });

   it("emits nothing for soon games, missing games or a disabled arcade", () => {
      expect(gameJsonLd(SITE_URL, SOON, true)).toBeNull();
      expect(gameJsonLd(SITE_URL, undefined, true)).toBeNull();
      expect(gameJsonLd(SITE_URL, LIVE, false)).toBeNull();
   });

   it("omits image when no thumbnail is set", () => {
      const data = gameJsonLd(SITE_URL, { ...LIVE, thumbnail: null }, true);
      expect(data).toMatchObject({ "@type": "VideoGame", url: "https://games.example/3d/robot-collector" });
      expect(data).not.toHaveProperty("image");
   });

   it("preserves an already absolute thumbnail URL", () => {
      expect(gameJsonLd(`${SITE_URL}/`, { ...LIVE, thumbnail: "https://cdn.example/robot.webp" }, true))
         .toEqual({ ...VIDEO_GAME, image: "https://cdn.example/robot.webp" });
   });
});

describe("JSON-LD serialization", () => {
   it("escapes every less-than sign, blocking mixed-case script termination", () => {
      const data = { name: "</script><script>alert(1)</script>", description: "</ScRiPt><!-- < & >" };
      const serialized = serializeJsonLd(data);
      expect(serialized).toBe('{"name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>","description":"\\u003c/ScRiPt>\\u003c!-- \\u003c & >"}');
      expect(serialized).not.toContain("<");
      expect(JSON.parse(serialized)).toEqual(data);
   });

   it("serializes page data as JSON without changing its values", () => {
      expect(JSON.parse(serializeJsonLd(VIDEO_GAME))).toEqual(VIDEO_GAME);
   });
});
