"use client";

// The run's props, drawn from the rules (rules.ts / halls.ts): the door walls (stone pillars and
// lintels, the coloured doors m2DoorwayV2 tinted per door with their shape glyphs, the shut doors
// m2SlidingDoor, Riko's cracked fake doors with glowing cracks, Vexa's ghost doors as shimmering stone,
// Nami's upper door row in gold over the tall walls), the rule lamps (m2MineLanternPost hung on a chain
// with the rule's glowing globe and glyph, dimmed for the sound rule, crossed out for NOT, a double
// ring for the echo rule), level 1's floor arrows, the orbs (m2ScoreOrb; Zuno's wall trails only
// under his magnet), floor bars and low beams, the speed pads (m2ChevronSpeedPad), Kiro's flame vents,
// the secrets, the finish gate, and on level 5 Flicker (m2FireSpirit x4), his three flames and his fire.
// A true door rolls up like a shutter as the hero commits to it (after the lock); a wrong one stays shut.
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   CircleGeometry,
   Color,
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   InstancedMesh,
   Material,
   MeshBasicMaterial,
   MeshStandardMaterial,
   Object3D,
   OctahedronGeometry,
   PlaneGeometry,
   Shape,
   ShapeGeometry,
   TorusGeometry,
   type BufferGeometry,
   type Group,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ArchWall, CheckpointPad } from "@/arcade3d/menu2/props";
import { ASSETS, DOOR_H, DOOR_SCALE, GLB_SIZE, LANTERN_H, ORB_H, SHUT_SCALE_X, SHUT_SCALE_Y, SPIRIT_SCALE } from "./assets";
import { DOOR, DOOR_COLORS, LAMP_AHEAD, LANE_W, UPPER_SILL, laneX, type ShapeId } from "./halls";
import { LOOKS } from "./look";
import { SECRETS } from "./progression";
import {
   DOOR_CRACKED,
   DOOR_GHOST,
   DOOR_SHUT,
   LOCK_MS,
   NONE,
   WALL,
   bossAlive,
   bossVulnerable,
   cueColorAt,
   doorAt,
   wallDef,
   type DoorRun,
} from "./rules";

const DUMMY = new Object3D();
const WHITE = new Color("#ffffff");
const COLORS = DOOR_COLORS.map((c) => new Color(c.hex));
const GLOWS = DOOR_COLORS.map((c) => new Color(c.glow));
const GREY = new Color("#94a3b8");
const SHAPES: readonly ShapeId[] = ["circle", "triangle", "square", "diamond", "hex"];

/** Walls drawn round the hero: the one just passed and the next ones, within AHEAD (the doors are 3k triangles each). */
export const WALL_SLOTS = 5;
/** Props farther ahead than this are not drawn (the fog hides them). */
export const AHEAD = 125;

function firstSlot(run: DoorRun): number {
   return Math.max(0, run.nextWall - 1);
}

function place(x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): Object3D {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rx, ry, rz);
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   return DUMMY;
}

