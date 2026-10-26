"use client";

// The playable clouds, drawn from the rules. m2CloudPlatformV2 sits with its crown on the collider
// top. Drifting and fading clouds are one dynamic pool (hidden once they have faded). Bounce clouds
// carry a feather. Checkpoints wear a rainbow arch. Stars spin on the gaps. Wind rings mark the lanes.
import { useEffect, useMemo, type MutableRefObject } from "react";
import { Matrix4, Vector3 } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { supportX, supportZ, type Course as CourseData, type RoofRun, type Support } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const SCRATCH = new Matrix4();
const SCALE = new Vector3();

function crownY(top: number, sy: number): number {
   return top - GLB_SIZE.cloud.top * sy;
}

function cloudMatrix(s: Support, sy: number, target: Matrix4): void {
   target.makeScale((s.hw * 2) / GLB_SIZE.cloud.x, sy, (s.hd * 2) / GLB_SIZE.cloud.z);
}

function CloudFallback({ spots }: { spots: readonly InstanceSpot[] }) {
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots}>
         <sphereGeometry args={[0.5, 14, 10]} />
         <meshStandardMaterial color={COLORS.cloud} roughness={0.72} />
      </Instanced>
   );
}

interface LiveCloud {
   s: Support;
   index: number;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const still: InstanceSpot[] = [];
      const feathers: InstanceSpot[] = [];
      const arches: InstanceSpot[] = [];
      const rings: InstanceSpot[] = [];
      const live: LiveCloud[] = [];
      const featherScale = 0.72 / GLB_SIZE.feather.y;
      const archScale = 4.2 / GLB_SIZE.rainbow.x;
      const ringScale = 1.6 / GLB_SIZE.windRing.y;
      course.supports.forEach((s, i) => {
         const sy = s.pad ? 0.72 : 0.62;
         if (s.mover || s.fadeMs > 0) {
            live.push({ s, index: i });
         } else {
            still.push({
               x: s.cx,
               y: crownY(s.top, sy),
               z: s.cz,
               rotY: (i % 5) * 0.4,
               sx: (s.hw * 2) / GLB_SIZE.cloud.x,
               sy,
               sz: (s.hd * 2) / GLB_SIZE.cloud.z,
            });
         }
         if (s.pad) feathers.push({ x: s.cx, y: s.top + 0.35, z: s.cz, scale: featherScale, rotY: i * 0.5 });
         if (s.kind === "checkpoint" || s.kind === "goal") {
            arches.push({ x: s.cx, y: s.top, z: s.cz - s.hd * 0.15, scale: archScale, rotY: 0 });
         }
      });
      for (const lane of course.lanes) {
         rings.push({ x: lane.x, y: (lane.y0 + lane.y1) / 2, z: lane.z, scale: ringScale, rotY: Math.atan2(lane.ax, lane.az) });
      }
      return { still, feathers, arches, rings, live };
   }, [course]);
}

export function Course({ run, clock, won }: { run: RoofRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;

   const liveUpdate = (i: number, m: Matrix4) => {
      const { s, index } = spots.live[i];
      const fadeAt = run.goneAt[index];
      if (fadeAt >= 0 && clock.ms >= fadeAt) return false;
      let sy = s.pad ? 0.72 : 0.62;
      if (fadeAt >= 0 && s.fadeMs > 0) {
         const k = Math.max(0, (fadeAt - clock.ms) / s.fadeMs);
         sy *= 0.35 + 0.65 * k;
      }
      cloudMatrix(s, sy, SCRATCH);
      m.copy(SCRATCH);
      m.setPosition(supportX(s, clock.ms), crownY(s.top, sy), supportZ(s, clock.ms));
   };

   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      const spin = time.now * 2.2 + i;
      m.makeRotationY(spin);
      const s = ORB_SIZE / GLB_SIZE.star.x;
      m.scale(SCALE.set(s, s, s));
      m.setPosition(o.x, o.y + Math.sin(time.now * 2 + i * 0.7) * 0.12, o.z);
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: 1, g: 0.9, b: 0.45 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (2.1 + Math.sin(time.now * 3 + i) * 0.2);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   void won;
   return (
      <>
         <InstancedModel asset={ASSETS.cloud} spots={spots.still} fallback={<CloudFallback spots={spots.still} />} />
         {spots.live.length > 0 ? <DynamicInstancedModel asset={ASSETS.cloud} count={spots.live.length} update={liveUpdate} name="live-clouds" /> : null}
         {spots.feathers.length > 0 ? <InstancedModel asset={ASSETS.feather} spots={spots.feathers} fallback={null} /> : null}
         {spots.arches.length > 0 ? <InstancedModel asset={ASSETS.rainbow} spots={spots.arches} fallback={null} /> : null}
         {spots.rings.length > 0 ? <InstancedModel asset={ASSETS.windRing} spots={spots.rings} fallback={null} /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.star} count={orbs.length} update={orbUpdate} name="stars" /> : null}
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
