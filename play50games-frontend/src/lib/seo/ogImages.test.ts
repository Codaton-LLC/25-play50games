import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ARCADE_GAMES, getGameMeta } from "@/arcade3d/registry";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, OG_IMAGES, gameOgImagePath, ogImage } from "./ogImages";

/** Games production can show ("live" / "soon"); a "dev" game gets its card and thumbnail before it leaves dev. */
const SHOWN_SLUGS = ARCADE_GAMES.filter((game) => game.status !== "dev").map((game) => game.slug);

const PUBLIC = fileURLToPath(new URL("../../../public", import.meta.url));

/** Reads a public/ file by its site path ("/images/..."). */
function publicFile(sitePath: string): Buffer {
   const file = path.join(PUBLIC, ...sitePath.split("/").filter(Boolean));
   expect(existsSync(file), `${sitePath} is missing in public/`).toBe(true);
   return readFileSync(file);
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(buf: Buffer): { width: number; height: number } {
   expect(buf.subarray(1, 4).toString("latin1")).toBe("PNG");
   return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Width and height of a WebP (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(buf: Buffer): { width: number; height: number } {
   expect(buf.subarray(0, 4).toString("latin1")).toBe("RIFF");
   expect(buf.subarray(8, 12).toString("latin1")).toBe("WEBP");
   const chunk = buf.subarray(12, 16).toString("latin1");
   if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
   if (chunk === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
   }
   expect(chunk).toBe("VP8X");
   return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
}

describe("Open Graph cards", () => {
   it.each(Object.entries(OG_IMAGES))("%s card is a 1200x630 PNG under 200 KB", (_name, sitePath) => {
      const buf = publicFile(sitePath);
      expect(pngSize(buf)).toEqual({ width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT });
      expect(buf.byteLength).toBeLessThanOrEqual(200 * 1024);
   });

   it.each(SHOWN_SLUGS)("%s has its own 1200x630 card under 200 KB", (slug) => {
      expect(gameOgImagePath(slug)).toBe(`/images/og/3d/${slug}.png`);
      const buf = publicFile(gameOgImagePath(slug));
      expect(pngSize(buf)).toEqual({ width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT });
      expect(buf.byteLength).toBeLessThanOrEqual(200 * 1024);
   });

   it("builds absolute urls on the site url", () => {
      expect(ogImage("https://example.test", OG_IMAGES.hub, "Hub")).toEqual({
         url: "https://example.test/images/og/hub.png",
         width: 1200,
         height: 630,
         alt: "Hub",
      });
      expect(ogImage("https://example.test/", gameOgImagePath("tower-climb"), "x").url).toBe(
         "https://example.test/images/og/3d/tower-climb.png",
      );
   });
});

describe("arcade thumbnails", () => {
   it.each(SHOWN_SLUGS)("%s meta.thumbnail is a 640x360 WebP under 60 KB", (slug) => {
      const thumbnail = getGameMeta(slug)?.thumbnail;
      expect(thumbnail).toBe(`/images/3d/${slug}.webp`);
      const buf = publicFile(thumbnail as string);
      expect(webpSize(buf)).toEqual({ width: 640, height: 360 });
      expect(buf.byteLength).toBeLessThanOrEqual(60 * 1024);
   });
});