/** A pool of instanced copies of one geometry + material, placed every frame by `update` (false hides one). */
function Pool({ geometry, material, count, update, tinted = false, order }: { geometry: BufferGeometry; material: Material; count: number; update: (i: number, color: Color) => Object3D | false; tinted?: boolean; order?: number }) {
   const ref = useRef<InstancedMesh>(null);
   const color = useMemo(() => new Color(), []);
   useEffect(() => {
      const m = ref.current;
      if (!m || !tinted) return;
      for (let i = 0; i < count; i++) m.setColorAt(i, WHITE);
   }, [count, tinted]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      let n = 0;
      for (let i = 0; i < count; i++) {
         color.copy(WHITE);
         const o = update(i, color);
         if (o === false) continue;
         m.setMatrixAt(n, o.matrix);
         if (tinted) m.setColorAt(n, color);
         n++;
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (tinted && m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return <instancedMesh ref={ref} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} renderOrder={order} />;
}

/** The shape glyph geometries (colour-blind fix: every colour has its shape). */
function glyphGeometry(shape: ShapeId): BufferGeometry {
   switch (shape) {
      case "circle":
         return new CircleGeometry(0.5, 28);
      case "triangle": {
         const g = new CircleGeometry(0.58, 3);
         g.rotateZ(Math.PI / 2);
         g.translate(0, -0.06, 0);
         return g;
      }
      case "square": {
         const g = new CircleGeometry(0.6, 4);
         g.rotateZ(Math.PI / 4);
         return g;
      }
      case "diamond": {
         const g = new CircleGeometry(0.58, 4);
         g.scale(0.78, 1.1, 1);
         return g;
      }
      case "hex":
         return new CircleGeometry(0.54, 6);
   }
}

function chevronGeometry(): BufferGeometry {
   const s = new Shape();
   s.moveTo(-0.6, 0);
   s.lineTo(0, 0.55);
   s.lineTo(0.6, 0);
   s.lineTo(0.6, -0.3);
   s.lineTo(0, 0.25);
   s.lineTo(-0.6, -0.3);
   s.closePath();
   const g = new ShapeGeometry(s);
   g.rotateX(-Math.PI / 2);
   return g;
}

/** The wall a slot draws (NONE = empty). */
function slotWall(run: DoorRun, slot: number): number {
   const w = firstSlot(run) + slot;
   if (w >= run.wallCount) return NONE;
   if (run.wallZ[w] < run.hero.z - AHEAD) return NONE;
   return w;
}

/** 0..1: how far the door in (w, lane) has rolled up. The true door opens as the hero commits to it. */
export function doorOpen(run: DoorRun, w: number, lane: number): number {
   const ms = run.simMs;
   const r = run.result[w];
   const h = run.hero;
   if (r === WALL.opened) return Math.min(1, Math.max(0, (ms - run.resultMs[w]) / 400) + 0.3);
   if (r !== WALL.pending) {
      if (lane !== run.trueLane[w]) return 0;
      if (r === WALL.truePass || r === WALL.absorbed) return 1;
      // a wrong door: the true one opens after the thud (the hall forgives)
      return Math.min(1, Math.max(0, (ms - run.resultMs[w] - 250) / 300));
   }
   if (w !== run.nextWall || lane !== run.trueLane[w] || lane !== h.lane || h.side !== NONE) return 0;
   const gap = h.z - run.wallZ[w];
   const t = gap / Math.max(1, h.v);
   return Math.max(0, Math.min(1, 1 - t / (LOCK_MS / 1000 * 0.55)));
}

function WallBodies({ run }: { run: DoorRun }) {
   const c = run.course;
   const lanes = c.lanes;
   const look = LOOKS[c.level];
   const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.06), []);
   const stone = useMemo(() => new MeshStandardMaterial({ color: look.stone, roughness: 0.82, metalness: 0.02 }), [look]);
   const trim = useMemo(() => new MeshStandardMaterial({ color: look.trim, roughness: 0.5, emissive: look.ember, emissiveIntensity: 0.55 }), [look]);
   const gold = useMemo(() => new MeshStandardMaterial({ color: "#fcd34d", roughness: 0.35, metalness: 0.5, emissive: "#f59e0b", emissiveIntensity: 0.6 }), []);
   useEffect(
      () => () => {
         geo.dispose();
         stone.dispose();
         trim.dispose();
         gold.dispose();
      },
      [geo, stone, trim, gold],
   );
   const per = lanes + 3;
   const half = c.half;
   const pillar = LANE_W - (LANE_W - 0.42);
   return (
      <>
         {/* pillars between the doors, the lintel over them, a ghost door's stone panel */}
         <Pool
            geometry={geo}
            material={stone}
            count={WALL_SLOTS * per}
            update={(i) => {
               const w = slotWall(run, Math.floor(i / per));
               if (w === NONE) return false;
               const k = i % per;
               const z = run.wallZ[w];
               const def = wallDef(run, w);
               const tall = def && def.upper !== NONE;
               const H = tall ? DOOR.tallH : DOOR.wallH;
               if (k <= lanes) {
                  const x = laneX(k, lanes) - LANE_W / 2;
                  const edge = k === 0 || k === lanes;
                  return place(edge ? x + (k === 0 ? -0.1 : 0.1) : x, H / 2, z, edge ? pillar + 0.6 : pillar, H, DOOR.thick + 0.15);
               }
               if (k === lanes + 1) return place(0, (DOOR_H + H) / 2, z, half * 2 + 0.4, H - DOOR_H, DOOR.thick);
               // a ghost door's stone panel (Vexa's phase passes it)
               for (let l = 0; l < lanes; l++) {
                  if (doorAt(run, w, l) !== DOOR_GHOST) continue;
                  const open = run.result[w] === WALL.ghost ? 1 : 0;
                  return place(laneX(l, lanes), DOOR_H / 2, z - 0.05, LANE_W - 0.42, DOOR_H * (1 - open) + 0.001, DOOR.thick * 0.8);
               }
               return false;
            }}
         />
         {/* the ember trim: a glowing band under each lintel and a cap on each pillar */}
         <Pool
            geometry={geo}
            material={trim}
            count={WALL_SLOTS * (lanes + 2)}
            update={(i) => {
               const per2 = lanes + 2;
               const w = slotWall(run, Math.floor(i / per2));
               if (w === NONE) return false;
               const k = i % per2;
               const z = run.wallZ[w];
               const def = wallDef(run, w);
               const H = def && def.upper !== NONE ? DOOR.tallH : DOOR.wallH;
               if (k === lanes + 1) return place(0, DOOR_H + 0.08, z + 0.02, half * 2 + 0.45, 0.16, DOOR.thick + 0.12);
               return place(laneX(k, lanes) - LANE_W / 2, H + 0.1, z, pillar + 0.2, 0.2, DOOR.thick + 0.3);
            }}
         />
         {/* Nami's upper door row: a gold frame high over its lane on a tall wall */}
         <Pool
            geometry={geo}
            material={gold}
            count={WALL_SLOTS * 3}
            update={(i) => {
               const w = slotWall(run, Math.floor(i / 3));
               if (w === NONE) return false;
               const def = wallDef(run, w);
               if (!def || def.upper === NONE) return false;
               const k = i % 3;
               const x = laneX(def.upper, lanes);
               const z = run.wallZ[w] + 0.3;
               const top = UPPER_SILL + 1.9;
               if (k === 0) return place(x, UPPER_SILL, z, LANE_W - 0.3, 0.14, 0.3);
               if (k === 1) return place(x, top, z, LANE_W - 0.3, 0.14, 0.3);
               return place(x, (UPPER_SILL + top) / 2, z, 0.12, top - UPPER_SILL, 0.3);
            }}
         />
      </>
   );
}

