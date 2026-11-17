"use client";

// The per-level set pieces (looks.ts decorSpots): L2's boardwalk, L3's hotels / deck chairs / pool,
// L4's slide flumes and ring floats, L5's rain. Purely visual: nothing here is solid or interactive,
// and every spot sits outside the play rectangle (variety.test.ts proves it).
import { useMemo } from "react";
import { BoxGeometry, CylinderGeometry, Matrix4, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, type BufferGeometry } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { createRng } from "@/arcade3d/core/math";
import { DynamicInstanced, Instanced, spotMatrix, type InstancePart } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { decorSpots, type DecorSpots } from "./looks";
import { BeachChairPrimitive } from "./Primitives";

// ---------- L2 Busy Beach: a low boardwalk along the back of the sand ----------

function Boardwalk({ spots }: { spots: DecorSpots["boardwalk"] }) {
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots} name="boardwalk">
         <boxGeometry args={[2.2, 0.1, 1.0]} />
         <meshStandardMaterial color="#a16207" roughness={0.8} />
      </Instanced>
   );
}

// ---------- L3 Resort: hotel blocks past both ends, deck chairs and a low pool on the terrace ----------

function Hotels({ spots }: { spots: DecorSpots["hotels"] }) {
   if (spots.length === 0) return null;
   return (
      <>
         <Instanced spots={spots} name="hotel-body">
            <boxGeometry args={[3.6, 2.8, 3.0]} />
            <meshStandardMaterial color="#fde68a" roughness={0.7} />
         </Instanced>
         <Instanced spots={spots} name="hotel-glass">
            <boxGeometry args={[3.7, 0.7, 3.1]} />
            <meshStandardMaterial color="#7dd3fc" roughness={0.2} />
         </Instanced>
         <Instanced spots={spots} name="hotel-roof">
            <boxGeometry args={[4.0, 0.5, 3.4]} />
            <meshStandardMaterial color="#b45309" roughness={0.6} />
         </Instanced>
      </>
   );
}

function DeckChairs({ spots }: { spots: DecorSpots["deckChairs"] }) {
   if (spots.length === 0) return null;
   return (
      <InstancedModel
         asset={ASSETS.chair}
         spots={spots}
         fallback={spots.map((s, i) => (
            <group key={i} position={[s.x, s.y, s.z]} rotation-y={s.rotY ?? 0} scale={s.scale ?? 1}>
               <BeachChairPrimitive />
            </group>
         ))}
      />
   );
}

/** The resort's low pool basin on the terrace: four rim walls and a water surface. */
function Pool({ pool }: { pool: NonNullable<DecorSpots["pool"]> }) {
   const rim = 0.28;
   const h = 0.42;
   const wall = (w: number, d: number, x: number, z: number) => (
      <mesh key={`${x}-${z}`} position={[pool.x + x, h / 2, pool.z + z]}>
         <boxGeometry args={[w, h, d]} />
         <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
   );
   return (
      <group>
         {wall(pool.w, rim, 0, pool.d / 2 - rim / 2)}
         {wall(pool.w, rim, 0, -pool.d / 2 + rim / 2)}
         {wall(rim, pool.d - rim * 2, pool.w / 2 - rim / 2, 0)}
         {wall(rim, pool.d - rim * 2, -pool.w / 2 + rim / 2, 0)}
         <mesh position={[pool.x, h - 0.08, pool.z]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[pool.w - rim, pool.d - rim]} />
            <meshStandardMaterial color="#22d3ee" roughness={0.15} transparent opacity={0.92} />
         </mesh>
      </group>
   );
}

// ---------- L4 Waterpark: slide flumes past both beach ends, ring floats on the back sand ----------

const SLIDE_ARC = Math.PI * 0.66;
/** the flume's hump: a torus arc in a vertical plane, both ends up on support columns */
const SLIDE_FLUME: BufferGeometry = new TorusGeometry(3.0, 0.5, 10, 26, SLIDE_ARC).rotateZ(-SLIDE_ARC / 2);
const SLIDE_LEG_X = 3.0 * Math.cos(SLIDE_ARC / 2);
const SLIDE_LEG_H = 3.0 * Math.sin(SLIDE_ARC / 2) - 0.55;
const SLIDE_MID_H = 3.0 - 0.55;

