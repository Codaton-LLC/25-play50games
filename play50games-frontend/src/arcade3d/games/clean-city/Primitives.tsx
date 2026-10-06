"use client";

// Clean the City look: three outdoor grounds, the obstacle stand-ins and the litter stand-ins.
// Decoration only. Positions come from rules.ts MAPS (the same squares the runner collides with).
// A prop that may become a GLB is an <InstancedModel> whose fallback is the primitive; litter
// stand-ins are InstanceParts for <DynamicInstancedModel> (Scene.tsx), one pool per kind.
import { memo, useLayoutEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react";
import { BoxGeometry, CapsuleGeometry, CylinderGeometry, type Group } from "three";
import { InstancedModel, useModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot, type InstanceUpdate } from "@/arcade3d/core/render";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { bakedEffect, type BakedPart } from "./baked";
import { FLOOR_HALF, MAPS, type ObstacleKind } from "./rules";

// ---------- palette ----------

const COLORS = {
   path: "rgba(120, 84, 48, 0.34)",
   sandPath: "rgba(255, 255, 255, 0.22)",
   curb: "rgba(0, 0, 0, 0.14)",
   bench: "#c4a574",
   benchLeg: "#78716c",
   trunk: "#92400e",
   leaves: "#166534",
   bin: "#475569",
   binRim: "#94a3b8",
   facade: "#64748b",
   roof: "#334155",
   window: "#e2e8f0",
   pole: "#cbd5e1",
   lamp: "#fde68a",
   palm: "#15803d",
   palmTrunk: "#a16207",
   canopy: "#38bdf8",
   hoodie: "#f97316",
   headband: "#4ade80",
   skin: "#fdba74",
   pants: "#1e293b",
   shoe: "#0f172a",
} as const;

// ---------- grounds (one canvas each, drawn once) ----------

const TEX = 512;

/** World (x, z) -> canvas px. The plane is rotated -90° around x, so world +z is canvas up. */
function paintGround(ctx: CanvasRenderingContext2D, w: number, h: number, map: number): void {
   const color = MAPS[map].ground;
   ctx.fillStyle = color;
   ctx.fillRect(0, 0, w, h);

   ctx.strokeStyle = "rgba(255,255,255,0.12)";
   ctx.lineWidth = 2;
   const step = (2 / (FLOOR_HALF * 2)) * w;
   for (let p = step; p < w; p += step) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
      ctx.stroke();
   }

   const u = (x: number) => ((x + FLOOR_HALF) / (FLOOR_HALF * 2)) * w;
   // plane rotation -x maps texture +y to world +z (the camera side, the start pad)
   const v = (z: number) => ((z + FLOOR_HALF) / (FLOOR_HALF * 2)) * h;

   ctx.fillStyle = map === 2 ? COLORS.sandPath : COLORS.path;
   ctx.fillRect(u(-1.3), v(FLOOR_HALF), u(1.3) - u(-1.3), v(-2) - v(FLOOR_HALF));
   if (map === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let i = -3; i <= 3; i++) ctx.fillRect(u(i * 0.7 - 0.18), v(1.1), u(0.36) - u(0), v(-1.1) - v(1.1));
   }

   ctx.fillStyle = COLORS.curb;
   for (const o of MAPS[map].obstacles) {
      ctx.beginPath();
      ctx.ellipse(u(o.x), v(o.z), ((o.halfX + 0.15) / (FLOOR_HALF * 2)) * w, ((o.halfZ + 0.15) / (FLOOR_HALF * 2)) * h, 0, 0, Math.PI * 2);
      ctx.fill();
   }

   ctx.beginPath();
   ctx.arc(u(0), v(12), (1.05 / (FLOOR_HALF * 2)) * w, 0, Math.PI * 2);
   ctx.strokeStyle = "rgba(255,255,255,0.9)";
   ctx.lineWidth = 5;
   ctx.stroke();
}

const drawPark: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 0);
const drawCity: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 1);
const drawBeach: CanvasDraw = (ctx, w, h) => paintGround(ctx, w, h, 2);