function Doors({ run }: { run: DoorRun }) {
   const c = run.course;
   const lanes = c.lanes;
   const time = useGameTime();
   const zs = 0.5 / GLB_SIZE.doorway.z;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.doorway}
            count={WALL_SLOTS * lanes}
            tinted
            update={(i, m, color) => {
               const w = slotWall(run, Math.floor(i / lanes));
               if (w === NONE) return false;
               const lane = i % lanes;
               const d = doorAt(run, w, lane);
               if (d === DOOR_SHUT || d === DOOR_GHOST) return false;
               const col = d === DOOR_CRACKED ? run.crackColor[w] : d;
               const open = doorOpen(run, w, lane);
               if (open >= 0.995) return false;
               const def = wallDef(run, w);
               const short = def && def.upper === lane ? 0.8 : 1;
               // a wrong door flashes grey after the thud
               const r = run.result[w];
               const hit = r === WALL.wrong && lane !== run.trueLane[w] && run.simMs - run.resultMs[w] < 600;
               color.copy(hit && Math.floor(time.now * 12) % 2 === 0 ? GREY : COLORS[col]);
               if (d === DOOR_CRACKED) color.multiplyScalar(0.8);
               m.copy(place(laneX(lane, lanes), DOOR_H * open * short, run.wallZ[w] + 0.05, DOOR_SCALE, DOOR_SCALE * (1 - open) * short, zs).matrix);
            }}
         />
         <DynamicInstancedModel
            asset={ASSETS.sliding}
            count={WALL_SLOTS * lanes}
            update={(i, m) => {
               const w = slotWall(run, Math.floor(i / lanes));
               if (w === NONE) return false;
               const lane = i % lanes;
               if (doorAt(run, w, lane) !== DOOR_SHUT) return false;
               if (run.result[w] === WALL.opened) return false;
               m.copy(place(laneX(lane, lanes), 0, run.wallZ[w] + 0.05, SHUT_SCALE_X, SHUT_SCALE_Y, 1.4).matrix);
            }}
         />
      </>
   );
}

/** The glyphs on every coloured door and on every lamp's globe, one pool per shape. */
function Glyphs({ run, lamps }: { run: DoorRun; lamps: LampSpot[] }) {
   const c = run.course;
   const lanes = c.lanes;
   const geos = useMemo(() => SHAPES.map(glyphGeometry), []);
   const mat = useMemo(() => new MeshBasicMaterial({ toneMapped: false, side: DoubleSide }), []);
   useEffect(
      () => () => {
         geos.forEach((g) => g.dispose());
         mat.dispose();
      },
      [geos, mat],
   );
   const doorCount = WALL_SLOTS * lanes;
   return (
      <>
         {SHAPES.map((_s, si) => (
            <Pool
               key={si}
               geometry={geos[si]}
               material={mat}
               tinted
               count={doorCount + LAMP_SLOTS}
               update={(i, color) => {
                  if (i < doorCount) {
                     const w = slotWall(run, Math.floor(i / lanes));
                     if (w === NONE) return false;
                     const lane = i % lanes;
                     const d = doorAt(run, w, lane);
                     const col = d === DOOR_CRACKED ? run.crackColor[w] : d;
                     if (col < 0 || col !== si) return false;
                     const open = doorOpen(run, w, lane);
                     if (open > 0.6) return false;
                     const def = wallDef(run, w);
                     const short = def && def.upper === lane ? 0.8 : 1;
                     color.copy(GLOWS[col]);
                     return place(laneX(lane, lanes), DOOR_H * (0.6 * short + open * 0.4), run.wallZ[w] + 0.35, 0.55, 0.55, 1);
                  }
                  const spot = lamps[i - doorCount];
                  if (!spot || !spot.on || spot.color !== si) return false;
                  color.copy(WHITE);
                  if (spot.dim) color.multiplyScalar(0.25);
                  return place(spot.x, spot.y - 0.95, spot.z + 0.02, 0.62, 0.62, 1);
               }}
            />
         ))}
      </>
   );
}

