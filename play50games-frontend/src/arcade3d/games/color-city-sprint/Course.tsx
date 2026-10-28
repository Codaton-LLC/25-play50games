"use client";

// The playable city, drawn from the run (rules.ts) every frame. Streets, pavements, the red paint and
// the markings are code (ground and markers); everything a player reads as an object is a Hyper3D
// mesh: the pastel rows, towers and brick blocks, buses, ramps, colour gates, traffic lights, the
// hoarding barriers, cones, gems, the beacon. Buildings start drained grey and take their colour
// back (with a flash) once a street beside them turns red. Remounted per level (Scene keys it).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import {
   BUS_HALF_L,
   CELL,
   CONE_R,
   RAIL_HALF_W,
   RAMP_LEN,
   STREET_HALF,
   gateShut,
   ventOn,
   VENT_ON,
   VENT_PERIOD,
   type Block,
   type Course as CityCourse,
} from "./city";
import { ASSETS, BLOCK_W, BRICK_SCALE, GLB_SIZE, PASTEL_SCALE, TOWER_SCALE } from "./assets";
import { COLORS, LOOKS } from "./look";
import { beaconPoint, litBeacon, ringReady, type CityRun } from "./rules";
import { SECRETS } from "./progression";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const UP = new Vector3(0, 1, 0);
const WHITE = new Color("#ffffff");
const GREY = new Color("#7d8089");
const FLASH = new Color("#ffe4d6");
const RED = new Color(COLORS.lane);
const PINK = new Color(COLORS.leg);
const GREEN = new Color("#22c55e");
const AMBER = new Color("#f59e0b");
const REDLIGHT = new Color("#ef4444");
const tmpC = new Color();

export interface VisualClock {
   ms: number;
}

function place(m: Matrix4, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1): void {
   pos.set(x, y, z);
   quat.setFromAxisAngle(UP, yaw);
   scl.set(sx, sy, sz);
   m.compose(pos, quat, scl);
}

