// The five tracks follow the card: 8 / 12 / 16 / 20 / 25 gates, 2 / 3 / 4 / 4 / 5 colours, obstacle types
// growing level by level, no hazard crowding a gate, the fast pairs, the arena on level 5.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { secretProblems } from "@/arcade3d/menu2/secrets/secrets";
import { CHROMA, SECRETS } from "./progression";
import { GATE_CLEAR, PALETTE, buildTrack, gatesToPass, sweeperX } from "./track";

describe("tracks", () => {
   it("gates and colours per level (the card)", () => {
      expect(LEVEL_IDS.map(gatesToPass)).toEqual([8, 12, 16, 20, 25]);
      expect(LEVEL_IDS.map((id) => buildTrack(id).colors)).toEqual([2, 3, 4, 4, 5]);
      for (const id of LEVEL_IDS) {
         const t = buildTrack(id);
         for (const g of t.gates) for (const c of [...g.colors, g.alt]) expect(c).toBeLessThan(t.colors);
      }
      expect(PALETTE.map((p) => p.shape)).toEqual(["circle", "triangle", "square", "diamond", "hexagon"]);
   });

   it("obstacle types grow: blocks, then walls, then sweepers and blink gates, then beams, gaps and split gates", () => {
      const kinds = LEVEL_IDS.map((id) => new Set(buildTrack(id).obstacles.map((o) => o.kind)));
      expect([...kinds[0]]).toEqual(["block"]);
      expect(kinds[1].has("wall")).toBe(true);
      expect(kinds[2].has("sweeper")).toBe(true);
      for (const k of ["beam", "gap"]) expect(kinds[3].has(k as never)).toBe(true);
      expect(buildTrack(3).gates.some((g) => g.kind === "blink")).toBe(true);
      expect(buildTrack(4).gates.some((g) => g.kind === "split")).toBe(true);
      expect(buildTrack(1).gates.every((g) => g.kind === "full")).toBe(true);
   });

   it("no hazard within GATE_CLEAR of a gate; gates run down the track in order; fast pairs from level 3", () => {
      for (const id of LEVEL_IDS) {
         const t = buildTrack(id);
         for (let i = 1; i < t.gates.length; i++) expect(t.gates[i].z).toBeLessThan(t.gates[i - 1].z);
         for (const o of t.obstacles) for (const g of t.gates) {
            const top = o.z;
            const bottom = o.kind === "gap" ? o.z - o.len : o.z;
            expect(Math.min(Math.abs(top - g.z), Math.abs(bottom - g.z)), `L${id}`).toBeGreaterThanOrEqual(GATE_CLEAR - 1e-9);
            if (o.kind === "gap") expect(g.z > top || g.z < bottom).toBe(true);
         }
      }
      const gaps = (id: 3 | 4) => buildTrack(id).gates.slice(1).map((g, i) => buildTrack(id).gates[i].z - g.z);
      expect(Math.min(...gaps(3))).toBeLessThan(10);
      expect(Math.min(...buildTrack(1).gates.slice(1).map((g, i) => buildTrack(1).gates[i].z - g.z))).toBeGreaterThan(20);
   });

   it("level 5 ends in Chroma's arena; the boss and secrets are well formed; sweepers stay on the deck", () => {
      expect(buildTrack(5).arenaZ).toBe(buildTrack(5).finishZ);
      for (const id of [1, 2, 3, 4] as const) expect(buildTrack(id).arenaZ).toBeNull();
      expect(bossProblems(CHROMA)).toEqual([]);
      for (const id of LEVEL_IDS) expect(secretProblems(SECRETS[id])).toEqual([]);
      const o = buildTrack(3).obstacles.find((q) => q.kind === "sweeper")!;
      for (let ms = 0; ms < 6000; ms += 37) expect(Math.abs(sweeperX(o, ms))).toBeLessThanOrEqual(2.6 + 1e-9);
   });
});

describe("landing room", () => {
   it("every gap is at least 2 m long and has 2.2 m of deck before the next hazard", () => {
      for (const id of [4, 5] as const) {
         const obs = buildTrack(id).obstacles.slice().sort((a, b) => b.z - a.z);
         for (let i = 0; i < obs.length; i++) {
            const o = obs[i];
            if (o.kind !== "gap") continue;
            expect(o.len).toBeGreaterThanOrEqual(2);
            const next = obs[i + 1];
            if (next) expect(o.z - o.len - next.z).toBeGreaterThanOrEqual(2.2 - 1e-9);
         }
      }
   });
});