function Ground({ draw }: { draw: CanvasDraw }) {
   const map = useCanvasTexture(TEX, TEX, draw);
   return (
      <mesh rotation-x={-Math.PI / 2} position-y={0} name="ground">
         <planeGeometry args={[FLOOR_HALF * 2, FLOOR_HALF * 2]} />
         <meshStandardMaterial map={map} roughness={1} />
      </mesh>
   );
}

// ---------- obstacle spots (module level: InstancedModel must not see a new array each render) ----------

function centres(map: number, kind: ObstacleKind): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const o of MAPS[map].obstacles) if (o.kind === kind) spots.push({ x: o.x, y: 0, z: o.z });
   return spots;
}

const PARK_BENCH = centres(0, "bench");
const PARK_TREE = centres(0, "tree");
const PARK_BIN = centres(0, "bin");
const CITY_BUILDING = centres(1, "building");
const CITY_LAMP = centres(1, "lamp");
const CITY_BIN = centres(1, "bin");
const BEACH_PALM = centres(2, "palm");
const BEACH_POLE = centres(2, "pole");
const BEACH_BIN = centres(2, "bin");

/** Box centres: the geometry is centred, so y is the centre, not the feet. */
const atY = (spots: readonly InstanceSpot[], y: number): InstanceSpot[] => spots.map((s) => ({ ...s, y }));

const BENCH_SEAT = atY(PARK_BENCH, 0.46);
const BENCH_BACK = PARK_BENCH.map((s) => ({ x: s.x, y: 0.78, z: s.z - 0.34 }));
const BENCH_LEGS = PARK_BENCH.flatMap((s) =>
   [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ x: s.x + sx * 0.95, y: 0.2, z: s.z + sz * 0.26 })))
);

/** GLB copies stand on y = 0 at `spots`. `fallback` is the primitive (usually several <Instanced>). */
function Prop({ asset, spots, fallback }: { asset: (typeof ASSETS)[keyof typeof ASSETS]; spots: readonly InstanceSpot[]; fallback: ReactNode }) {
   if (spots.length === 0) return null;
   return <InstancedModel asset={asset} spots={spots} fallback={fallback} />;
}

function Benches() {
   return (
      <Prop
         asset={ASSETS.bench}
         spots={PARK_BENCH}
         fallback={
            <>
               <Instanced spots={BENCH_SEAT} name="bench-seat">
                  <boxGeometry args={[2.4, 0.16, 0.8]} />
                  <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
               </Instanced>
               <Instanced spots={BENCH_BACK} name="bench-back">
                  <boxGeometry args={[2.4, 0.42, 0.1]} />
                  <meshStandardMaterial color={COLORS.bench} roughness={0.7} />
               </Instanced>
               <Instanced spots={BENCH_LEGS} name="bench-legs">
                  <boxGeometry args={[0.12, 0.4, 0.12]} />
                  <meshStandardMaterial color={COLORS.benchLeg} roughness={0.8} />
               </Instanced>
            </>
         }
      />
   );
}

function Trees() {
   return (
      <Prop
         asset={ASSETS.tree}
         spots={PARK_TREE}
         fallback={
            <>
               <Instanced spots={atY(PARK_TREE, 0.55)}>
                  <cylinderGeometry args={[0.7, 0.78, 1.1, 12]} />
                  <meshStandardMaterial color={COLORS.trunk} roughness={0.85} />
               </Instanced>
               <Instanced spots={atY(PARK_TREE, 1.45)}>
                  <sphereGeometry args={[0.95, 14, 12]} />
                  <meshStandardMaterial color={COLORS.leaves} roughness={0.8} />
               </Instanced>
            </>
         }
      />
   );
}

function Bins({ spots }: { spots: readonly InstanceSpot[] }) {
   return (
      <Prop
         asset={ASSETS.bin}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 0.5)}>
                  <cylinderGeometry args={[0.62, 0.7, 1.0, 14]} />
                  <meshStandardMaterial color={COLORS.bin} roughness={0.55} />
               </Instanced>
               <Instanced spots={atY(spots, 1.02)}>
                  <cylinderGeometry args={[0.7, 0.7, 0.08, 14]} />
                  <meshStandardMaterial color={COLORS.binRim} metalness={0.2} roughness={0.4} />
               </Instanced>
            </>
         }
      />
   );
}