/** A lamp drawn this frame (filled by Lamps' frame callback, read by Glyphs). */
interface LampSpot {
   on: boolean;
   x: number;
   y: number;
   z: number;
   color: number;
   dim: boolean;
   not: boolean;
   echo: boolean;
}

const LAMP_SLOTS = 5;
export const LAMP_Y = 4.3;

function lampsOf(run: DoorRun, out: LampSpot[], now: number): void {
   const c = run.course;
   let n = 0;
   const put = (wall: number, z: number, echo: boolean, x: number) => {
      if (n >= out.length) return;
      if (z < run.hero.z - AHEAD || z > run.hero.z + 25) return;
      const s = out[n++];
      const def = wallDef(run, wall);
      const mode = run.wallMode[wall];
      s.on = true;
      s.x = x;
      s.y = LAMP_Y;
      s.z = z;
      s.color = cueColorAt(run, wall, Math.floor(now * 1000));
      s.dim = !!def && def.dim;
      s.not = mode === 2;
      s.echo = echo;
   };
   const from = firstSlot(run);
   for (let w = from; w < Math.min(run.wallCount, from + WALL_SLOTS + 1); w++) {
      if (run.result[w] === WALL.opened) continue;
      const def = wallDef(run, w);
      if (def) {
         const lamp = c.lamps[w];
         put(w, lamp.z, lamp.echo, lamp.echo ? 2.2 : 0);
      } else put(w, run.wallZ[w] + LAMP_AHEAD, false, 0);
   }
   for (let i = n; i < out.length; i++) out[i].on = false;
}

function Lamps({ run, spots }: { run: DoorRun; spots: LampSpot[] }) {
   const time = useGameTime();
   const sphere = useMemo(() => new OctahedronGeometry(0.5, 3), []);
   const glowMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
   const halo = useMemo(() => new CircleGeometry(1, 24), []);
   const haloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), []);
   const bar = useMemo(() => new BoxGeometry(1, 1, 1), []);
   const chainMat = useMemo(() => new MeshStandardMaterial({ color: "#3f3a36", roughness: 0.6, metalness: 0.6 }), []);
   const crossMat = useMemo(() => new MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
   const ring = useMemo(() => new TorusGeometry(0.85, 0.07, 6, 28), []);
   const ringMat = useMemo(() => new MeshBasicMaterial({ color: "#fde68a", toneMapped: false }), []);
   useEffect(
      () => () => {
         [sphere, halo, bar, ring].forEach((g) => g.dispose());
         [glowMat, haloMat, chainMat, crossMat, ringMat].forEach((m) => m.dispose());
      },
      [sphere, halo, bar, ring, glowMat, haloMat, chainMat, crossMat, ringMat],
   );
   useFrame(() => lampsOf(run, spots, time.now), -0.2);
   const swing = (i: number) => Math.sin(time.now * 1.6 + i) * 0.06;
   const ls = LANTERN_H / GLB_SIZE.lantern.y;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.lantern}
            count={LAMP_SLOTS}
            update={(i, m) => {
               const s = spots[i];
               if (!s?.on) return false;
               m.copy(place(s.x, s.y - 0.35, s.z, ls, ls, ls, 0, 0, swing(i)).matrix);
            }}
         />
         {/* the globe in the rule's colour (dim for the sound rule) and its halo */}
         <Pool
            geometry={sphere}
            material={glowMat}
            tinted
            count={LAMP_SLOTS}
            update={(i, color) => {
               const s = spots[i];
               if (!s?.on) return false;
               color.copy(COLORS[s.color]).lerp(WHITE, 0.15);
               if (s.dim) color.multiplyScalar(0.22);
               return place(s.x, s.y + 0.35, s.z + 0.05, 0.6, 0.6, 0.6);
            }}
         />
         <Pool
            geometry={halo}
            material={haloMat}
            tinted
            order={2}
            count={LAMP_SLOTS}
            update={(i, color) => {
               const s = spots[i];
               if (!s?.on) return false;
               color.copy(COLORS[s.color]);
               const k = s.dim ? 0.15 : 0.8 + 0.2 * Math.sin(time.now * 6 + i);
               color.multiplyScalar(k);
               return place(s.x, s.y + 0.3, s.z + 0.2, 1.4, 1.4, 1);
            }}
         />
         {/* the chain up into the dark */}
         <Pool
            geometry={bar}
            material={chainMat}
            count={LAMP_SLOTS}
            update={(i) => {
               const s = spots[i];
               if (!s?.on) return false;
               return place(s.x, s.y + 3.4, s.z, 0.06, 5, 0.06, 0, 0, swing(i));
            }}
         />
         {/* NOT: the lamp is crossed out (two white bars over the globe) */}
         <Pool
            geometry={bar}
            material={crossMat}
            count={LAMP_SLOTS * 2}
            update={(i) => {
               const s = spots[i >> 1];
               if (!s?.on || !s.not) return false;
               return place(s.x, s.y + 0.35, s.z + 0.45, 1.5, 0.16, 0.05, 0, 0, (i & 1 ? 1 : -1) * 0.785);
            }}
         />
         {/* echo: a double gold ring round the globe (it is the rule for the wall after next) */}
         <Pool
            geometry={ring}
            material={ringMat}
            count={LAMP_SLOTS * 2}
            update={(i) => {
               const s = spots[i >> 1];
               if (!s?.on || !s.echo) return false;
               const k = i & 1 ? 1.25 : 1;
               return place(s.x, s.y + 0.35, s.z + 0.1, k, k, k, time.now * (i & 1 ? 1.2 : -1.6));
            }}
         />
      </>
   );
}

