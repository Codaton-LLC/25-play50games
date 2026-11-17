// The cutaway: from either fitted yaw, no wall (or door leaf) stands between the camera and the
// firefighter's chest, a fire or a neighbour, on any level.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { DOOR_LINE_X, LOW_WALL_H, PITCH, WALL_H, YAWS, cutawayWalls, doorWallHeight, openDoorHeight, wallSpots } from "./looks";
import { DOOR_HALF, HALL_HALF, PORCH_Z, ROOM_LEN, createRun, doorMidZ, roomSide } from "./rules";

/** Is the point (x, y, z) seen from far away along the camera's direction at `yaw` and PITCH, past every wall? */
function seen(walls: ReturnType<typeof wallSpots>, yaw: number, x: number, y: number, z: number): boolean {
   const dx = Math.sin(yaw);
   const dz = Math.cos(yaw);
   const rise = Math.tan(PITCH);
   for (let d = 0.05; d < 12; d += 0.05) {
      const px = x + dx * d;
      const pz = z + dz * d;
      const py = y + rise * d;
      for (const w of walls) {
         const hx = (w.sx ?? 1) / 2;
         const hz = (w.sz ?? 1) / 2;
         const top = w.y + (w.sy ?? 1) / 2;
         if (Math.abs(px - w.x) <= hx && Math.abs(pz - w.z) <= hz && py < top) return false;
      }
   }
   return true;
}

describe("firefighter-rescue cutaway walls", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: from both yaws the hall, every fire and every neighbour stay in sight over the walls`, () => {
         const level = LEVELS[id];
         const run = createRun(7, level);
         for (const yaw of YAWS) {
            const walls = cutawayWalls(level, yaw);
            // the walls are either full or cut down
            for (const w of walls) expect([WALL_H, LOW_WALL_H]).toContain(w.sy);
            // fires (their flame top) and neighbours (their chest)
            for (const f of run.fires) expect(seen(walls, yaw, f.x, 0.55, f.z), `fire ${f.x},${f.z} yaw ${yaw}`).toBe(true);
            for (const c of run.civilians) expect(seen(walls, yaw, c.x, 1.1, c.z), `civ ${c.x},${c.z} yaw ${yaw}`).toBe(true);
            // the firefighter's chest anywhere along the hall, 0.4 m from either wall (the samples miss the
            // room ends' centre lines: an end wall seen edge-on, 0.18 m wide, hides a sliver, not the body)
            for (let z = PORCH_Z + 0.55; z < level.rooms * ROOM_LEN - 0.4; z += 0.5) {
               for (const x of [-HALL_HALF + 0.4, 0, HALL_HALF - 0.4]) expect(seen(walls, yaw, x, 1.2, z), `hall ${x},${z} yaw ${yaw}`).toBe(true);
            }
            // a door is as tall as the hall wall either side of it (cut down with it)
            for (let room = 0; room < level.rooms; room++) {
               const x = roomSide(level, room) * DOOR_LINE_X;
               const beside = walls.find((w) => Math.abs(w.x - x) < 1e-6 && Math.abs(w.z + (w.sz ?? 0) / 2 - (doorMidZ(level, room) - DOOR_HALF)) < 1e-6);
               expect(beside, `room ${room}`).toBeDefined();
               expect(doorWallHeight(level, yaw, room)).toBe(beside!.sy);
               // swung open (lying along x), a leaf is low where the camera looks across it into the room
               expect(openDoorHeight(level, yaw, room)).toBe(Math.abs(Math.cos(yaw)) > 0.5 ? LOW_WALL_H : WALL_H);
            }
         }
      });
   }

   it("walls with only the street behind them stay full height (the building keeps its outline)", () => {
      const level = LEVELS[5];
      for (const yaw of YAWS) expect(cutawayWalls(level, yaw).some((w) => w.sy === WALL_H)).toBe(true);
   });
});
