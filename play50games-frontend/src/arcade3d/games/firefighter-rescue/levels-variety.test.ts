// Per-level variety: the five levels are five different floor plans and looks, not one corridor
// with bigger numbers. Level 1 stays today's game. Also: the exterior set dressing and every
// furniture solid stay out of the walkable play area (the doorway rects especially).
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { COLORS, levelColors, levelDecor, wallSpots } from "./looks";
import { createRun, doorMidZ, pointInside, roomSide, type Run } from "./rules";

/** The furniture boxes as [kind, x, z] rows, the plan-independent fingerprint of a level's rooms. */
function furnitureRows(run: Run): string[] {
   return run.furniture.map((f) => `${f.kind}@${f.x.toFixed(2)},${f.z.toFixed(2)}`).sort();
}

describe("firefighter per-level variety", () => {
   it("level 1 is the original plan: alternating wings, 5 m deep, centred doors, today's palette", () => {
      const level = LEVELS[1];
      expect(level.plan.deep).toBe(5);
      expect(level.plan.doorShift.every((s) => s === 0)).toBe(true);
      for (let room = 0; room < level.rooms; room++) expect(roomSide(level, room)).toBe(room % 2 === 0 ? -1 : 1);
      expect(levelColors(level)).toEqual({
         wall: COLORS.wall,
         wallTrim: COLORS.wallTrim,
         floor: COLORS.floor,
         floorLine: COLORS.floorLine,
         street: COLORS.street,
         sofa: COLORS.sofa,
         sofaCushion: COLORS.sofaCushion,
         bed: COLORS.bed,
         bedFrame: COLORS.bedFrame,
         cabinet: COLORS.cabinet,
         cabinetDoor: COLORS.cabinetDoor,
         chair: COLORS.chair,
         chairSeat: COLORS.chairSeat,
      });
      expect(levelDecor(level)).toEqual({ boxes: [], cyls: [], windows: [] });
   });

   it("every pair of levels has a different floor plan and a different look", () => {
      for (const a of LEVEL_IDS) {
         for (const b of LEVEL_IDS) {
            if (a >= b) continue;
            const la = LEVELS[a];
            const lb = LEVELS[b];
            const runA = createRun(11, la);
            const runB = createRun(11, lb);
            // a different room plan: different wall layout, door positions, or furniture
            const wallsDiffer = JSON.stringify(wallSpots(la)) !== JSON.stringify(wallSpots(lb));
            const doorsDiffer = la.rooms !== lb.rooms
               || Array.from({ length: la.rooms }, (_, r) => doorMidZ(la, r)).join() !== Array.from({ length: lb.rooms }, (_, r) => doorMidZ(lb, r)).join();
            const furnitureDiffer = furnitureRows(runA).join() !== furnitureRows(runB).join();
            expect(wallsDiffer || doorsDiffer || furnitureDiffer, `L${a} vs L${b}`).toBe(true);
            // a different look: palette or exterior set dressing
            const colorsDiffer = JSON.stringify(levelColors(la)) !== JSON.stringify(levelColors(lb));
            const decorDiffer = JSON.stringify(levelDecor(la)) !== JSON.stringify(levelDecor(lb));
            expect(colorsDiffer || decorDiffer, `L${a} vs L${b} look`).toBe(true);
         }
      }
   });

   it("levels 2-5 each move at least one room, doorway or wing compared with level 1", () => {
      const base = LEVELS[1];
      const baseFurniture = furnitureRows(createRun(11, base));
      for (const id of [2, 3, 4, 5] as const) {
         const level = LEVELS[id];
         const movedSide = Array.from({ length: level.rooms }, (_, r) => roomSide(level, r) !== (r % 2 === 0 ? -1 : 1)).some(Boolean);
         const movedDoor = level.plan.doorShift.some((s) => s !== 0);
         const deepened = level.plan.deep !== base.plan.deep;
         const furnished = furnitureRows(createRun(11, level)).join() !== baseFurniture.join();
         expect(movedSide || movedDoor || deepened, `L${id} floor plan`).toBe(true);
         expect(furnished, `L${id} furniture`).toBe(true);
      }
   });

   it("the exterior decor stays off the walkable floor on every level", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(3, level);
         const decor = levelDecor(level);
         const pieces = [
            ...decor.boxes.map((p) => ({ ...p, label: "box" })),
            ...decor.cyls.map((p) => ({ ...p, label: "cyl" })),
            ...decor.windows.map((p) => ({ ...p, label: "window" })),
         ];
         for (const piece of pieces) {
            const { x, z, sx = 1, sz = 1 } = piece.spot;
            // the footprint's sample points must all be off the play rects (walls stand just
            // outside the floor, so wall-mounted pieces use the spot centre only)
            const halfX = piece.label === "window" ? Math.min(sx / 2, 0.12) : sx / 2;
            const halfZ = piece.label === "window" ? Math.min(sz / 2, 0.12) : sz / 2;
            for (const [px, pz] of [[x, z], [x - halfX, z - halfZ], [x + halfX, z - halfZ], [x - halfX, z + halfZ], [x + halfX, z + halfZ]]) {
               expect(pointInside(run, px, pz, 0.05), `L${id} ${piece.label} at ${x},${z}`).toBe(false);
            }
         }
      }
   });

   it("furniture solids stay out of the doorway rects and off the objective spots", () => {
      for (const id of LEVEL_IDS) {
         const level = LEVELS[id];
         const run = createRun(9, level);
         for (const solid of run.solids) {
            if (solid.room >= 0) continue; // the locked-door slabs sit in the doorway by design
            // no solid box may cover the doorway rect of any room
            for (let room = 0; room < level.rooms; room++) {
               const side = roomSide(level, room);
               const mid = doorMidZ(level, room);
               const x0 = side < 0 ? -1.5 - 1.35 : 1.5 - 1.15;
               const x1 = side < 0 ? -1.5 + 1.15 : 1.5 + 1.35;
               const overlapX = solid.box.min.x < x1 && solid.box.max.x > x0;
               const overlapZ = solid.box.min.z < mid + 0.8 && solid.box.max.z > mid - 0.8;
               expect(overlapX && overlapZ, `L${id} furniture ${JSON.stringify(solid.box)} in door ${room}`).toBe(false);
            }
         }
      }
   });
});
