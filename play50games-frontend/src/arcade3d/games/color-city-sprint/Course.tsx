"use client";

// The playable city, drawn from the run. Streets are code (asphalt and the red paint). Everything
// a player reads as an object is a Hyper3D mesh: blocks, towers, cones, gates, the ramp, the bus,
// gems, the beacon, Greyout and its drones. Red lanes and window strips update every frame.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Mesh } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { CELL, RAIL_Y, gateClosed, type Course as CityCourse } from "./city";
import { ASSETS } from "./assets";
import { COLORS, isNightLevel } from "./look";
import { guidePoint, type CityRun } from "./rules";

const pos = new Vector3();
const quat = new Quaternion();
const one = new Vector3(1, 1, 1);
const scl = new Vector3();
const UP = new Vector3(0, 1, 0);
const RED = new Color(COLORS.lane);
const WARM = new Color("#fdba74");
const NIGHT_WIN = new Color("#fde68a");

export interface VisualClock {
   ms: number;
}

export function Course({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const course = run.course;
   const night = isNightLevel(course.id);
   const spots = useMemo(() => buildSpots(course), [course]);

   const streets = (i: number, m: Matrix4) => {
      const e = spots.streetEdges[i];
      if (!e) return false;
      lay(e.mx, 0.02, e.mz, e.bx - e.ax, e.bz - e.az, 2.6, e.len, m);
   };
   const lanes = (i: number, m: Matrix4, color?: Color) => {
      const e = course.edges[i];
      if (!e || !run.painted[i] || e.kind === "rail" || e.kind === "ghost" || e.kind === "cut") return false;
      lay(e.mx, 0.06, e.mz, e.bx - e.ax, e.bz - e.az, 1.7, e.len, m);
      color?.copy(RED);
   };
   const gates = (i: number, m: Matrix4) => {
      const g = course.gates[i];
      if (!g) return false;
      const open = !gateClosed(clock.ms);
      pos.set(g.x, open ? 3.1 : 0, g.z);
      quat.setFromAxisAngle(UP, g.hx < g.hz ? Math.PI / 2 : 0);
      m.compose(pos, quat, one);
   };
   const bus = (i: number, m: Matrix4) => {
      if (!course.bus || i > 0) return false;
      pos.set(run.busX, 0, run.busZ);
      const yaw = Math.hypot(run.busVx, run.busVz) > 0.2 ? Math.atan2(run.busVx, run.busVz) : 0;
      quat.setFromAxisAngle(UP, yaw);
      m.compose(pos, quat, one);
   };
   const gems = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = course.orbs[i];
      pos.set(o.x, o.y, o.z);
      quat.identity();
      m.compose(pos, quat, one);
   };
   const hoarding = (i: number, m: Matrix4) => {
      const cut = course.cut;
      if (!cut || run.cutOpen || i > 0) return false;
      pos.set((cut.ax + cut.bx) / 2, 0, (cut.az + cut.bz) / 2);
      quat.setFromAxisAngle(UP, Math.atan2(cut.bx - cut.ax, cut.bz - cut.az));
      m.compose(pos, quat, one);
   };
   const boss = (i: number, m: Matrix4) => {
      if (!course.boss || i > 0) return false;
      pos.set(run.truckX, 0, run.truckZ);
      quat.setFromAxisAngle(UP, run.truckYaw);
      m.compose(pos, quat, one);
   };
   const drones = (i: number, m: Matrix4) => {
      if (!course.boss || !run.boss || run.boss.phase < 1) return false;
      const a = clock.ms / 700 + i * 2.1;
      pos.set(run.course.rear.x + Math.cos(a) * 3.2, 2.2 + i * 0.35, run.course.rear.z + Math.sin(a) * 2.4);
      quat.setFromAxisAngle(UP, a);
      m.compose(pos, quat, one);
   };
   const windows = (i: number, m: Matrix4, color?: Color) => {
      const w = spots.windows[i];
      if (!w) return false;
      const lit = w.edge >= 0 && run.painted[w.edge] === 1;
      if (night && !lit) return false;
      pos.set(w.x, w.y, w.z);
      quat.identity();
      scl.set(w.sx, 0.35, w.sz);
      m.compose(pos, quat, scl);
      color?.copy(lit ? RED : WARM);
      if (night && lit) color?.copy(NIGHT_WIN);
   };

   return (
      <group>
         <DynamicInstanced count={spots.streetEdges.length} update={streets} name="streets">
            <boxGeometry args={[1, 0.04, 1]} />
            <meshStandardMaterial color={night ? COLORS.nightStreet : COLORS.street} />
         </DynamicInstanced>
         <DynamicInstanced count={course.edges.length} update={lanes} name="lanes" tinted>
            <boxGeometry args={[1, 0.05, 1]} />
            <meshStandardMaterial color={COLORS.lane} emissive={COLORS.lane} emissiveIntensity={night ? 1.4 : 0.55} />
         </DynamicInstanced>
         <InstancedModel asset={ASSETS.block} spots={spots.blocks} fallback={null} />
         <InstancedModel asset={ASSETS.tower} spots={spots.towers} fallback={null} />
         <DynamicInstanced count={spots.windows.length} update={windows} name="windows" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#fdba74" emissive="#fb7185" emissiveIntensity={night ? 1.6 : 0.35} />
         </DynamicInstanced>
         {spots.cones.length > 0 ? <InstancedModel asset={ASSETS.cone} spots={spots.cones} fallback={null} /> : null}
         {course.gates.length > 0 ? <DynamicInstancedModel asset={ASSETS.gateV2} count={course.gates.length} update={gates} /> : null}
         {course.cut ? <DynamicInstancedModel asset={ASSETS.barrier} count={1} update={hoarding} /> : null}
         <Model asset={ASSETS.gate} position={[course.startX + CELL * 0.5, 0, course.startZ]} rotation={[0, Math.PI / 2, 0]} />
         {course.ramps.map((r, i) => (
            <group key={i} position={[r.x - r.dx * r.len * 0.5, 0, r.z - r.dz * r.len * 0.5]} rotation={[0, Math.atan2(r.dx, r.dz), 0]}>
               <Model asset={ASSETS.ramp} />
            </group>
         ))}
         {course.bus ? <DynamicInstancedModel asset={ASSETS.bus} count={1} update={bus} /> : null}
         <DynamicInstancedModel asset={ASSETS.gem} count={course.orbs.length} update={gems} />
         <InstancedModel asset={ASSETS.beacon} spots={spots.beacons} fallback={null} />
         <BeaconPole run={run} />
         {course.sludge.map((s, i) => (
            <mesh key={i} position={[s.x, 0.05, s.z]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[s.r, 20]} />
               <meshStandardMaterial color={COLORS.sludge} transparent opacity={0.85} />
            </mesh>
         ))}
         <mesh position={[(course.nx - 1) * CELL * 0.5, RAIL_Y, (course.nz - 1) * CELL]}>
            <boxGeometry args={[(course.nx - 1) * CELL, 0.18, 1.4]} />
            <meshStandardMaterial color={COLORS.rail} emissive={night ? "#fb7185" : "#000"} emissiveIntensity={night ? 0.4 : 0} />
         </mesh>
         {course.boss ? <DynamicInstancedModel asset={ASSETS.boss} count={1} update={boss} /> : null}
         {course.boss ? <DynamicInstancedModel asset={ASSETS.drone} count={3} update={drones} /> : null}
         {spots.ghostBlock ? (
            <mesh position={[spots.ghostBlock.x, 1.6, spots.ghostBlock.z]}>
               <boxGeometry args={[spots.ghostBlock.w, 3.2, spots.ghostBlock.d]} />
               <meshStandardMaterial color="#8b5cf6" transparent opacity={0.28} emissive="#6d28d9" emissiveIntensity={0.4} />
            </mesh>
         ) : null}
      </group>
   );
}