/** Level 1's floor arrows: the lamp's colour painted down every lane before the wall. */
function FloorArrows({ run }: { run: DoorRun }) {
   const c = run.course;
   const lanes = c.lanes;
   const geo = useMemo(chevronGeometry, []);
   const mat = useMemo(() => new MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }), []);
   useEffect(
      () => () => {
         geo.dispose();
         mat.dispose();
      },
      [geo, mat],
   );
   const any = c.walls.some((w) => w.floorArrows);
   if (!any) return null;
   const per = lanes * 4;
   return (
      <Pool
         geometry={geo}
         material={mat}
         tinted
         order={1}
         count={3 * per}
         update={(i, color) => {
            const w = run.nextWall + Math.floor(i / per);
            const def = wallDef(run, w);
            if (!def || !def.floorArrows) return false;
            const k = i % per;
            const lane = k % lanes;
            const row = Math.floor(k / lanes);
            color.copy(COLORS[run.ruleColor[w]]);
            return place(laneX(lane, lanes), 0.02, def.z + 9 + row * 2.2, 1, 1, 1);
         }}
      />
   );
}

function Orbs({ run }: { run: DoorRun }) {
   const c = run.course;
   const time = useGameTime();
   const s = ORB_H / GLB_SIZE.orb.y;
   const HIDDEN = useMemo(() => new Color("#fde68a"), []);
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={c.orbs.length}
         tinted
         update={(i, m, color) => {
            if (run.collected[i]) return false;
            const o = c.orbs[i];
            const h = run.hero;
            if (o.z < h.z - AHEAD || o.z > h.z + 10) return false;
            if (o.hidden && !(run.simMs < h.magnetUntil)) return false;
            if (o.hidden) color.copy(HIDDEN);
            const bob = Math.sin(time.now * 2.6 + i) * 0.08;
            m.copy(place(o.x, o.y - ORB_H / 2 + bob, o.z, s, s, s, time.now * 2 + i).matrix);
         }}
      />
   );
}

