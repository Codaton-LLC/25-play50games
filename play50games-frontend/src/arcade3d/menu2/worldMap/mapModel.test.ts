import { describe, expect, it } from "vitest";
import { ALL_STARS, STAR_BIT } from "../stars/stars";
import { applyLevelResult, emptyProgress, type ProgressData } from "../progress/progress";
import { getGameMeta } from "@/arcade3d/registry";
import { W6_UNLOCK_FRACTION, buildMap, buildWorld, gamesToW6, isPerfect, isWorldUnlocked, type MapOptions } from "./mapModel";
import { WORLDS, toSlug, worldOfSlug } from "./worlds";

const ALL_BUILT: MapOptions = {
   built: Object.fromEntries(WORLDS.flatMap((w) => w.games.map((g) => [g.slug, { levelCount: 5 }]))),
};

function clear(data: ProgressData, slug: string, levels = 5, stars: number = STAR_BIT.clear): ProgressData {
   let d = data;
   for (let level = 1; level <= levels; level++) d = applyLevelResult(d, { slug, level, cleared: true, stars, noHit: false, secrets: [] }).data;
   return d;
}

describe("worlds data (00-framework.md)", () => {
   it("six worlds, 50 games, each index once, 8 per world and 10 in W6", () => {
      expect(WORLDS).toHaveLength(6);
      const all = WORLDS.flatMap((w) => w.games.map((g) => g.index));
      expect(all).toHaveLength(50);
      expect(new Set(all).size).toBe(50);
      expect([...all].sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
      expect(WORLDS.map((w) => w.games.length)).toEqual([8, 8, 8, 8, 8, 10]);
   });

   it("slugs match the built Menu 2 games' meta", () => {
      for (const slug of ["sky-tower-jump", "rooftop-roll-climb", "flooded-ruins-escape", "lava-pillar-jump", "cloud-hopper"]) {
         expect(worldOfSlug(slug), slug).toBeDefined();
         expect(getGameMeta(slug)?.collection, slug).toBe("rollheroes");
      }
      expect(toSlug("Gem Collector 3D")).toBe("gem-collector-3d");
      expect(toSlug("Sky & Sea")).toBe("sky-sea");
   });

   it("no banned Menu 2 words in any title", () => {
      const banned = /turtle|ninja|mask|katana|pizza|sewer|rat\b|sensei|star\b/i;
      for (const w of WORLDS) for (const g of w.games) expect(g.title).not.toMatch(banned);
   });
});

describe("unlocks", () => {
   it("a fresh player: first game of W1-W5 new, the rest locked, W6 closed", () => {
      const map = buildMap(emptyProgress(), ALL_BUILT);
      for (const w of map.slice(0, 5)) {
         expect(w.unlocked).toBe(true);
         expect(w.nodes[0].state).toBe("new");
         expect(w.nodes.slice(1).every((n) => n.state === "locked")).toBe(true);
         expect(w.fill).toBe(0);
      }
      expect(map[5].unlocked).toBe(false);
      expect(map[5].nodes.every((n) => n.state === "locked")).toBe(true);
   });

   it("games open in order inside a world; played-not-cleared is 'unlocked'", () => {
      let d = applyLevelResult(emptyProgress(), { slug: "sky-tower-jump", level: 1, cleared: true, stars: 1, noHit: false, secrets: [] }).data;
      let w2 = buildWorld(WORLDS[1], d, ALL_BUILT);
      expect(w2.nodes[0].state).toBe("unlocked");
      expect(w2.nodes[1].state).toBe("locked");
      d = clear(d, "sky-tower-jump", 5, ALL_STARS);
      w2 = buildWorld(WORLDS[1], d, ALL_BUILT);
      expect(w2.nodes[0].state).toBe("cleared");
      expect(isPerfect(w2.nodes[0])).toBe(true);
      expect(w2.nodes[1].state).toBe("new");
      expect(w2.nodes[2].state).toBe("locked");
      expect(w2.fill).toBeCloseTo(1 / 8);
      expect(w2.stars).toBe(15);
      expect(w2.maxStars).toBe(8 * 15);
   });

   it("W6 opens once each of W1-W5 is at least half cleared", () => {
      expect(W6_UNLOCK_FRACTION).toBe(0.5);
      let d = emptyProgress();
      expect(gamesToW6(d, ALL_BUILT)).toBe(20);
      for (const w of WORLDS.slice(0, 5)) for (const g of w.games.slice(0, 4)) d = clear(d, g.slug);
      expect(isWorldUnlocked(6, d, ALL_BUILT)).toBe(true);
      expect(gamesToW6(d, ALL_BUILT)).toBe(0);
      const w6 = buildWorld(WORLDS[5], d, ALL_BUILT);
      expect(w6.nodes[0].state).toBe("new");
      // one world short of half: closed again
      let e = emptyProgress();
      for (const w of WORLDS.slice(0, 5)) for (const g of w.games.slice(0, w.id === 3 ? 3 : 4)) e = clear(e, g.slug);
      expect(isWorldUnlocked(6, e, ALL_BUILT)).toBe(false);
      expect(gamesToW6(e, ALL_BUILT)).toBe(1);
   });

   it("unbuilt games are 'soon' and block the ones after them; the preview opens every built game", () => {
      const opts: MapOptions = { built: { "sky-tower-jump": { levelCount: 5 }, "cloud-hopper": { levelCount: 5 } } };
      const w2 = buildWorld(WORLDS[1], emptyProgress(), opts);
      expect(w2.nodes.map((n) => n.state)).toEqual(["new", "soon", "locked", "soon", "soon", "soon", "soon", "soon"]);
      const preview = buildWorld(WORLDS[1], emptyProgress(), { ...opts, unlockAll: true });
      expect(preview.nodes.map((n) => n.state).slice(0, 3)).toEqual(["new", "soon", "new"]);
      expect(preview.nodes[2].playable).toBe(true);
      expect(buildWorld(WORLDS[5], emptyProgress(), { ...ALL_BUILT, unlockAll: true }).unlocked).toBe(true);
   });

   it("a game with fewer levels is cleared after its own levels", () => {
      const opts: MapOptions = { built: { ...ALL_BUILT.built, "sky-tower-jump": { levelCount: 1 } } };
      const d = clear(emptyProgress(), "sky-tower-jump", 1);
      expect(buildWorld(WORLDS[1], d, opts).nodes[0].state).toBe("cleared");
      expect(buildWorld(WORLDS[1], d, ALL_BUILT).nodes[0].state).toBe("unlocked");
   });
});
