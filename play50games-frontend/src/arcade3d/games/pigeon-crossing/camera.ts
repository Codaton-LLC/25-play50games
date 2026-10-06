// Street-specific projection checks; the shared core owns fitting and camera motion.
import { BoxGeometry, Matrix4, Mesh, PerspectiveCamera, Plane, Ray, SphereGeometry, Vector3, type Object3D } from "three";
import type { FitViewOptions, FittedView } from "@/arcade3d/core/view";
import { setLensShift } from "@/arcade3d/core/view";
import { ASSETS } from "./assets";
import { COVER_INNER_X, LANE_SLOTS, PIGEON, ROW_PITCH } from "./rules";

export const FOV = 45;
export const PITCH = 55 * Math.PI / 180;
export const FOLLOW_DAMPING = 12;
export const FOLLOW_LAG = 0.3;
export const COVER_HEIGHT = 1.8;
export const MIN_PIGEON_PX = 24;
export const LOOK_AT: [number, number, number] = [0, 0, -3.6];
export const STREET_VIEW: Omit<FitViewOptions, "width" | "height" | "fov"> = {
   area: { min: { x: -5.6, y: 0, z: -11.1 }, max: { x: 5.6, y: 1.8, z: 3.9 } },
   pitch: PITCH, yaws: [0], focus: [{ x: 0, y: 0, z: -3.6 }],
   margin: { top: 0.11, bottom: 0.09, left: 0.02, right: 0.02 }, padding: 8, shift: true,
};

/** The exact vertices drawn by PigeonPrimitive; positions and radii already include y * 1.25. */
export const PIGEON_SHAPES = [
   { name: "torso", shape: "sphere", position: [0, 0.50, 0.04], size: [0.23, 0.375, 0.20], color: "#8192a9" },
   { name: "head", shape: "sphere", position: [0, 1.025, -0.02], size: [0.22, 0.225, 0.18], color: "#99a9bb" },
   { name: "neck", shape: "sphere", position: [0, 0.80, -0.015], size: [0.16, 0.14, 0.15], color: "#5eb5a8" },
   { name: "wing-l", shape: "sphere", position: [-0.23, 0.50, 0.04], size: [0.05, 0.275, 0.17], color: "#637b94" },
   { name: "wing-r", shape: "sphere", position: [0.23, 0.50, 0.04], size: [0.05, 0.275, 0.17], color: "#637b94" },
   { name: "foot-l", shape: "box", position: [-0.14, 0.05625, 0.13], size: [0.11, 0.1125, 0.22], color: "#ffad45" },
   { name: "foot-r", shape: "box", position: [0.14, 0.05625, 0.13], size: [0.11, 0.1125, 0.22], color: "#ffad45" },
   { name: "beak", shape: "box", position: [0, 0.9625, -0.25], size: [0.12, 0.10, 0.10], color: "#ffc96e" },
   { name: "eye-l", shape: "sphere", position: [-0.205, 1.063, -0.045], size: [0.033, 0.039, 0.043], color: "#fff7e9" },
   { name: "eye-r", shape: "sphere", position: [0.205, 1.063, -0.045], size: [0.033, 0.039, 0.043], color: "#fff7e9" },
   { name: "pupil-l", shape: "sphere", position: [-0.231, 1.063, -0.055], size: [0.011, 0.019, 0.020], color: "#253346" },
   { name: "pupil-r", shape: "sphere", position: [0.231, 1.063, -0.055], size: [0.011, 0.019, 0.020], color: "#253346" },
] as const;

export interface Envelope { valid: boolean; minX: number; maxX: number; minZ: number; maxZ: number }
export interface Horizon { first: number; last: number; coverX: number; coverMinZ: number; coverMaxZ: number }
export type GateReason = "rays" | "pool" | "size" | null;
export interface ProjectionScratch { ray: Ray; plane: Plane; point: Vector3; direction: Vector3 }