const drawFacade: CanvasDraw = (ctx, w, h) => {
   ctx.fillStyle = COLORS.facade;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.roof;
   ctx.fillRect(0, 0, w, h * 0.12);
   ctx.fillStyle = COLORS.window;
   for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) ctx.fillRect(w * (0.16 + col * 0.26), h * (0.24 + row * 0.22), w * 0.14, h * 0.12);
   }
};

function Buildings() {
   const facade = useCanvasTexture(128, 128, drawFacade);
   const spots = CITY_BUILDING;
   return (
      <Prop
         asset={ASSETS.building}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 1.3)}>
                  <boxGeometry args={[3.2, 2.6, 3.2]} />
                  <meshStandardMaterial map={facade} roughness={0.8} />
               </Instanced>
               <Instanced spots={atY(spots, 2.7)}>
                  <boxGeometry args={[3.45, 0.22, 3.45]} />
                  <meshStandardMaterial color={COLORS.roof} roughness={0.7} />
               </Instanced>
            </>
         }
      />
   );
}

function Lamps() {
   const spots = CITY_LAMP;
   return (
      <Prop
         asset={ASSETS.lamp}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 0.85)}>
                  <cylinderGeometry args={[0.3, 0.34, 1.7, 10]} />
                  <meshStandardMaterial color={COLORS.pole} metalness={0.35} roughness={0.4} />
               </Instanced>
               <Instanced spots={atY(spots, 1.85)}>
                  <sphereGeometry args={[0.36, 12, 10]} />
                  <meshStandardMaterial color={COLORS.lamp} emissive={COLORS.lamp} emissiveIntensity={0.7} roughness={0.35} />
               </Instanced>
            </>
         }
      />
   );
}

function Palms() {
   const spots = BEACH_PALM;
   return (
      <Prop
         asset={ASSETS.palm}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 0.7)}>
                  <cylinderGeometry args={[0.5, 0.6, 1.4, 10]} />
                  <meshStandardMaterial color={COLORS.palmTrunk} roughness={0.85} />
               </Instanced>
               <Instanced spots={spots.map((s) => ({ ...s, y: 1.7, sy: 0.55 }))}>
                  <sphereGeometry args={[1.05, 12, 10]} />
                  <meshStandardMaterial color={COLORS.palm} roughness={0.75} />
               </Instanced>
            </>
         }
      />
   );
}

function Umbrellas() {
   const spots = BEACH_POLE;
   return (
      <Prop
         asset={ASSETS.umbrella}
         spots={spots}
         fallback={
            <>
               <Instanced spots={atY(spots, 0.8)}>
                  <cylinderGeometry args={[0.25, 0.25, 1.6, 8]} />
                  <meshStandardMaterial color={COLORS.pole} roughness={0.5} />
               </Instanced>
               <Instanced spots={atY(spots, 1.7)}>
                  <coneGeometry args={[1.15, 0.5, 14]} />
                  <meshStandardMaterial color={COLORS.canopy} roughness={0.55} />
               </Instanced>
            </>
         }
      />
   );
}

export const Park = memo(function Park() {
   return (
      <group name="park">
         <Ground draw={drawPark} />
         <Benches />
         <Trees />
         <Bins spots={PARK_BIN} />
      </group>
   );
});

export const City = memo(function City() {
   return (
      <group name="city">
         <Ground draw={drawCity} />
         <Buildings />
         <Lamps />
         <Bins spots={CITY_BIN} />
      </group>
   );
});

export const Beach = memo(function Beach() {
   return (
      <group name="beach">
         <Ground draw={drawBeach} />
         <Palms />
         <Umbrellas />
         <Bins spots={BEACH_BIN} />
      </group>
   );
});

// ---------- litter pools ----------

/**
 * One moving pool. A listed GLB is instanced one mesh at a time from clones, so the loader
 * cache stays. The clones are created in the layout effect and disposed in its cleanup: a
 * strict-mode replay frees that set and the next run builds another, instead of disposing a
 * useMemo copy that the meshes still hold.
 */