function slidePart(geo: BufferGeometry, x: number, y: number): InstancePart {
   return {
      geometry: geo,
      material: new MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 }),
      locals: [new Matrix4().makeTranslation(x, y, 0)],
   };
}

const SLIDE_PARTS: InstancePart[] = [
   { geometry: SLIDE_FLUME, material: new MeshStandardMaterial({ color: "#f472b6", roughness: 0.35 }) },
   slidePart(new CylinderGeometry(0.14, 0.18, SLIDE_LEG_H, 8), -SLIDE_LEG_X, SLIDE_LEG_H / 2),
   slidePart(new CylinderGeometry(0.14, 0.18, SLIDE_LEG_H, 8), SLIDE_LEG_X, SLIDE_LEG_H / 2),
   slidePart(new CylinderGeometry(0.14, 0.18, SLIDE_MID_H, 8), 0, SLIDE_MID_H / 2),
];

const SLIDE_M = new Matrix4();

function Slides({ spots }: { spots: DecorSpots["slides"] }) {
   const place = (i: number, m: Matrix4) => {
      const s = spots[i];
      if (!s) return false;
      spotMatrix(s, SLIDE_M);
      m.copy(SLIDE_M);
      return true;
   };
   if (spots.length === 0) return null;
   return <DynamicInstanced count={spots.length} update={place} parts={SLIDE_PARTS} name="slides" />;
}

/** a ring float lying flat on the sand */
const RING_GEO = new TorusGeometry(0.5, 0.16, 10, 24).rotateX(-Math.PI / 2);

function Rings({ spots }: { spots: DecorSpots["rings"] }) {
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots} name="rings">
         <primitive object={RING_GEO} attach="geometry" />
         <meshStandardMaterial color="#fb7185" roughness={0.4} />
      </Instanced>
   );
}

// ---------- L5 Stormy Beach: the rain sheet ----------

const RAIN_COUNT = 240;
const RAIN_X = 27;
const RAIN_Z_MIN = -25;
const RAIN_Z_MAX = 12;
const RAIN_H = 13;

const RAIN_PARTS: InstancePart[] = [
   {
      geometry: new BoxGeometry(0.02, 0.6, 0.02).rotateZ(0.12),
      material: new MeshBasicMaterial({ color: "#93c5fd", transparent: true, opacity: 0.33, depthWrite: false }),
   },
];

/** Rain streaks falling over the whole arena; fixed world box, each drop wraps to the top. */
export function Rain() {
   const time = useGameTime();
   const drops = useMemo(() => {
      const rng = createRng(9917);
      return Array.from({ length: RAIN_COUNT }, () => ({
         x: (rng() * 2 - 1) * RAIN_X,
         z: RAIN_Z_MIN + rng() * (RAIN_Z_MAX - RAIN_Z_MIN),
         phase: rng() * RAIN_H,
         speed: 15 + rng() * 6,
      }));
   }, []);
   const place = (i: number, m: Matrix4) => {
      const d = drops[i];
      const fall = (time.now * d.speed + d.phase) % RAIN_H;
      m.makeTranslation(d.x, RAIN_H - fall, d.z);
      return true;
   };
   return <DynamicInstanced count={RAIN_COUNT} update={place} parts={RAIN_PARTS} name="rain" />;
}

// ---------- all of a level's set pieces ----------

export default function SetPieces({ id }: { id: LevelId }) {
   const d = useMemo(() => decorSpots(id), [id]);
   return (
      <>
         <Boardwalk spots={d.boardwalk} />
         <Hotels spots={d.hotels} />
         <DeckChairs spots={d.deckChairs} />
         {d.pool && <Pool pool={d.pool} />}
         <Slides spots={d.slides} />
         <Rings spots={d.rings} />
      </>
   );
}