export function createEnvelope(): Envelope {
   return { valid: false, minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
}

export function createHorizon(): Horizon {
   return { first: 0, last: 0, coverX: COVER_INNER_X, coverMinZ: 0, coverMaxZ: 0 };
}

export function createProjectionScratch(): ProjectionScratch {
   return { ray: new Ray(), plane: new Plane(new Vector3(0, 1, 0), 0), point: new Vector3(), direction: new Vector3() };
}

/** Eight full-canvas intersections, including ground behind the translucent HUD. No allocations. */
export function measureEnvelope(camera: PerspectiveCamera, scratch: ProjectionScratch, out: Envelope, referenceZ: number): Envelope {
   camera.updateMatrixWorld();
   out.valid = true;
   out.minX = out.minZ = Infinity;
   out.maxX = out.maxZ = -Infinity;
   for (let x = -1; x <= 1; x += 2) for (let y = -1; y <= 1; y += 2) {
      scratch.ray.origin.copy(camera.position);
      scratch.ray.direction.copy(scratch.direction.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize());
      for (let plane = 0; plane < 2; plane++) {
         scratch.plane.constant = plane === 0 ? 0 : -COVER_HEIGHT;
         if (!scratch.ray.intersectPlane(scratch.plane, scratch.point)) { out.valid = false; return out; }
         const px = scratch.point.x, pz = scratch.point.z - referenceZ;
         if (!Number.isFinite(px) || !Number.isFinite(pz) || scratch.point.distanceToSquared(camera.position) === 0) { out.valid = false; return out; }
         out.minX = Math.min(out.minX, px); out.maxX = Math.max(out.maxX, px);
         out.minZ = Math.min(out.minZ, pz); out.maxZ = Math.max(out.maxZ, pz);
      }
   }
   return out;
}

/** Worst inclusive count over any fractional scrolling position (lag translates the whole view). */
export function maximumRows(envelope: Envelope): number {
   return Math.ceil((envelope.maxZ - envelope.minZ + ROW_PITCH) / ROW_PITCH) + 4;
}

export function guardedRows(envelope: Envelope, translationZ: number, out: Horizon): Horizon {
   const minZ = envelope.minZ + translationZ, maxZ = envelope.maxZ + translationZ;
   out.first = Math.max(0, Math.floor(-(maxZ + ROW_PITCH / 2) / ROW_PITCH) - 1);
   out.last = Math.max(out.first, Math.ceil(-(minZ - ROW_PITCH / 2) / ROW_PITCH) + 1);
   out.coverX = Math.ceil((Math.max(COVER_INNER_X, Math.abs(envelope.minX), Math.abs(envelope.maxX)) + 1.9 + 0.4) * 1000) / 1000;
   out.coverMinZ = Math.min(minZ - ROW_PITCH / 2, -(out.last + 0.5) * ROW_PITCH);
   out.coverMaxZ = Math.max(maxZ + ROW_PITCH / 2, -(out.first - 0.5) * ROW_PITCH);
   return out;
}

/** Mount-only geometry measurement, using the same tessellation/parts as the drawn primitive. */
export function fallbackVertices(): number[] {
   const vertices: number[] = [];
   for (const part of PIGEON_SHAPES) {
      const geometry = part.shape === "sphere" ? new SphereGeometry(1, 32, 24).scale(part.size[0], part.size[1], part.size[2]) : new BoxGeometry(part.size[0], part.size[1], part.size[2]);
      geometry.translate(part.position[0], part.position[1], part.position[2]);
      const p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) vertices.push(p.getX(i), p.getY(i), p.getZ(i));
      geometry.dispose();
   }
   return vertices;
}

/** Actual GLB vertices, normalized exactly as <Model> does. Never called in a frame callback. */
export function modelVertices(source: Object3D): number[] {
   const vertices: number[] = [], p = new Vector3(), transform = new Matrix4();
   const asset = ASSETS.pigeon;
   const assetMatrix = new Matrix4().makeRotationY(asset.rotationY).scale(new Vector3(asset.scale * asset.stretch[0], asset.scale, asset.scale));
   source.updateMatrixWorld(true);
   source.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const positions = node.geometry.getAttribute("position");
      if (!positions) return;
      transform.multiplyMatrices(assetMatrix, node.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
         p.fromBufferAttribute(positions, i).applyMatrix4(transform);
         vertices.push(p.x, p.y, p.z);
      }
   });
   return vertices;
}

/** At our fixed yaw only the (y,z) outline affects screen height. Extract it once per model. */
export function pigeonHull(vertices: ArrayLike<number>): Float64Array {
   const points: Array<[number, number]> = [];
   for (let i = 0; i < vertices.length; i += 3) points.push([vertices[i + 1], vertices[i + 2]]);
   points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
   const hull: Array<[number, number]> = [];
   for (let pass = 0; pass < 2; pass++) {
      const start = hull.length;
      for (let k = 0; k < points.length; k++) {
         const p = points[pass === 0 ? k : points.length - 1 - k];
         while (hull.length >= start + 2) {
            const a = hull[hull.length - 2], b = hull[hull.length - 1];
            if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) > 0) break;
            hull.pop();
         }
         hull.push(p);
      }
      hull.pop();
   }
   const packed = new Float64Array(hull.length * 2);
   for (let i = 0; i < hull.length; i++) { packed[2 * i] = hull[i][0]; packed[2 * i + 1] = hull[i][1]; }
   return packed;
}

