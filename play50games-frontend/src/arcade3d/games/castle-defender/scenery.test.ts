import { expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { DECOR, FIELD } from "./looks";
import { sceneryFor } from "./scenery";

it("keeps Outer Wall's original scenery and gives every later level its own layout", () => {
   expect(sceneryFor(1).decor).toBe(DECOR);
   expect(sceneryFor(1).props).toEqual([]);
   expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(sceneryFor(id).decor))).size).toBe(5);
   expect(new Set(LEVEL_IDS.map((id) => JSON.stringify(sceneryFor(id).props))).size).toBe(5);
});

for (const id of LEVEL_IDS) it(`level ${id}: scenery footprints clear the entire play area`, () => {
   const scene = sceneryFor(id);
   for (const p of scene.props) {
      expect(p.x + p.radius < FIELD.x0 || p.x - p.radius > FIELD.x1 || p.z + p.radius < FIELD.z0 || p.z - p.radius > FIELD.z1).toBe(true);
   }
   for (const p of scene.decor.filter((p) => p.kind !== "cloud")) {
      const radius = Math.max(p.sx, p.sz) * (p.kind === "pine" ? 0.95 : p.kind === "round" ? 0.88 : p.kind === "rock" ? 0.42 : 0.22);
      expect(p.x + radius < FIELD.x0 || p.x - radius > FIELD.x1 || p.z + radius < FIELD.z0 || p.z - radius > FIELD.z1).toBe(true);
   }
});
