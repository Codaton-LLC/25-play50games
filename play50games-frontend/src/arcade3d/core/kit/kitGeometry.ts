// The pure geometry behind core/kit (no React, no WebGL; three only for the spot type): the belt
// strip of a <Conveyor>, the posts and rails of a <Fence> and the light fan of a <Flashlight>.
// Tested in kit.test.ts.
import type { InstanceSpot } from "../render/useInstanceMatrices";
import { pointAt, tangentAt, type Path } from "../path";

/** Belt strip arrays: two vertices per sample (left, right edge), `v` = arc length / tile. */
export interface BeltData {
   positions: Float32Array;
   uvs: Float32Array;
   normals: Float32Array;
   index: number[];
   /** samples along the path */
   samples: number;
}

/**
 * A flat strip `width` wide along `path` (centred on it, its top at the path's y + `lift`), sampled
 * every `step` m (and at the end). u runs across (0 = left of the travel direction, 1 = right),
 * v = arc length / `tile`: a texture that repeats every `tile` m along the belt and scrolls by
 * speed / tile per second moves exactly with riders advanced by speed (path.ts advance).
 */
export function beltData(path: Path, width: number, step = 0.25, tile = 1, lift = 0): BeltData {
   const total = path.total;
   const samples = Math.max(2, Math.ceil(total / Math.max(1e-3, step)) + 1);
   const positions = new Float32Array(samples * 2 * 3);
   const uvs = new Float32Array(samples * 2 * 2);
   const normals = new Float32Array(samples * 2 * 3);
   const p = { x: 0, y: 0, z: 0 };
   const t = { x: 0, y: 0, z: 0 };
   const half = width / 2;
   for (let i = 0; i < samples; i++) {
      // a closed path's last sample is its start again (pointAt wraps), with v continuing past it
      const s = (i / (samples - 1)) * total;
      pointAt(path, s, p);
      tangentAt(path, path.closed ? s : Math.min(s, Math.max(0, total - 1e-6)), t);
      // left of the travel direction in the ground plane: up x tangent
      let lx = t.z;
      let lz = -t.x;
      const len = Math.hypot(lx, lz) || 1;
      lx /= len;
      lz /= len;
      const o = i * 6;
      positions[o] = p.x + lx * half;
      positions[o + 1] = p.y + lift;
      positions[o + 2] = p.z + lz * half;
      positions[o + 3] = p.x - lx * half;
      positions[o + 4] = p.y + lift;
      positions[o + 5] = p.z - lz * half;
      normals[o + 1] = 1;
      normals[o + 4] = 1;
      const u = i * 4;
      uvs[u] = 0;
      uvs[u + 1] = s / tile;
      uvs[u + 2] = 1;
      uvs[u + 3] = s / tile;
   }
   const index: number[] = [];
   for (let i = 0; i < samples - 1; i++) {
      const a = i * 2;
      // counter-clockwise seen from above (+y)
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
   }
   return { positions, uvs, normals, index, samples };
}

/** Posts and rails of a fence, as instance spots of a unit box (1 x 1 x 1, centred). */
export interface FenceSpots {
   posts: InstanceSpot[];
   rails: InstanceSpot[];
}

export interface FenceOptions {
   /** m between posts (default 2); the path's ends always get a post */
   spacing?: number;
   /** post height (default 1) */
   height?: number;
   /** rails per span (default 2), spread between 0.3 and 0.85 of the height */
   rails?: number;
   /** post width (default 0.12) and rail thickness (default 0.06) */
   postSize?: number;
   railSize?: number;
}

/**
 * Fence posts along `path` every `spacing` m (a closed path closes the ring) and the rails between
 * them, standing on the path's y. Rails run straight between neighbouring posts (a smooth path
 * gets short straight spans). Turned with rotY so a unit box's z axis runs along the span.
 */
export function fenceSpots(path: Path, options: FenceOptions = {}): FenceSpots {
   const spacing = Math.max(0.1, options.spacing ?? 2);
   const height = options.height ?? 1;
   const railCount = Math.max(0, Math.floor(options.rails ?? 2));
   const post = options.postSize ?? 0.12;
   const rail = options.railSize ?? 0.06;
   const total = path.total;
   const spans = Math.max(1, Math.round(total / spacing));
   const count = path.closed ? spans : spans + 1;
   const at: Array<{ x: number; y: number; z: number }> = [];
   for (let i = 0; i < count; i++) at.push(pointAt(path, (i / spans) * total));
   const posts: InstanceSpot[] = at.map((p) => ({ x: p.x, y: p.y + height / 2, z: p.z, sx: post, sy: height, sz: post }));
   const rails: InstanceSpot[] = [];
   const links = path.closed ? count : count - 1;
   for (let i = 0; i < links; i++) {
      const a = at[i];
      const b = at[(i + 1) % count];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;
      const rotY = Math.atan2(dx, dz);
      const baseY = (a.y + b.y) / 2;
      for (let r = 0; r < railCount; r++) {
         const k = railCount === 1 ? 0.7 : 0.3 + (0.55 * r) / (railCount - 1);
         rails.push({ x: (a.x + b.x) / 2, y: baseY + height * k, z: (a.z + b.z) / 2, rotY, sx: rail, sy: rail, sz: length });
      }
   }
   return { posts, rails };
}

/**
 * The light fan of a flashlight in its own frame (it faces +z at yaw 0, as ai/vision inViewCone):
 * the apex at (0, height, 0) and `segments` + 1 points on the floor arc at distance `range`, from
 * -halfAngle to +halfAngle (positive = towards +x). A point on the floor is lit exactly when
 * inViewCone(origin, yaw, halfAngle, range, point) is true (up to the arc's chords).
 * Returns xyz triples: the apex first, then the arc (y = 0).
 */
export function fanPoints(halfAngle: number, range: number, height: number, segments = 24): Float32Array {
   const n = Math.max(1, Math.floor(segments));
   const out = new Float32Array((n + 2) * 3);
   out[1] = height;
   for (let i = 0; i <= n; i++) {
      const a = -halfAngle + (2 * halfAngle * i) / n;
      out[(i + 1) * 3] = Math.sin(a) * range;
      out[(i + 1) * 3 + 2] = Math.cos(a) * range;
   }
   return out;
}

/** Segments for a fan: about one per 6 degrees, 4..48. */
export function fanSegments(halfAngle: number): number {
   return Math.max(4, Math.min(48, Math.ceil((2 * halfAngle) / (Math.PI / 30))));
}