export function projectedHeight(camera: PerspectiveCamera, hull: Float64Array, height: number, sy: number, lift: number, z: number, point: Vector3): number {
   let min = Infinity, max = -Infinity;
   for (let i = 0; i < hull.length; i += 2) {
      point.set(0, hull[i] * sy + lift, hull[i + 1] + z).project(camera);
      min = Math.min(min, point.y); max = Math.max(max, point.y);
   }
   return (max - min) * height / 2;
}

/** Shared by the silhouette gate and the drawn rigid bird. Timers are supplied, never read here. */
export interface PigeonPose { sx: number; sy: number; bob: number; tuck: number; drop: number; lift: number; shadow: number }

export function createPigeonPose(): PigeonPose {
   return { sx: 1, sy: 1, bob: 0, tuck: 0, drop: 0, lift: 0, shadow: 1 };
}

export function writePigeonPose(hopPhase: number, landingAgeMs: number, crashAgeMs: number, out: PigeonPose): void {
   const air = hopPhase >= 0 ? Math.sin(Math.PI * hopPhase) : 0;
   const crashed = crashAgeMs >= 0;
   out.drop = crashed ? Math.min(1, crashAgeMs / 250) : 0;
   out.sy = crashed ? 1 - 0.7 * out.drop : hopPhase >= 0 ? 0.95 + 0.05 * air : 1 - 0.05 * Math.max(0, 1 - landingAgeMs / 80);
   out.sx = crashed ? 1 : 1 + 0.03 * (1 - out.sy) / 0.05;
   out.bob = crashed || hopPhase < 0 ? 0 : 0.006 * Math.sin(2 * Math.PI * hopPhase);
   out.tuck = crashed ? 0 : -0.015 * air;
   out.lift = PIGEON.hopHeight * air * (1 - out.drop) + out.bob;
   out.shadow = 1 - 0.2 * air * (1 - out.drop);
}

export function placePigeon(player: { x: number; y: number; z: number }, pose: PigeonPose, root: Object3D, body: Object3D, shadow: Object3D): void {
   root.position.set(player.x, player.y * (1 - pose.drop), player.z);
   body.position.set(0, pose.bob, pose.tuck);
   body.scale.set(pose.sx, pose.sy, 1);
   shadow.position.set(player.x, 0, player.z);
   shadow.scale.set(pose.shadow, 1, pose.shadow);
}

export function minimumPigeonHeight(camera: PerspectiveCamera, hull: Float64Array, height: number, point: Vector3): number {
   let minimum = Infinity;
   const pose = createPigeonPose();
   for (let sample = 0; sample <= 100; sample++) {
      writePigeonPose(sample / 100, 0, -1, pose);
      for (let lag = -1; lag <= 1; lag++) {
         minimum = Math.min(minimum, projectedHeight(camera, hull, height, pose.sy, pose.lift, lag * FOLLOW_LAG + pose.tuck, point));
      }
   }
   // Continuous-pose margin; the test compares with 1001 full-mesh poses to <0.01 px.
   return minimum - 0.05;
}

export function viewGate(camera: PerspectiveCamera, envelope: Envelope, hull: Float64Array, height: number, coarse: boolean, point: Vector3): { reason: GateReason; rows: number; pigeonPx: number } {
   const rows = envelope.valid ? maximumRows(envelope) : Infinity;
   const pigeonPx = envelope.valid ? minimumPigeonHeight(camera, hull, height, point) : 0;
   return { reason: !envelope.valid ? "rays" : rows > LANE_SLOTS ? "pool" : !coarse && pigeonPx < MIN_PIGEON_PX ? "size" : null, rows, pigeonPx };
}

export interface StreetCache {
   targetCamera: PerspectiveCamera;
   scratch: ProjectionScratch;
   target: Envelope;
   previous: Envelope;
   actual: Envelope;
   union: Envelope;
   projection: Float64Array;
   sampled: boolean;
   sampleY: number;
   sampleQx: number;
   sampleQy: number;
   sampleQz: number;
   sampleQw: number;
   initialized: boolean;
   transition: boolean;
}