function Hazards({ run }: { run: DoorRun }) {
   const c = run.course;
   const look = LOOKS[c.level];
   const time = useGameTime();
   const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.08), []);
   const hot = useMemo(() => new MeshStandardMaterial({ color: "#7f1d1d", emissive: "#f97316", emissiveIntensity: 1.1, roughness: 0.4 }), []);
   const beam = useMemo(() => new MeshStandardMaterial({ color: "#3f3f46", emissive: "#facc15", emissiveIntensity: 0.35, roughness: 0.5, metalness: 0.4 }), []);
   const cone = useMemo(() => new ConeGeometry(0.22, 1, 10, 1, true), []);
   const flame = useMemo(() => new MeshBasicMaterial({ color: "#fb923c", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), []);
   const grate = useMemo(() => new MeshStandardMaterial({ color: "#1c1917", emissive: look.ember, emissiveIntensity: 0.18, roughness: 0.8, metalness: 0.4 }), [look]);
   useEffect(
      () => () => {
         [geo, cone].forEach((g) => g.dispose());
         [hot, beam, flame, grate].forEach((m) => m.dispose());
      },
      [geo, cone, hot, beam, flame, grate],
   );
   const width = c.half * 2;
   const near = (z: number) => z >= run.hero.z - AHEAD && z <= run.hero.z + 12;
   return (
      <>
         <Pool
            geometry={geo}
            material={hot}
            count={c.bars.length * 1 + 2}
            update={(i) => {
               if (i < c.bars.length) {
                  const b = c.bars[i];
                  if (b.kind !== "bar" || !near(b.z)) return false;
                  return place(0, 0.22, b.z, width, 0.42, 0.42);
               }
               // Flicker's fire wave (a bar of flame) and his lane of fire
               const hz = run.hazard;
               if (!hz.live) return false;
               if (i === c.bars.length && hz.kind === 0) return place(0, 0.25 + Math.sin(time.now * 20) * 0.04, hz.z, width, 0.5, 0.5);
               if (i === c.bars.length + 1 && hz.kind === 2) return place(laneX(hz.lane, c.lanes), 0.15, hz.z - 2.5, LANE_W * 0.9, 0.3, 6);
               return false;
            }}
         />
         <Pool
            geometry={geo}
            material={beam}
            count={c.bars.length + 1}
            update={(i) => {
               if (i < c.bars.length) {
                  const b = c.bars[i];
                  if (b.kind !== "beam" || !near(b.z)) return false;
                  return place(0, 1.35, b.z, width + 0.4, 0.5, 0.5);
               }
               const hz = run.hazard;
               if (!hz.live || hz.kind !== 1) return false;
               return place(0, 1.3 + Math.sin(time.now * 14) * 0.05, hz.z, width + 0.4, 0.4, 0.4);
            }}
         />
         {/* Kiro's flame vents: a glowing grate and four jets */}
         <Pool
            geometry={geo}
            material={grate}
            count={c.vents.length}
            update={(i) => {
               const v = c.vents[i];
               if (!near(v.z0)) return false;
               return place(laneX(v.lane, c.lanes), 0.02, (v.z0 + v.z1) / 2, LANE_W * 0.8, 0.06, v.z0 - v.z1);
            }}
         />
         <Pool
            geometry={cone}
            material={flame}
            count={c.vents.length * 4 + 6}
            order={3}
            update={(i) => {
               if (i < c.vents.length * 4) {
                  const v = c.vents[Math.floor(i / 4)];
                  if (!near(v.z0)) return false;
                  const k = i % 4;
                  const z = v.z0 - ((k + 0.5) / 4) * (v.z0 - v.z1);
                  const hgt = 1.3 + 0.5 * Math.sin(time.now * 11 + i * 1.7);
                  return place(laneX(v.lane, c.lanes) + (k % 2 ? 0.35 : -0.35), hgt / 2, z, 1, hgt, 1);
               }
               // Flicker's fire: flames along the wave or the lane
               const hz = run.hazard;
               if (!hz.live) return false;
               const k = i - c.vents.length * 4;
               const hgt = 1.4 + 0.5 * Math.sin(time.now * 13 + k);
               if (hz.kind === 2) return place(laneX(hz.lane, c.lanes), hgt / 2, hz.z - k, 1.3, hgt, 1.3);
               if (hz.kind === 0) return place(-c.half + ((k + 0.5) / 6) * width, hgt * 0.4, hz.z, 1.2, hgt * 0.8, 1.2);
               return place(-c.half + ((k + 0.5) / 6) * width, 1.3, hz.z, 1, 0.8, 1, 0, 0, 0);
            }}
         />
      </>
   );
}

function Pads({ run }: { run: DoorRun }) {
   const c = run.course;
   const s = (LANE_W * 0.75) / GLB_SIZE.pad.x;
   return (
      <DynamicInstancedModel
         asset={ASSETS.pad}
         count={c.pads.length}
         update={(i, m) => {
            const p = c.pads[i];
            if (p.z < run.hero.z - AHEAD || p.z > run.hero.z + 12) return false;
            m.copy(place(laneX(p.lane, c.lanes), 0.01, p.z, s, s, s).matrix);
         }}
      />
   );
}

