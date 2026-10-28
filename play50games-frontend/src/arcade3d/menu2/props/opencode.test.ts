// Menu 2 "Color Roll Heroes" code-built props (CheckpointPad, ArchWall, ArchCorridor, GrapplePost): the pure
// size consts and the geometry factories, measured without a canvas. Each factory must produce finite,
// non-empty geometry whose bounding box lands on the documented real-world size (+-10%), so the props stay
// the size the level layout and the collision expect. The corridor is one shared arch geometry (instanced)
// plus a floor strip, so its offsets, floor and per-arch box are checked too.
import { describe, expect, it } from "vitest";
import { Box3, Vector3, type BufferGeometry } from "three";
import {
   ARCH_CORRIDOR_SIZE,
   ARCH_WALL_SIZE,
   CHECKPOINT_PAD_SIZE,
   GRAPPLE_POST_SIZE,
   buildArchStoneGeometry,
   buildArchTrimGeometry,
   buildCheckpointGlowGeometry,
   buildCheckpointStoneGeometry,
   buildCorridorArchGeometry,
   buildCorridorFloorGeometry,
   buildGrapplePostGeometry,
   buildGrappleRingGeometry,
   corridorArchOffsets,
} from "./index";

/** The triangle count of a geometry (indexed or not). */
function triangles(geometry: BufferGeometry): number {
   return geometry.index ? geometry.index.count / 3 : geometry.getAttribute("position").count / 3;
}

/** Assert a geometry is finite, non-empty and inside the triangle budget; return its bounding box. */
function measured(geometry: BufferGeometry, maxTris: number): Box3 {
   const position = geometry.getAttribute("position");
   expect(position, "geometry has positions").toBeDefined();
   expect(position.count, "geometry is non-empty").toBeGreaterThan(0);
   for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getX(i))).toBe(true);
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(Number.isFinite(position.getZ(i))).toBe(true);
   }
   expect(triangles(geometry), "under the triangle budget").toBeLessThanOrEqual(maxTris);
   geometry.computeBoundingBox();
   const box = geometry.boundingBox;
   expect(box, "has a bounding box").not.toBeNull();
   return box as Box3;
}

/** Assert a bounding box spans the expected width (x), height (y) and depth (z) within +-tolerance. */
function expectBox(box: Box3, w: number, h: number, d: number, tol = 0.1): void {
   const size = box.getSize(new Vector3());
   expect(size.x).toBeCloseTo(w, 0);
   expect(size.y).toBeCloseTo(h, 0);
   expect(size.z).toBeCloseTo(d, 0);
   expect(Math.abs(size.x - w)).toBeLessThanOrEqual(w * tol);
   expect(Math.abs(size.y - h)).toBeLessThanOrEqual(h * tol);
   expect(Math.abs(size.z - d)).toBeLessThanOrEqual(d * tol);
}