export function createStreetCache(): StreetCache {
   return {
      targetCamera: new PerspectiveCamera(FOV, 1, 0.1, 400), scratch: createProjectionScratch(),
      target: createEnvelope(), previous: createEnvelope(), actual: createEnvelope(), union: createEnvelope(),
      projection: new Float64Array(16), sampled: false, sampleY: 0, sampleQx: 0, sampleQy: 0, sampleQz: 0, sampleQw: 1,
      initialized: false, transition: false,
   };
}

function copyEnvelope(out: Envelope, source: Envelope): void {
   out.valid = source.valid; out.minX = source.minX; out.maxX = source.maxX; out.minZ = source.minZ; out.maxZ = source.maxZ;
}

/** Refit only, not a frame callback. Retain old cover until the core rig reaches its target. */
export function configureStreetView(cache: StreetCache, view: FittedView, width: number, height: number): void {
   const cam = cache.targetCamera;
   if (cache.initialized && cam.aspect === width / height && cam.position.x === view.offset[0] &&
      cam.position.y === view.offset[1] && cam.position.z === view.offset[2] + LOOK_AT[2] &&
      Math.abs(cam.projectionMatrix.elements[8] + view.shift[0]) < 1e-12 &&
      Math.abs(cam.projectionMatrix.elements[9] + view.shift[1]) < 1e-12) return;
   if (cache.initialized) copyEnvelope(cache.previous, cache.target);
   cam.aspect = width / height;
   cam.position.set(view.offset[0], view.offset[1], view.offset[2] + LOOK_AT[2]);
   cam.lookAt(...LOOK_AT);
   setLensShift(cam, view.shift[0], view.shift[1], width, height);
   cam.updateMatrixWorld();
   measureEnvelope(cam, cache.scratch, cache.target, 0);
   if (!cache.initialized) copyEnvelope(cache.previous, cache.target);
   cache.transition = cache.initialized;
   cache.initialized = true;
   cache.sampled = false;
}

/** Cached full-frustum extrema + scalar scrolling. Eased lens/height changes recache eight rays. */
export function updateStreetHorizon(cache: StreetCache, camera: PerspectiveCamera, pigeonZ: number, out: Horizon): Horizon {
   let changed = !cache.sampled || Math.abs(camera.position.y - cache.sampleY) > 1e-8 ||
      Math.abs(camera.quaternion.x - cache.sampleQx) > 1e-10 || Math.abs(camera.quaternion.y - cache.sampleQy) > 1e-10 ||
      Math.abs(camera.quaternion.z - cache.sampleQz) > 1e-10 || Math.abs(camera.quaternion.w - cache.sampleQw) > 1e-10;
   const elements = camera.projectionMatrix.elements;
   for (let i = 0; i < 16; i++) if (elements[i] !== cache.projection[i]) changed = true;
   if (changed) {
      measureEnvelope(camera, cache.scratch, cache.actual, camera.position.z);
      for (let i = 0; i < 16; i++) cache.projection[i] = elements[i];
      cache.sampleY = camera.position.y;
      cache.sampleQx = camera.quaternion.x; cache.sampleQy = camera.quaternion.y;
      cache.sampleQz = camera.quaternion.z; cache.sampleQw = camera.quaternion.w;
      cache.sampled = true;
   }
   const union = cache.union, target = cache.target, previous = cache.previous, actual = cache.actual;
   union.valid = actual.valid;
   union.minX = actual.minX; union.maxX = actual.maxX;
   union.minZ = actual.minZ + camera.position.z; union.maxZ = actual.maxZ + camera.position.z;
   // Ordinary following translates one view: its prefetch row covers the next frame's 0.164 m.
   // Combining it with the untranslated target would inflate a valid 40-row view to 41 rows.
   if (cache.transition) {
      union.valid = union.valid && target.valid && previous.valid;
      union.minX = Math.min(union.minX, target.minX, previous.minX);
      union.maxX = Math.max(union.maxX, target.maxX, previous.maxX);
      union.minZ = Math.min(union.minZ, target.minZ + pigeonZ, previous.minZ + pigeonZ);
      union.maxZ = Math.max(union.maxZ, target.maxZ + pigeonZ, previous.maxZ + pigeonZ);
   }
   guardedRows(union, 0, out);
   if (cache.transition && Math.abs(camera.position.y - cache.targetCamera.position.y) < 1e-4 &&
      Math.abs(elements[8] - cache.targetCamera.projectionMatrix.elements[8]) < 1e-5 &&
      Math.abs(elements[9] - cache.targetCamera.projectionMatrix.elements[9]) < 1e-5) {
      copyEnvelope(cache.previous, cache.target);
      cache.transition = false;
   }
   return out;
}