function Secrets({ run }: { run: DoorRun }) {
   const c = run.course;
   const time = useGameTime();
   const shard = useMemo(() => new OctahedronGeometry(0.32, 0), []);
   const disc = useMemo(() => new CylinderGeometry(0.42, 0.42, 0.08, 24), []);
   const shardMat = useMemo(() => new MeshStandardMaterial({ color: "#fecaca", emissive: "#ef4444", emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.3 }), []);
   const stickerMat = useMemo(() => new MeshStandardMaterial({ color: "#fbcfe8", emissive: "#ec4899", emissiveIntensity: 1, roughness: 0.4 }), []);
   useEffect(
      () => () => {
         shard.dispose();
         disc.dispose();
         shardMat.dispose();
         stickerMat.dispose();
      },
      [shard, disc, shardMat, stickerMat],
   );
   const list = SECRETS[c.level];
   return (
      <>
         {list.map((spec, i) => {
            const sticker = spec.kind === "sticker";
            return (
               <Pool
                  key={spec.id}
                  geometry={sticker ? disc : shard}
                  material={sticker ? stickerMat : shardMat}
                  count={1}
                  update={() => {
                     if (run.secrets.found[i]) return false;
                     const s = c.secrets[i];
                     if (s.z < run.hero.z - AHEAD) return false;
                     const bob = Math.sin(time.now * 2 + i) * 0.1;
                     return place(s.x, s.y + bob, s.z, 1, 1, 1, time.now * 1.8, sticker ? Math.PI / 2 : 0);
                  }}
               />
            );
         })}
      </>
   );
}

/** Riko's cracked fake doors: glowing crack lines over the door; Vexa's ghost doors: a faint shimmer. */
function Overlays({ run }: { run: DoorRun }) {
   const c = run.course;
   const lanes = c.lanes;
   const time = useGameTime();
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   const crack = useMemo(() => {
      const s = new Shape();
      const pts = [
         [0, 1],
         [0.12, 0.62],
         [-0.08, 0.4],
         [0.18, 0.08],
         [0.02, -0.25],
         [0.2, -0.6],
         [0.05, -1],
         [-0.06, -0.6],
         [-0.16, -0.25],
         [-0.02, 0.08],
         [-0.25, 0.4],
         [-0.04, 0.62],
      ];
      s.moveTo(pts[0][0] * 0.4, pts[0][1] * 0.5);
      for (const p of pts.slice(1)) s.lineTo(p[0] * 0.4, p[1] * 0.5);
      s.closePath();
      return new ShapeGeometry(s);
   }, []);
   const crackMat = useMemo(() => new MeshBasicMaterial({ color: "#fdba74", toneMapped: false, side: DoubleSide }), []);
   const ghostMat = useMemo(() => new MeshBasicMaterial({ color: "#c4b5fd", transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide }), []);
   useEffect(
      () => () => {
         plane.dispose();
         crack.dispose();
         crackMat.dispose();
         ghostMat.dispose();
      },
      [plane, crack, crackMat, ghostMat],
   );
   const find = (w: number, kind: number) => {
      for (let l = 0; l < lanes; l++) if (doorAt(run, w, l) === kind) return l;
      return NONE;
   };
   return (
      <>
         <Pool
            geometry={crack}
            material={crackMat}
            count={WALL_SLOTS * 2}
            update={(i) => {
               const w = slotWall(run, i >> 1);
               if (w === NONE || run.result[w] === WALL.smashed) return false;
               const l = find(w, DOOR_CRACKED);
               if (l === NONE) return false;
               const k = i & 1;
               return place(laneX(l, lanes) + (k ? 0.35 : -0.3), DOOR_H * (k ? 0.35 : 0.62), run.wallZ[w] + 0.34, k ? 1.1 : 1.4, k ? 1.4 : 1.8, 1, 0, 0, k ? 0.6 : -0.25);
            }}
         />
         <Pool
            geometry={plane}
            material={ghostMat}
            count={WALL_SLOTS}
            order={4}
            update={(i, color) => {
               const w = slotWall(run, i);
               if (w === NONE || run.result[w] === WALL.ghost) return false;
               const l = find(w, DOOR_GHOST);
               if (l === NONE) return false;
               // hard to spot: a faint ripple, a little stronger while Vexa's phase is up
               const phase = run.simMs < run.hero.phaseUntil;
               color.copy(WHITE).multiplyScalar((phase ? 0.9 : 0.25) + 0.2 * Math.sin(time.now * 5));
               return place(laneX(l, lanes), DOOR_H / 2, run.wallZ[w] + 0.33, LANE_W - 0.5, DOOR_H - 0.1, 1);
            }}
            tinted
         />
      </>
   );
}