export function LitterKind({ asset, count, update, standIn }: { asset: ModelAsset; count: number; update: InstanceUpdate; standIn: ReactNode }) {
   const { scene, failed } = useModel(asset);
   const [baked, setBaked] = useState<BakedPart[] | null>(null);
   useLayoutEffect(() => {
      if (!scene) return;
      return bakedEffect(scene, asset, setBaked);
   }, [scene, asset]);
   if (failed || !baked || baked.length === 0) return <>{standIn}</>;
   return (
      <>
         {baked.map((part, i) => (
            <DynamicInstanced key={`${asset.id}-${i}`} count={count} update={update} name={`${asset.id}-${i}`}>
               <primitive object={part.geo} attach="geometry" />
               <primitive object={part.mat} attach="material" />
            </DynamicInstanced>
         ))}
      </>
   );
}

/** Stand-in shapes, bottom on y = 0, about 0.9 tall. Shared for the page: R3F does not dispose primitives. */
const STAND_IN_GEO = [
   new CylinderGeometry(0.16, 0.22, 0.9, 12).translate(0, 0.45, 0),
   new BoxGeometry(0.62, 0.8, 0.46).translate(0, 0.4, 0),
   new CylinderGeometry(0.22, 0.24, 0.85, 12).translate(0, 0.425, 0),
   new CapsuleGeometry(0.12, 0.55, 4, 8).rotateZ(0.7).translate(0, 0.28, 0),
];
const STAND_IN_COLOR = ["#4ade80", "#d6a46b", "#94a3b8", "#facc15"];
const STAND_IN_NAME = ["bottle-standin", "bag-standin", "can-standin", "banana-standin"];

/** Stand-in for one kind (0 bottle, 1 bag, 2 can, 3 banana). */
export function LitterStandIn({ kind, count, update }: { kind: number; count: number; update: InstanceUpdate }) {
   return (
      <DynamicInstanced count={count} update={update} name={STAND_IN_NAME[kind] ?? "litter-standin"}>
         <primitive object={STAND_IN_GEO[kind] ?? STAND_IN_GEO[0]} attach="geometry" />
         <meshStandardMaterial color={STAND_IN_COLOR[kind] ?? STAND_IN_COLOR[0]} roughness={0.5} />
      </DynamicInstanced>
   );
}

// ---------- the runner (one body; the core rig replaces this component) ----------

/** Limb pivots. The parent writes rotation.x from the one walk phase. Arms hang down. */
export interface RunnerLimbs {
   legL: Group | null;
   legR: Group | null;
   armL: Group | null;
   armR: Group | null;
   bob: Group | null;
}

/** Vinyl-toy runner, arms down. Scene swings these groups from the shared humanoid pose. */
export function PrimitiveRunner({ limbs }: { limbs: MutableRefObject<RunnerLimbs> }) {
   const set = (key: keyof RunnerLimbs) => (g: Group | null) => {
      limbs.current[key] = g;
   };
   return (
      <group ref={set("bob")} name="runner-body">
         <mesh position={[0, 0.5, 0]} castShadow={false}>
            <boxGeometry args={[0.4, 0.36, 0.24]} />
            <meshStandardMaterial color={COLORS.hoodie} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.74, 0]}>
            <sphereGeometry args={[0.16, 14, 12]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.6} />
         </mesh>
         <mesh position={[0, 0.84, 0]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.155, 0.03, 6, 14]} />
            <meshStandardMaterial color={COLORS.headband} roughness={0.4} />
         </mesh>
         <mesh position={[0, 0.74, 0.13]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshStandardMaterial color={COLORS.shoe} />
         </mesh>
         <group ref={set("legL")} position={[-0.1, 0.34, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
               <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("legR")} position={[0.1, 0.34, 0]}>
            <mesh position={[0, -0.16, 0]}>
               <capsuleGeometry args={[0.07, 0.2, 4, 8]} />
               <meshStandardMaterial color={COLORS.pants} roughness={0.7} />
            </mesh>
         </group>
         <group ref={set("armL")} position={[-0.26, 0.6, 0]}>
            <mesh position={[0, -0.14, 0]}>
               <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
               <meshStandardMaterial color={COLORS.hoodie} roughness={0.55} />
            </mesh>
         </group>
         <group ref={set("armR")} position={[0.26, 0.6, 0]}>
            <mesh position={[0, -0.14, 0]}>
               <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
               <meshStandardMaterial color={COLORS.hoodie} roughness={0.55} />
            </mesh>
         </group>
      </group>
   );
}

export const RUNNER_RING = "#4ade80";