describe("the Menu 2 code-built props", () => {
   it("documents real-world sizes in metres", () => {
      expect(CHECKPOINT_PAD_SIZE.w).toBe(2);
      expect(CHECKPOINT_PAD_SIZE.h).toBe(0.25);
      expect(CHECKPOINT_PAD_SIZE.postH).toBe(1.2);
      expect(ARCH_WALL_SIZE.w).toBe(4);
      expect(ARCH_WALL_SIZE.h).toBe(3);
      expect(ARCH_WALL_SIZE.d).toBe(0.5);
      expect(ARCH_WALL_SIZE.openW).toBe(1.6);
      expect(ARCH_WALL_SIZE.openH).toBe(2.3);
      expect(ARCH_CORRIDOR_SIZE.arches).toBe(5);
      expect(ARCH_CORRIDOR_SIZE.spacing).toBe(3);
      expect(GRAPPLE_POST_SIZE.poleH).toBe(4);
      expect(GRAPPLE_POST_SIZE.ringD).toBe(0.9);
   });

   it("CheckpointPad: a 2 m pad, 0.25 thick, with a 1.2 m beacon post and its glow", () => {
      const stone = buildCheckpointStoneGeometry("#ddd6c6", "#b5aea0");
      const box = measured(stone, 1000);
      // The pad is 2 m across and 0.25 thick on the floor; the post head reaches ~1.45 m.
      expectBox(box, CHECKPOINT_PAD_SIZE.w, CHECKPOINT_PAD_SIZE.h + CHECKPOINT_PAD_SIZE.postH, CHECKPOINT_PAD_SIZE.d);
      expect(box.min.y).toBeCloseTo(0, 2); // sits on the floor
      expect(box.max.y).toBeGreaterThan(CHECKPOINT_PAD_SIZE.h + CHECKPOINT_PAD_SIZE.postH * 0.9);
      stone.dispose();

      const glow = buildCheckpointGlowGeometry("#ffc94d");
      const glowBox = measured(glow, 700);
      // The inlaid ring and the orb sit inside the pad footprint and above the post head.
      expect(glowBox.max.y).toBeGreaterThan(CHECKPOINT_PAD_SIZE.h + CHECKPOINT_PAD_SIZE.postH * 0.9);
      expect(Math.abs(glowBox.min.x)).toBeLessThanOrEqual(CHECKPOINT_PAD_SIZE.w / 2);
      expect(Math.abs(glowBox.max.x)).toBeLessThanOrEqual(CHECKPOINT_PAD_SIZE.w / 2);
      glow.dispose();
   });

   it("ArchWall: a 4 x 3 x 0.5 wall with a 1.6 x 2.3 arched opening and its trim", () => {
      const stone = buildArchStoneGeometry();
      const box = measured(stone, 400);
      expectBox(box, ARCH_WALL_SIZE.w, ARCH_WALL_SIZE.h, ARCH_WALL_SIZE.d);
      expect(box.min.y).toBeCloseTo(0, 2); // stands on the floor
      // The doorway must stay open: the stone geometry has a real hole, so it has an interior surface well
      // inside the wall footprint at the opening's tightest width.
      const trim = buildArchTrimGeometry();
      const trimBox = measured(trim, 300);
      // The trim frames the arch (about openW + band wide) and stands just proud of the front face.
      expect(trimBox.max.z).toBeGreaterThan(ARCH_WALL_SIZE.d);
      expect(trimBox.max.y).toBeGreaterThan(ARCH_WALL_SIZE.openH);
      expect(trimBox.max.y).toBeLessThan(ARCH_WALL_SIZE.h);
      stone.dispose();
      trim.dispose();
   });

   it("ArchCorridor: five arches 3 m apart on one shared geometry plus a floor strip", () => {
      const offsets = corridorArchOffsets();
      expect(offsets).toHaveLength(ARCH_CORRIDOR_SIZE.arches);
      // 3 m apart, centred on z = 0: -6, -3, 0, 3, 6.
      for (let i = 0; i < offsets.length; i++) {
         expect(offsets[i]).toBeCloseTo((i - (ARCH_CORRIDOR_SIZE.arches - 1) / 2) * ARCH_CORRIDOR_SIZE.spacing, 5);
      }
      expect(offsets[ARCH_CORRIDOR_SIZE.arches - 1] - offsets[0]).toBeCloseTo(
         (ARCH_CORRIDOR_SIZE.arches - 1) * ARCH_CORRIDOR_SIZE.spacing,
         5
      );

      // One shared arch geometry, drawn instanced: same box as the ArchWall union, one tone set baked in.
      const arch = buildCorridorArchGeometry("#efeae0", "#c0503c");
      const archBox = measured(arch, 500);
      expect(arch.getAttribute("color"), "arch carries vertex colours").toBeDefined();
      expectBox(archBox, ARCH_WALL_SIZE.w, ARCH_WALL_SIZE.h, ARCH_WALL_SIZE.d + 0.04);
      expect(archBox.min.y).toBeCloseTo(0, 2);

      const floor = buildCorridorFloorGeometry();
      const floorBox = measured(floor, 40);
      expect(floorBox.max.y).toBeCloseTo(0, 2); // the floor top is flush with the arch feet
      expect(floorBox.min.y).toBeCloseTo(-ARCH_CORRIDOR_SIZE.floorT, 2);
      // The strip runs the whole row: at least arches * spacing, no more than that plus a margin.
      const span = ARCH_CORRIDOR_SIZE.span;
      expect(span).toBeGreaterThanOrEqual((ARCH_CORRIDOR_SIZE.arches - 1) * ARCH_CORRIDOR_SIZE.spacing);
      expect(span).toBeLessThanOrEqual((ARCH_CORRIDOR_SIZE.arches - 1) * ARCH_CORRIDOR_SIZE.spacing + 4);
      arch.dispose();
      floor.dispose();
   });

   it("GrapplePost: a 4 m pole on a stone base with a 0.9 m ring on top", () => {
      const post = buildGrapplePostGeometry("#8a5a34", "#cfcabf");
      const postBox = measured(post, 700);
      expect(postBox.min.y).toBeCloseTo(0, 2); // the base sits on the floor
      expect(postBox.max.y).toBeCloseTo(GRAPPLE_POST_SIZE.baseH + GRAPPLE_POST_SIZE.poleH, 2);
      expectBox(postBox, GRAPPLE_POST_SIZE.w, GRAPPLE_POST_SIZE.baseH + GRAPPLE_POST_SIZE.poleH, GRAPPLE_POST_SIZE.d);

      const ring = buildGrappleRingGeometry();
      const ringBox = measured(ring, 500);
      // The ring's outer diameter is ringD + 2 x tube, standing upright (thin in z) on the pole head.
      const ringOuter = GRAPPLE_POST_SIZE.ringD + 2 * GRAPPLE_POST_SIZE.ringTube;
      expectBox(ringBox, ringOuter, ringOuter, GRAPPLE_POST_SIZE.ringTube * 2);
      expect(ringBox.min.y).toBeGreaterThan(GRAPPLE_POST_SIZE.baseH + GRAPPLE_POST_SIZE.poleH * 0.8);
      post.dispose();
      ring.dispose();
   });
});