/** The finish gate: a big stone arch with the ember trim and a glowing pad (level 5: once Flicker is down). */
function Finish({ run }: { run: DoorRun }) {
   const ref = useRef<Group>(null);
   const c = run.course;
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const show = !bossAlive(run) && run.finishGate > run.hero.z - AHEAD;
      g.visible = show;
      g.position.set(0, 0, run.finishGate);
   });
   // the arch's opening spans the whole hall
   const sx = (c.half * 2 + 0.4) / 1.6;
   const sy = Math.min(sx, 3);
   return (
      <group ref={ref}>
         <group scale={[sx, sy, 1.5]}>
            <ArchWall color={LOOKS[c.level].stone} accent="#facc15" />
         </group>
         <group position={[0, 0.02, -4]} scale={1.6}>
            <CheckpointPad accent="#facc15" />
         </group>
      </group>
   );
}

/** Level 5: Flicker (x4), his three flames behind the doors (phase 3), his open ring. */
function Flicker({ run }: { run: DoorRun }) {
   const time = useGameTime();
   const s = SPIRIT_SCALE;
   const ring = useMemo(() => new TorusGeometry(3.2, 0.12, 8, 40), []);
   const ringMat = useMemo(() => new MeshBasicMaterial({ color: "#fde68a", transparent: true, opacity: 0.8, toneMapped: false }), []);
   useEffect(
      () => () => {
         ring.dispose();
         ringMat.dispose();
      },
      [ring, ringMat],
   );
   const lanes = run.course.lanes;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.spirit}
            count={4}
            tinted
            update={(i, m, color) => {
               const b = run.boss;
               if (!b || !run.bossOn) return false;
               const alive = bossAlive(run);
               const def = b.defeatMs >= 0 ? Math.min(1, b.defeatMs / 2000) : 0;
               if (i === 0) {
                  if (b.phase === 2 && alive && b.step !== "transition") return false;
                  if (def >= 1) return false;
                  const w = run.nextWall < run.wallCount ? run.nextWall : run.wallCount - 1;
                  const col = w >= 0 ? cueColorAt(run, w, run.simMs) : 0;
                  color.copy(COLORS[col]).lerp(WHITE, 0.35);
                  if (b.flashMs > 0) color.copy(WHITE).multiplyScalar(2);
                  const k = s * (1 - def) * (1 + 0.04 * Math.sin(time.now * 7));
                  const rear = b.step === "telegraph" ? 0.25 : 0;
                  m.copy(place(Math.sin(time.now * 0.8) * 1.2, 0.4 + Math.sin(time.now * 2) * 0.3, run.flick.z, k, k, k, 0, -rear).matrix);
                  return;
               }
               // phase 3: three flames, each behind a coloured door of the next arena wall
               if (b.phase !== 2 || !alive) return false;
               let w = NONE;
               for (let q = run.nextWall; q < run.wallCount; q++) {
                  if (run.slid[q] === 2) {
                     w = q;
                     break;
                  }
               }
               if (w === NONE) return false;
               let n = 0;
               for (let l = 0; l < lanes; l++) {
                  const d = doorAt(run, w, l);
                  if (d < 0) continue;
                  n++;
                  if (n !== i) continue;
                  color.copy(COLORS[d]).lerp(WHITE, 0.3);
                  if (b.flashMs > 0 && l === run.trueLane[w]) color.copy(WHITE).multiplyScalar(2);
                  m.copy(place(laneX(l, lanes), 0, run.wallZ[w] - 2.5, 1.3, 1.3 + 0.1 * Math.sin(time.now * 9 + l), 1.3).matrix);
                  return;
               }
               return false;
            }}
         />
         <Pool
            geometry={ring}
            material={ringMat}
            count={1}
            update={() => {
               if (!run.bossOn || !bossVulnerable(run) || run.boss!.phase === 2) return false;
               const k = 1 + 0.08 * Math.sin(time.now * 10);
               return place(0, 0.08, run.flick.z, k, k, k, 0, -Math.PI / 2);
            }}
         />
      </>
   );
}

export function Course({ run }: { run: DoorRun }): ReactNode {
   const spots = useMemo<LampSpot[]>(() => Array.from({ length: LAMP_SLOTS }, () => ({ on: false, x: 0, y: 0, z: 0, color: 0, dim: false, not: false, echo: false })), []);
   return (
      <>
         <WallBodies run={run} />
         <Doors run={run} />
         <Lamps run={run} spots={spots} />
         <Glyphs run={run} lamps={spots} />
         <FloorArrows run={run} />
         <Overlays run={run} />
         <Orbs run={run} />
         <Hazards run={run} />
         <Pads run={run} />
         <Secrets run={run} />
         <Finish run={run} />
         {run.course.boss ? <Flicker run={run} /> : null}
      </>
   );
}