function BeaconPole({ run }: { run: CityRun }) {
   const ref = useRef<Mesh>(null);
   const guide = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      guidePoint(run, guide);
      m.position.set(guide.x, guide.y + 1.4, guide.z);
      m.visible = run.ended === null;
   });
   return (
      <mesh ref={ref}>
         <cylinderGeometry args={[0.08, 0.08, 2.6, 8]} />
         <meshBasicMaterial color={COLORS.lane} />
      </mesh>
   );
}

function lay(x: number, y: number, z: number, dx: number, dz: number, width: number, length: number, m: Matrix4): void {
   pos.set(x, y, z);
   quat.setFromAxisAngle(UP, Math.atan2(dx, dz));
   scl.set(width, 1, Math.max(0.4, length));
   m.compose(pos, quat, scl);
}

function buildSpots(course: CityCourse) {
   const blocks: InstanceSpot[] = [];
   const towers: InstanceSpot[] = [];
   const windows: { x: number; y: number; z: number; sx: number; sz: number; edge: number }[] = [];
   course.blocks.forEach((b, i) => {
      const w = b.x1 - b.x0;
      const d = b.z1 - b.z0;
      const tall = (b.ix + b.iz) % 3 === 0;
      const spot: InstanceSpot = {
         x: (b.x0 + b.x1) / 2,
         y: 0,
         z: (b.z0 + b.z1) / 2,
         sx: w / 1.9,
         sy: (tall ? 8.5 : 5.2) / 0.67,
         sz: d / 1.9,
      };
      if (tall) towers.push({ ...spot, sy: 7.5 / 1.9, sx: w / 2.4, sz: d / 2.4 });
      else blocks.push(spot);
      const mx = spot.x;
      const mz = spot.z;
      const edgeNear = (x: number, z: number) => {
         let best = -1;
         let bestD = 4;
         for (let k = 0; k < course.edges.length; k++) {
            const e = course.edges[k];
            if (e.kind !== "street") continue;
            const dx = e.mx - x;
            const dz = e.mz - z;
            const dist = dx * dx + dz * dz;
            if (dist < bestD) {
               bestD = dist;
               best = k;
            }
         }
         return best;
      };
      windows.push({ x: b.x0 + 0.15, y: 2.4, z: mz, sx: 0.12, sz: d * 0.55, edge: edgeNear(b.x0 - 1, mz) });
      windows.push({ x: mx, y: 3.1, z: b.z0 + 0.15, sx: w * 0.55, sz: 0.12, edge: edgeNear(mx, b.z0 - 1) });
      if (i % 2 === 0) windows.push({ x: b.x1 - 0.15, y: 2.2, z: mz, sx: 0.12, sz: d * 0.4, edge: edgeNear(b.x1 + 1, mz) });
   });
   const cones: InstanceSpot[] = course.cones.map((c) => ({ x: c.x, y: 0, z: c.z }));
   const beacons: InstanceSpot[] = [];
   const seen = new Set<number>();
   for (const b of course.beacons) {
      if (b.bus || seen.has(b.node)) continue;
      seen.add(b.node);
      const ix = b.node % course.nx;
      const iz = Math.floor(b.node / course.nx);
      beacons.push({ x: ix * CELL, y: 0, z: iz * CELL, scale: 1.15 });
   }
   const first = course.beacons[0];
   const active = first && !first.bus
      ? { x: (first.node % course.nx) * CELL, z: Math.floor(first.node / course.nx) * CELL }
      : { x: course.startX, z: course.startZ };
   let ghostBlock: { x: number; z: number; w: number; d: number } | null = null;
   const ghost = course.blocks.find((b) => b.ghost);
   if (ghost) ghostBlock = { x: (ghost.x0 + ghost.x1) / 2, z: (ghost.z0 + ghost.z1) / 2, w: ghost.x1 - ghost.x0, d: ghost.z1 - ghost.z0 };
   const streetEdges = course.edges.filter((e) => e.kind === "street" || e.kind === "alley");
   return { blocks, towers, windows, cones, beacons, active, ghostBlock, streetEdges };
}