/** A tiny deterministic hash per block (its look never changes between runs). */
function hash(a: number, b: number, c: number): number {
   let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
   h = (h ^ (h >>> 13)) * 1274126177;
   return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface BuildingSpot {
   x: number;
   z: number;
   yaw: number;
   sx: number;
   sy: number;
   sz: number;
   block: number;
}

/** The street edges round a block (its "restored" streets). */
function blockEdges(c: CityCourse, b: Block): number[] {
   const id = (ix: number, iz: number) => iz * c.nx + ix;
   return [c.hEdge[id(b.bx, b.bz)], c.hEdge[id(b.bx, b.bz + 1)], c.vEdge[id(b.bx, b.bz)], c.vEdge[id(b.bx + 1, b.bz)]].filter((e) => e >= 0);
}

function buildCity(c: CityCourse) {
   const pastel: BuildingSpot[] = [];
   const tower: BuildingSpot[] = [];
   const brick: BuildingSpot[] = [];
   c.blocks.forEach((b, i) => {
      if (b.kind !== "building" && b.kind !== "ghost") return;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const r = hash(b.bx, b.bz, c.id);
      const tall = 1.8 + hash(b.bz, b.bx, c.id * 7) * 1.1;
      if (b.kind === "ghost" || r < 0.55) {
         const d = GLB_SIZE.pastel.z * PASTEL_SCALE;
         pastel.push({ x: cx, z: b.z1 - d / 2, yaw: 0, sx: PASTEL_SCALE, sy: PASTEL_SCALE * tall, sz: PASTEL_SCALE, block: i });
         pastel.push({ x: cx, z: b.z0 + d / 2, yaw: Math.PI, sx: PASTEL_SCALE, sy: PASTEL_SCALE * (tall * 0.85 + 0.2), sz: PASTEL_SCALE, block: i });
      } else if (r < 0.82) {
         tower.push({ x: cx, z: cz, yaw: (Math.floor(r * 40) % 4) * (Math.PI / 2), sx: TOWER_SCALE, sy: TOWER_SCALE * (0.85 + tall * 0.35), sz: BLOCK_W / GLB_SIZE.tower.z, block: i });
      } else {
         brick.push({ x: cx, z: cz, yaw: (Math.floor(r * 40) % 4) * (Math.PI / 2), sx: BRICK_SCALE, sy: BRICK_SCALE * 2.1, sz: BRICK_SCALE, block: i });
      }
   });
   // pavements: one slab per block (a 1 m ring round the building, inside the street's 3 m)
   const slabs = c.blocks.map((b) => ({ x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2, w: b.x1 - b.x0 + 2, kind: b.kind }));
   // dashed centre lines: three dashes per street
   const dashes: { x: number; z: number; horiz: boolean }[] = [];
   for (const e of c.edges) {
      for (let k = 0; k < 3; k++) {
         const t = 0.3 + k * 0.2;
         dashes.push({ x: e.ax + (e.bx - e.ax) * t, z: e.az + (e.bz - e.az) * t, horiz: e.horiz });
      }
   }
   // streetlamps at the block corners (one per block, on the corner nearest the city centre)
   const lamps: { x: number; z: number }[] = [];
   for (const b of c.blocks) {
      if (b.kind === "plaza") continue;
      lamps.push({ x: b.x0 - 0.55, z: b.z0 - 0.55 });
      if ((b.bx + b.bz) % 2 === 0) lamps.push({ x: b.x1 + 0.55, z: b.z1 + 0.55 });
   }
   // the construction site's hoarding: three 3 m barrier panels along each side... two per side
   const panels: { x: number; z: number; yaw: number; nx: number; nz: number }[] = [];
   for (const b of c.blocks) {
      if (b.kind !== "site") continue;
      for (let k = 0; k < 2; k++) {
         const u = b.x0 + 1.5 + k * 3;
         panels.push({ x: u, z: b.z0, yaw: Math.PI / 2, nx: 0, nz: -1 }, { x: u, z: b.z1, yaw: Math.PI / 2, nx: 0, nz: 1 });
         const v = b.z0 + 1.5 + k * 3;
         panels.push({ x: b.x0, z: v, yaw: 0, nx: -1, nz: 0 }, { x: b.x1, z: v, yaw: 0, nx: 1, nz: 0 });
      }
   }
   const restore = c.blocks.map((b) => blockEdges(c, b));
   return { pastel, tower, brick, slabs, dashes, lamps, panels, restore };
}

function Buildings({ run, city }: { run: CityRun; city: ReturnType<typeof buildCity> }) {
   const c = run.course;
   // per block: how restored (0 grey .. 1 colour), and a flash when it turns
   const lit = useRef(new Float32Array(c.blocks.length));
   const flash = useRef(new Float32Array(c.blocks.length));
   useFrame((_s, delta) => {
      const dt = Math.min(0.1, delta);
      for (let i = 0; i < c.blocks.length; i++) {
         let want = 0;
         for (const e of city.restore[i]) if (run.painted[e]) want = 1;
         const was = lit.current[i];
         if (want > 0.5 && was < 0.05) flash.current[i] = 1;
         lit.current[i] += (want - was) * (1 - Math.exp(-3 * dt));
         flash.current[i] = Math.max(0, flash.current[i] - dt * 1.6);
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   const tint = (b: number, color?: Color) => {
      if (!color) return;
      const k = lit.current[b];
      color.copy(GREY).lerp(WHITE, k);
      if (c.blocks[b].kind === "ghost") color.lerp(tmpC.set(COLORS.ghost), 0.45);
      const f = flash.current[b];
      if (f > 0) color.lerp(FLASH, f * 0.6);
   };
   const draw = (list: BuildingSpot[]) => (i: number, m: Matrix4, color?: Color) => {
      const s = list[i];
      if (!s) return false;
      place(m, s.x, 0, s.z, s.yaw, s.sx, s.sy, s.sz);
      tint(s.block, color);
   };
   return (
      <>
         {city.pastel.length > 0 ? <DynamicInstancedModel asset={ASSETS.pastel} count={city.pastel.length} update={draw(city.pastel)} tinted name="pastel" /> : null}
         {city.tower.length > 0 ? <DynamicInstancedModel asset={ASSETS.tower} count={city.tower.length} update={draw(city.tower)} tinted name="towers" /> : null}
         {city.brick.length > 0 ? <DynamicInstancedModel asset={ASSETS.brick} count={city.brick.length} update={draw(city.brick)} tinted name="brick" /> : null}
      </>
   );
}

function Ground({ course, city }: { course: CityCourse; city: ReturnType<typeof buildCity> }) {
   const look = LOOKS[course.id];
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   const w = course.maxX - course.minX;
   const d = course.maxZ - course.minZ;
   const slab = (i: number, m: Matrix4, color?: Color) => {
      const s = city.slabs[i];
      if (!s) return false;
      place(m, s.x, 0.02, s.z, 0, s.w, 1, s.w);
      color?.set(s.kind === "plaza" ? COLORS.plaza : s.kind === "lot" ? COLORS.lot : look.pavement);
   };
   const dash = (i: number, m: Matrix4) => {
      const s = city.dashes[i];
      if (!s) return false;
      place(m, s.x, 0.03, s.z, s.horiz ? Math.PI / 2 : 0, 1, 1, 1);
   };
   return (
      <group>
         {/* the city's asphalt, and the paved land round it */}
         <mesh position={[cx, -0.02, cz]} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={look.asphalt} roughness={0.92} />
         </mesh>
         <mesh position={[cx, -0.06, cz]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[w + 260, d + 260]} />
            <meshStandardMaterial color={look.pavement} roughness={1} />
         </mesh>
         <DynamicInstanced count={city.slabs.length} update={slab} name="slabs" tinted>
            <boxGeometry args={[1, 0.04, 1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.95} />
         </DynamicInstanced>
         <DynamicInstanced count={city.dashes.length} update={dash} name="dashes">
            <boxGeometry args={[0.16, 0.012, 1.4]} />
            <meshBasicMaterial color={COLORS.line} transparent opacity={0.7} />
         </DynamicInstanced>
      </group>
   );
}

/** The red lanes: painted streets glow red; the leg you are running shows as a pale trail. */
export function Lanes({ run, glow, color, offset = 0, width = 1 }: { run: CityRun; glow: number; color?: string; offset?: number; width?: number }) {
   const own = useMemo(() => (color ? new Color(color) : RED), [color]);
   const c = run.course;
   const grow = useRef(new Float32Array(c.edges.length));
   useFrame((_s, delta) => {
      const dt = Math.min(0.1, delta);
      for (let i = 0; i < c.edges.length; i++) {
         const want = run.painted[i] ? 1 : 0;
         const g = grow.current[i];
         grow.current[i] = want > g ? Math.min(1, g + dt * 3.2) : Math.max(0, g - dt * 1.4);
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   const lanes = (i: number, m: Matrix4, tint?: Color) => {
      const e = c.edges[i];
      const g = grow.current[i];
      const leg = run.leg[i] === 1 && !run.painted[i];
      if (g < 0.01 && !leg) return false;
      const k = leg ? 1 : g;
      // painted streets reach into the crossings (one continuous network)
      const len = leg ? CELL - 2 * STREET_HALF : (CELL + 2.4) * k;
      const ox = e.horiz ? 0 : offset;
      const oz = e.horiz ? offset : 0;
      place(m, (e.ax + e.bx) / 2 + ox, leg ? 0.045 : 0.05 + Math.abs(offset) * 0.01, (e.az + e.bz) / 2 + oz, e.horiz ? Math.PI / 2 : 0, (leg ? 1.1 : 2.4 * (0.4 + 0.6 * k)) * width, 1, len);
      tint?.copy(leg ? PINK : own);
   };
   return (
      <DynamicInstanced count={c.edges.length} update={lanes} name="lanes" tinted>
         <boxGeometry args={[1, 0.02, 1]} />
         <meshStandardMaterial color="#ffffff" emissive={color ?? COLORS.lane} emissiveIntensity={glow} roughness={0.5} />
      </DynamicInstanced>
   );
}

function Lamps({ run, city, strength }: { run: CityRun; city: ReturnType<typeof buildCity>; strength: number }) {
   const poles = (i: number, m: Matrix4) => {
      const l = city.lamps[i];
      if (!l) return false;
      place(m, l.x, 0, l.z, 0);
   };
   const heads = (i: number, m: Matrix4) => {
      const l = city.lamps[i];
      if (!l) return false;
      place(m, l.x, 4.1, l.z, 0);
   };
   void run;
   return (
      <>
         <DynamicInstanced count={city.lamps.length} update={poles} name="lampPoles">
            <cylinderGeometry args={[0.07, 0.1, 4.2, 6]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
         </DynamicInstanced>
         <DynamicInstanced count={city.lamps.length} update={heads} name="lampHeads">
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshStandardMaterial color="#fff7d6" emissive="#ffd88a" emissiveIntensity={0.4 + strength * 2.2} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

function Site({ run, city, clock }: { run: CityRun; city: ReturnType<typeof buildCity>; clock: VisualClock }) {
   const fall = useRef(0);
   const t0 = useRef(-1);
   useFrame((_s, delta) => {
      if (run.siteOpen && t0.current < 0) t0.current = clock.ms;
      fall.current = run.siteOpen ? Math.min(1, fall.current + Math.min(0.1, delta) * 2.2) : 0;
   });
   const panel = (i: number, m: Matrix4, color?: Color) => {
      const p = city.panels[i];
      if (!p) return false;
      const f = fall.current;
      if (f >= 1) return false;
      // falls outward flat when smashed
      pos.set(p.x + p.nx * f * 1.1, -f * 0.8, p.z + p.nz * f * 1.1);
      quat.setFromAxisAngle(UP, p.yaw);
      scl.set(1, 1 - f * 0.9, 1);
      m.compose(pos, quat, scl);
      // the cracked panels (the first on each side) glow for Riko
      color?.copy(i % 4 === 0 ? tmpC.set("#ffb4a8") : WHITE);
   };
   if (city.panels.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.barrier} count={city.panels.length} update={panel} tinted name="hoarding" />;
}

function Ghosts({ course, clock }: { course: CityCourse; clock: VisualClock }) {
   const ghosts = course.blocks.filter((b) => b.kind === "ghost");
   const ref = useRef<Group>(null);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      for (const child of g.children) {
         const mat = (child as Mesh).material as MeshBasicMaterial | undefined;
         if (mat && "opacity" in mat) mat.opacity = 0.16 + 0.08 * Math.sin(clock.ms / 380);
      }
   });
   if (ghosts.length === 0) return null;
   return (
      <>
         <group ref={ref}>
            {ghosts.map((b, i) => (
               <mesh key={i} position={[(b.x0 + b.x1) / 2, 4.6, (b.z0 + b.z1) / 2]}>
                  <boxGeometry args={[b.x1 - b.x0 + 0.3, 9.4, b.z1 - b.z0 + 0.3]} />
                  <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.2} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} toneMapped={false} />
               </mesh>
            ))}
         </group>
         {/* the glass shop-fronts on its street faces */}
         {ghosts.map((b, i) => (
            <group key={i}>
               <Model asset={ASSETS.gate} position={[(b.x0 + b.x1) / 2, 0, b.z0 - 0.05]} scale={[0.75, 0.75, 0.75]} />
               <Model asset={ASSETS.gate} position={[(b.x0 + b.x1) / 2, 0, b.z1 + 0.05]} rotation-y={Math.PI} scale={[0.75, 0.75, 0.75]} />
            </group>
         ))}
      </>
   );
}

function Plazas({ course, clock }: { course: CityCourse; clock: VisualClock }) {
   const plazas = course.blocks.filter((b) => b.kind === "plaza");
   const water = useRef<Group>(null);
   useFrame(() => {
      const g = water.current;
      if (!g) return;
      g.children.forEach((child, i) => {
         const k = 1 + 0.08 * Math.sin(clock.ms / 160 + i);
         child.scale.set(1, k, 1);
      });
   });
   return (
      <group ref={water}>
         {plazas.map((b, i) => {
            const x = (b.x0 + b.x1) / 2;
            const z = (b.z0 + b.z1) / 2;
            return (
               <group key={i} position={[x, 0, z]}>
                  <mesh position={[0, 0.18, 0]}>
                     <cylinderGeometry args={[1.9, 2.05, 0.36, 28, 1, true]} />
                     <meshStandardMaterial color="#e7e0d6" roughness={0.7} side={DoubleSide} />
                  </mesh>
                  <mesh position={[0, 0.3, 0]} rotation-x={-Math.PI / 2}>
                     <circleGeometry args={[1.88, 28]} />
                     <meshStandardMaterial color="#60c3e8" emissive="#0ea5e9" emissiveIntensity={0.25} roughness={0.15} metalness={0.2} />
                  </mesh>
                  <mesh position={[0, 0.9, 0]}>
                     <cylinderGeometry args={[0.2, 0.32, 1.2, 12]} />
                     <meshStandardMaterial color="#e7e0d6" roughness={0.6} />
                  </mesh>
                  <mesh position={[0, 1.7, 0]}>
                     <coneGeometry args={[0.55, 1.1, 14, 1, true]} />
                     <meshBasicMaterial color="#bae6fd" transparent opacity={0.55} depthWrite={false} side={DoubleSide} />
                  </mesh>
               </group>
            );
         })}
      </group>
   );
}

function Ramps({ course }: { course: CityCourse }) {
   return (
      <>
         {course.ramps.map((r, i) => (
            <Model key={i} asset={ASSETS.ramp} position={[r.x - r.dx * RAMP_LEN * 0.5, 0, r.z - r.dz * RAMP_LEN * 0.5]} rotation-y={Math.atan2(-r.dx, -r.dz)} />
         ))}
      </>
   );
}

function Buses({ run }: { run: CityRun }) {
   const smooth = useRef(new Float32Array(run.course.buses.length).fill(Number.NaN));
   const bus = (i: number, m: Matrix4) => {
      const p = run.buses[i];
      if (!p) return false;
      // turn smoothly through the corners (the rules turn at once)
      let y = smooth.current[i];
      if (Number.isNaN(y)) y = p.yaw;
      let d = p.yaw - y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      y += d * 0.2;
      smooth.current[i] = y;
      place(m, p.x, 0, p.z, y);
   };
   if (run.course.buses.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.bus} count={run.course.buses.length} update={bus} name="buses" />;
}

function Rail({ course, glow }: { course: CityCourse; glow: number }) {
   const r = course.rail;
   if (!r) return null;
   const along = r.az === r.bz;
   const len = Math.abs(along ? r.bx - r.ax : r.bz - r.az) + 1;
   const mx = (r.ax + r.bx) / 2;
   const mz = (r.az + r.bz) / 2;
   const pillars: number[] = [];
   for (let t = 0; t <= len; t += CELL) pillars.push(t - len / 2 + 0.5);
   // the deck is held from the outer kerb (pillars beside the street, never in it)
   const out = along ? (r.az >= course.maxZ - STREET_HALF - 0.1 ? 1 : -1) : r.ax >= course.maxX - STREET_HALF - 0.1 ? 1 : -1;
   return (
      <group position={[mx, 0, mz]} rotation-y={along ? 0 : Math.PI / 2}>
         <mesh position={[0, r.y - 0.2, 0]}>
            <boxGeometry args={[len, 0.4, RAIL_HALF_W * 2]} />
            <meshStandardMaterial color={COLORS.rail} roughness={0.5} metalness={0.3} />
         </mesh>
         {[-1, 1].map((s) => (
            <mesh key={s} position={[0, r.y + 0.12, s * (RAIL_HALF_W - 0.06)]}>
               <boxGeometry args={[len, 0.24, 0.12]} />
               <meshStandardMaterial color="#fecdd3" emissive={COLORS.railGlow} emissiveIntensity={glow} toneMapped={false} />
            </mesh>
         ))}
         {pillars.map((p, i) => (
            <group key={i} position={[p, 0, out * (STREET_HALF + 0.6)]}>
               <mesh position={[0, r.y / 2, 0]}>
                  <boxGeometry args={[0.6, r.y, 0.6]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.7} />
               </mesh>
               <mesh position={[0, r.y - 0.45, -out * (STREET_HALF + 0.6) / 2]}>
                  <boxGeometry args={[0.5, 0.5, STREET_HALF + 0.6]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.7} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

function Gates({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const c = run.course;
   const lift = useRef(new Float32Array(c.gates.length));
   useFrame((_s, delta) => {
      const dt = Math.min(0.1, delta);
      for (let i = 0; i < c.gates.length; i++) {
         const want = gateShut(c.gates[i], Math.max(0, clock.ms)) ? 0 : 1;
         lift.current[i] += (want - lift.current[i]) * (1 - Math.exp(-14 * dt));
      }
   });
   const frames = (i: number, m: Matrix4) => {
      const g = c.gates[i];
      if (!g) return false;
      // a horizontal (x) street gets a bar across z
      const yaw = g.hx < g.hz ? Math.PI / 2 : 0;
      place(m, g.x, lift.current[i] * 3.1, g.z, yaw);
   };
   const bars = (i: number, m: Matrix4, color?: Color) => {
      const g = c.gates[i];
      if (!g) return false;
      const shut = gateShut(g, Math.max(0, clock.ms));
      const across = g.hx < g.hz;
      place(m, g.x, 1.3 + lift.current[i] * 3.1, g.z, across ? Math.PI / 2 : 0, STREET_HALF * 2 - 0.4, 1, 1);
      color?.copy(shut ? REDLIGHT : GREEN);
   };
   const lights = (i: number, m: Matrix4) => {
      const g = c.gates[i];
      if (!g) return false;
      const across = g.hx < g.hz;
      // on the kerb, facing down the street
      place(m, g.x + (across ? 0.9 : STREET_HALF + 0.4), 0, g.z + (across ? STREET_HALF + 0.4 : 0.9), across ? -Math.PI / 2 : 0);
   };
   const lamps = (i: number, m: Matrix4, color?: Color) => {
      const g = c.gates[i];
      if (!g) return false;
      const across = g.hx < g.hz;
      const shut = gateShut(g, Math.max(0, clock.ms));
      const left = shut ? 9999 : (g.phase === 0 ? 4000 - (clock.ms % 8000) : 8000 - (clock.ms % 8000));
      place(m, g.x + (across ? 0.9 : STREET_HALF + 0.4), 3.75, g.z + (across ? STREET_HALF + 0.4 : 0.9), 0, 1, 1, 1);
      color?.copy(shut ? REDLIGHT : left < 1200 ? AMBER : GREEN);
   };
   if (c.gates.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.gate} count={c.gates.length} update={frames} name="gates" />
         <DynamicInstanced count={c.gates.length} update={bars} name="gateBars" tinted>
            <boxGeometry args={[1, 0.22, 0.14]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.light} count={c.gates.length} update={lights} name="trafficLights" />
         <DynamicInstanced count={c.gates.length} update={lamps} name="gateLamps" tinted>
            <sphereGeometry args={[0.22, 10, 8]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

function Hazards({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const c = run.course;
   const sludgeN = c.sludge.length + 8;
   const sludge = (i: number, m: Matrix4) => {
      const s = i < c.sludge.length ? c.sludge[i] : run.puddles[i - c.sludge.length];
      if (!s) return false;
      const wob = 1 + 0.03 * Math.sin(clock.ms / 300 + i);
      place(m, s.x, 0.06, s.z, i, s.r * wob, 1, s.r * wob);
   };
   const vents = (i: number, m: Matrix4) => {
      const v = c.vents[i];
      if (!v) return false;
      place(m, v.x, 0.04, v.z, 0, v.r, 1, v.r);
   };
   const steam = (i: number, m: Matrix4) => {
      const v = c.vents[i];
      if (!v) return false;
      const t = ((Math.max(0, clock.ms) + i * 900) % VENT_PERIOD) / VENT_ON;
      const on = ventOn(Math.max(0, clock.ms), i);
      // a warning hiss (small) before it blows, the full plume while on
      const warn = !on && t * VENT_ON > VENT_PERIOD - 500 ? 0.25 : 0;
      const h = on ? 3.2 * Math.min(1, t * 4) : warn;
      if (h <= 0.01) return false;
      place(m, v.x, h / 2, v.z, clock.ms / 400, v.r * 0.9, h, v.r * 0.9);
   };
   const drains = (i: number, m: Matrix4) => {
      const d = c.drains[i];
      if (!d) return false;
      place(m, d.x + (i === 0 && c.blocks.some((b) => b.kind === "plaza") ? 0 : 0), 0.035, d.z, 0, 1, 1, 1);
   };
   return (
      <>
         <DynamicInstanced count={sludgeN} update={sludge} name="sludge">
            <cylinderGeometry args={[1, 1, 0.05, 24]} />
            <meshStandardMaterial color={COLORS.sludge} roughness={0.15} metalness={0.4} emissive={COLORS.sludgeGlow} emissiveIntensity={0.15} />
         </DynamicInstanced>
         {c.vents.length > 0 ? (
            <>
               <DynamicInstanced count={c.vents.length} update={vents} name="vents">
                  <cylinderGeometry args={[1, 1, 0.06, 6]} />
                  <meshStandardMaterial color="#52525b" metalness={0.6} roughness={0.4} />
               </DynamicInstanced>
               <DynamicInstanced count={c.vents.length} update={steam} name="steam">
                  <cylinderGeometry args={[0.6, 1, 1, 10, 1, true]} />
                  <meshBasicMaterial color="#f1f5f9" transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
               </DynamicInstanced>
            </>
         ) : null}
         <DynamicInstanced count={c.drains.length} update={drains} name="drains">
            <boxGeometry args={[1.1, 0.03, 0.7]} />
            <meshStandardMaterial color={COLORS.drain} metalness={0.7} roughness={0.35} />
         </DynamicInstanced>
      </>
   );
}

function Orbs({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const c = run.course;
   const gems = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = c.orbs[i];
      // a drain's coins only show while the magnet pulls them up
      if (o.drain >= 0) {
         const h = run.hero;
         if (h.magnetUntil < run.simMs) return false;
      }
      const t = clock.ms / 1000;
      const s = o.drain >= 0 ? 0.6 : 1;
      place(m, o.x, o.y - 0.31 * s + 0.12 * Math.sin(t * 2.4 + i), o.z, t * 1.6 + i, s, s, s);
   };
   return <DynamicInstancedModel asset={ASSETS.gem} count={c.orbs.length} update={gems} name="gems" />;
}

function Secrets({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const c = run.course;
   const list = SECRETS[run.level];
   const shard = (i: number, m: Matrix4, color?: Color) => {
      const s = c.secrets[i];
      if (!s || run.secrets.found[i]) return false;
      if (list[i].id === "perfect-loop" && !ringReady(run)) return false;
      place(m, s.x, s.y + 0.1 * Math.sin(clock.ms / 300 + i), s.z, clock.ms / 500, 1, 1, 1);
      color?.set(list[i].kind === "shard" ? COLORS.shard : COLORS.sticker);
   };
   return (
      <DynamicInstanced count={c.secrets.length} update={shard} name="secrets" tinted>
         <octahedronGeometry args={[0.38, 0]} />
         <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} roughness={0.2} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** The lit beacon: the beacon GLB and a tall red light pillar seen over the roofs. */
function Beacon({ run, clock }: { run: CityRun; clock: VisualClock }) {
   const root = useRef<Group>(null);
   const pillar = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const p = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const pop = useRef({ index: -1, at: 0 });
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const c = run.course;
      const done = !c.boss && run.beaconIndex >= c.laps * c.beacons.length;
      g.visible = !done && run.ended === null && !(run.boss && run.boss.hp <= 0);
      if (!g.visible) return;
      beaconPoint(run, litBeacon(run), p);
      if (pop.current.index !== run.beaconIndex) {
         pop.current.index = run.beaconIndex;
         pop.current.at = clock.ms;
      }
      const k = Math.min(1, Math.max(0, (clock.ms - pop.current.at) / 400));
      const s = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + 0.3 * Math.sin(k * Math.PI)) : 1;
      g.position.set(p.x, p.y, p.z);
      g.scale.setScalar(Math.max(0.01, s));
      const pm = pillar.current;
      if (pm) (pm.material as MeshBasicMaterial).opacity = 0.32 + 0.12 * Math.sin(clock.ms / 180);
      const rm = ring.current;
      if (rm) {
         const r = 1 + 0.15 * Math.sin(clock.ms / 220);
         rm.scale.set(r, r, r);
      }
   });
   return (
      <group ref={root}>
         <Model asset={ASSETS.beacon} scale={1.25} />
         <mesh ref={pillar} position={[0, 30, 0]}>
            <cylinderGeometry args={[0.55, 0.9, 60, 16, 1, true]} />
            <meshBasicMaterial color={COLORS.lane} transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} toneMapped={false} />
         </mesh>
         <mesh ref={ring} position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.35, 1.6, 40]} />
            <meshBasicMaterial color={COLORS.laneGlow} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

export function Course({ run, clock, lanes = true }: { run: CityRun; clock: VisualClock; lanes?: boolean }) {
   const course = run.course;
   const city = useMemo(() => buildCity(course), [course]);
   const look = LOOKS[course.id];
   const cones = useMemo(() => course.cones.map((c) => ({ x: c.x, y: 0, z: c.z, rotY: c.x * 3.1 })), [course]);
   void CONE_R;
   void BUS_HALF_L;
   return (
      <group>
         <Ground course={course} city={city} />
         {lanes ? <Lanes run={run} glow={look.laneGlow} /> : null}
         <Buildings run={run} city={city} />
         <Lamps run={run} city={city} strength={look.lamps} />
         <Site run={run} city={city} clock={clock} />
         <Ghosts course={course} clock={clock} />
         <Plazas course={course} clock={clock} />
         {cones.length > 0 ? <InstancedModel asset={ASSETS.cone} spots={cones} fallback={null} /> : null}
         <Ramps course={course} />
         <Buses run={run} />
         <Rail course={course} glow={look.lamps > 0 ? 1.4 : 0.4} />
         <Gates run={run} clock={clock} />
         <Hazards run={run} clock={clock} />
         <Orbs run={run} clock={clock} />
         <Secrets run={run} clock={clock} />
         <Beacon run={run} clock={clock} />
      </group>
   );
}
