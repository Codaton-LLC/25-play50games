// guide.ts: one line from the found count (and on a map level its gates and its chain).
import { describe, expect, it } from "vitest";
import { hintFor, mapPiecesIn, mapPiecesOf } from "./guide";
import { MAP_2, MAP_3, MAP_4, MAP_5 } from "./maps";

describe("treasure-island guide", () => {
   it("starts with the detector, counts what is found, and ends on a ready line", () => {
      expect(hintFor(0, 5).text).toMatch(/detector ring turns gold/);
      expect(hintFor(2, 5).text).toMatch(/2 of 5 found/);
      expect(hintFor(5, 5).tone).toBe("ready");
   });

   it("names a shut gate and how many finds open it", () => {
      expect(hintFor(1, 5, MAP_2)).toEqual({ text: "A fallen palm blocks the east bridge: 1 more find opens it", tone: "warn" });
      expect(hintFor(2, 5, MAP_2).text).toMatch(/2 of 5 found/);
      expect(hintFor(2, 6, MAP_4).text).toMatch(/^Vines seal the temple gate: 1 more find/);
      expect(hintFor(0, 6, MAP_4).text).toMatch(/first find is a clue/);
      expect(hintFor(1, 6, MAP_4).text).toMatch(/^Vines seal the temple gate: 2 more finds open it/);
      // the summit rockfall opens with the whole map: the chain's lines tell it
      expect(hintFor(2, 6, MAP_5).text).toMatch(/^Map 1\/3: find every piece to clear the way to the final chest/);
   });

   it("walks the clue -> map -> chest chain", () => {
      expect(hintFor(0, 6, MAP_3).text).toMatch(/first find is a clue/);
      expect(hintFor(1, 6, MAP_3).text).toMatch(/^A clue! The gull circles over the next spot\. Map 0\/2/);
      expect(hintFor(2, 6, MAP_3).text).toMatch(/^Map 1\/2/);
      expect(hintFor(5, 6, MAP_3)).toEqual({ text: "Map complete! Follow the red X to the final chest, then hold Dig", tone: "ready" });
      expect([mapPiecesOf(MAP_3), mapPiecesOf(MAP_4), mapPiecesOf(MAP_5)]).toEqual([2, 3, 3]);
      expect(mapPiecesIn(MAP_4, 4)).toBe(2);
      expect(mapPiecesOf(MAP_2)).toBe(0);
   });
});
