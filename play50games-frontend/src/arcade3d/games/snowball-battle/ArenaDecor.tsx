"use client";

// The level arenas' own look (levels 2-5; level 1 keeps Yard.tsx's drawing): themed forts, the centre
// cover, the ice and drift patches and the scenery past the fence. Collision stays in rules.ts: every
// fort drawn here stays inside its 1.80 m square and under its rules height (fortHeight).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Matrix4, Object3D, Quaternion, Vector3, type Group, type InstancedMesh } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { FittedView } from "@/arcade3d/core/view";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { ModelAsset } from "@/arcade3d/core/types";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { BlobShadow } from "@/arcade3d/core/render/BlobShadow";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, DECOR_ASSETS, DECOR_GLB, IGLOO_GLB, SNOWMAN_BIG_GLB, TEAM, type DecorModelId } from "./assets";
import { CENTRE, DECOR, DRIFT_LOOK, FLOOD_LIGHTS, ICE_LOOK, THEMES, type DecorKind, type DecorSpot } from "./arenaLooks";
import type { ArenaTheme, SnowLevel } from "./levels";
import { snowmanCovers } from "./looks";
import { FORT, fortHeight, type Run } from "./rules";

const STUB = 0.14;
/** The fort's drawn height at this HP: its rules height, a low stub when crumbled. */
export function drawnFortHeight(hp: number): number {
   return hp >= 1 ? fortHeight(hp) : STUB;
}

/** Quarter turns only, so a wall turned toward the snowman stays inside its axis-aligned square. */
export function quarterYaw(x: number, z: number): number {
   return Math.round(Math.atan2(-x, -z) / (Math.PI / 2)) * (Math.PI / 2);
}

/** U-shaped wall segments (local, opening +z toward the snowman): x, z, width, depth. Inside ±0.9. */
export const WALL_SEGMENTS: readonly (readonly [number, number, number, number])[] = [
   [0, -0.62, 1.74, 0.5],
   [-0.64, 0.12, 0.46, 1.02],
   [0.64, 0.12, 0.46, 1.02],
];
/** Merlons on the back wall (snow fort theme): x offsets. */
const MERLONS = [-0.6, 0, 0.6] as const;

const DUMMY = new Object3D();
const HIDE = new Matrix4().makeScale(0, 0, 0);

function place(mesh: InstancedMesh, i: number, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number): void {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(0, yaw, 0);
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   mesh.setMatrixAt(i, DUMMY.matrix);
}

/** Hedges (park) or ice-brick walls with merlons and a rival pennant (fort). */
function WallForts({ run, theme }: { run: Run; theme: "park" | "fort" }) {
   const look = THEMES[theme];
   const body = useRef<InstancedMesh>(null);
   const cap = useRef<InstancedMesh>(null);
   const merlon = useRef<InstancedMesh>(null);
   const flag = useRef<InstancedMesh>(null);
   const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.12), []);
   useEffect(() => () => geo.dispose(), [geo]);
   const n = FORT.count * WALL_SEGMENTS.length;
   const fortTheme = theme === "fort";
   useLayoutEffect(() => {
      const f = flag.current;
      if (!f) return;
      const c = new Color();
      for (let i = 0; i < FORT.count; i++) f.setColorAt(i, c.set(TEAM[1 + (i % 3)]));
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
   }, []);
   useFrame(() => {
      const b = body.current;
      const t = cap.current;
      if (!b || !t) return;
      for (let f = 0; f < run.forts.length; f++) {
         const fort = run.forts[f];
         const h = drawnFortHeight(fort.hp);
         const yaw = quarterYaw(fort.x, fort.z);
         const c = Math.cos(yaw);
         const s = Math.sin(yaw);
         const capH = Math.min(0.14, h * 0.3);
         for (let k = 0; k < WALL_SEGMENTS.length; k++) {
            const [lx, lz, w, d] = WALL_SEGMENTS[k];
            const x = fort.x + lx * c + lz * s;
            const z = fort.z - lx * s + lz * c;
            const i = f * WALL_SEGMENTS.length + k;
            place(b, i, x, (h - capH) / 2, z, yaw, w, h - capH, d);
            place(t, i, x, h - capH / 2, z, yaw, w + 0.04, capH, d + 0.04);
         }
         const m = merlon.current;
         if (m) for (let k = 0; k < MERLONS.length; k++) {
            const i = f * MERLONS.length + k;
            if (fort.hp < 3) { m.setMatrixAt(i, HIDE); continue; }
            // merlons sit on the wall's top band, inside the rules height
            const lx = MERLONS[k];
            place(m, i, fort.x + lx * c - 0.62 * s, h - 0.12, fort.z - lx * s - 0.62 * c, yaw, 0.32, 0.24, 0.5);
         }
         const p = flag.current;
         if (p) {
            if (fort.hp < 2 || fort.z > -2) p.setMatrixAt(f, HIDE);
            // a pennant hung on the back wall's inner face (toward the yard), under the wall's own top
            else place(p, f, fort.x - 0.35 * s, h * 0.62, fort.z - 0.35 * c, yaw, 0.6, 0.34, 1);
         }
      }
      b.instanceMatrix.needsUpdate = true;
      t.instanceMatrix.needsUpdate = true;
      if (merlon.current) merlon.current.instanceMatrix.needsUpdate = true;
      if (flag.current) flag.current.instanceMatrix.needsUpdate = true;
   });
   return (
      <group>
         <instancedMesh ref={body} args={[geo, undefined, n]} frustumCulled={false}>
            <meshStandardMaterial color={look.fortBody} roughness={fortTheme ? 0.35 : 0.9} metalness={fortTheme ? 0.05 : 0} />
         </instancedMesh>
         <instancedMesh ref={cap} args={[geo, undefined, n]} frustumCulled={false}>
            <meshStandardMaterial color={look.fortCap} roughness={0.8} />
         </instancedMesh>
         {fortTheme && (
            <instancedMesh ref={merlon} args={[geo, undefined, FORT.count * MERLONS.length]} frustumCulled={false}>
               <meshStandardMaterial color={look.fortCap} roughness={0.35} />
            </instancedMesh>
         )}
         {fortTheme && (
            <instancedMesh ref={flag} args={[undefined, undefined, FORT.count]} frustumCulled={false}>
               <boxGeometry args={[1, 1, 0.04]} />
               <meshStandardMaterial color="#ffffff" roughness={0.6} />
            </instancedMesh>
         )}
      </group>
   );
}

/** Model forts (igloo / ice block), fitted to the square and scaled to the rules height by HP. */
const IGLOO_FORT: ModelAsset = { ...ASSETS.igloo, id: "snow-iglooFort", scale: 1 };
const FORT_MODEL: Record<"village" | "arena", { asset: ModelAsset; w: number; d: number; h: number; across: number }> = {
   village: { asset: IGLOO_FORT, w: IGLOO_GLB.width, d: IGLOO_GLB.depth, h: IGLOO_GLB.height, across: 1.76 },
   arena: { asset: DECOR_ASSETS.iceBlock, w: DECOR_GLB.iceBlock.width, d: DECOR_GLB.iceBlock.depth, h: DECOR_GLB.iceBlock.height, across: 1.72 },
};
const V = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const E = new Euler();

function ModelForts({ run, theme }: { run: Run; theme: "village" | "arena" }) {
   const fit = FORT_MODEL[theme];
   const update = (i: number, m: Matrix4) => {
      const fort = run.forts[i];
      if (!fort) return false;
      const h = drawnFortHeight(fort.hp);
      Q.setFromEuler(E.set(0, quarterYaw(fort.x, fort.z), 0));
      m.compose(V.set(fort.x, 0, fort.z), Q, S.set(fit.across / fit.w, h / fit.h, fit.across / fit.d));
   };
   return <DynamicInstancedModel asset={fit.asset} count={FORT.count} update={update} />;
}

/** One contact disc per fort, so a wall reads as standing on the snow. */
function FortShadows({ run, color }: { run: Run; color: string }) {
   const spots = useMemo<InstanceSpot[]>(() => run.forts.map((f) => ({ x: f.x, y: 0.015, z: f.z, sx: 1.25, sy: 1, sz: 1.25 })), [run]);
   return (
      <Instanced spots={spots}>
         <cylinderGeometry args={[1, 1, 0.01, 18]} />
         <meshBasicMaterial color={color} transparent opacity={0.35} depthWrite={false} />
      </Instanced>
   );
}

export function ThemedForts({ run, theme }: { run: Run; theme: ArenaTheme }) {
   if (theme === "yard") return null;
   return (
      <group>
         <FortShadows run={run} color={THEMES[theme].fortTrim} />
         {theme === "park" || theme === "fort" ? <WallForts run={run} theme={theme} /> : <ModelForts run={run} theme={theme} />}
      </group>
   );
}

/** snowmanBig.glb fitted to the centre box: 1.60 m tall, 1.38 wide (inside ±0.70). */
const SNOWMAN_BIG_CENTRE: ModelAsset = { ...ASSETS.snowmanBig, id: "snow-snowmanBigCentre", scale: 1.6 / SNOWMAN_BIG_GLB.height };

function Fountain() {
   return (
      <group>
         <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.68, 0.7, 0.44, 24]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.04, 24]} />
            <meshStandardMaterial color={ICE_LOOK.color} roughness={0.1} metalness={0.15} />
         </mesh>
         <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.14, 0.2, 0.8, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
         </mesh>
         <mesh position={[0, 1.28, 0]}>
            <cylinderGeometry args={[0.46, 0.18, 0.14, 20]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.8} />
         </mesh>
         <mesh position={[0, 1.46, 0]}>
            <coneGeometry args={[0.22, 0.28, 10]} />
            <meshStandardMaterial color="#bae6fd" roughness={0.15} emissive="#7dd3fc" emissiveIntensity={0.3} />
         </mesh>
         <mesh position={[0, 1.08, 0]}>
            <cylinderGeometry args={[0.44, 0.44, 0.28, 16, 1, true]} />
            <meshStandardMaterial color="#e0f2fe" roughness={0.1} transparent opacity={0.55} emissive="#7dd3fc" emissiveIntensity={0.2} />
         </mesh>
      </group>
   );
}

function Trophy() {
   return (
      <group>
         <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.36, 0.6, 1.36]} />
            <meshStandardMaterial color="#1e293b" roughness={0.5} />
         </mesh>
         <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[1.38, 0.08, 1.38]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.3} />
         </mesh>
         <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.16, 0.24, 0.24, 16]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} emissive="#b45309" emissiveIntensity={0.25} />
         </mesh>
         <mesh position={[0, 0.98, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.3, 10]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} />
         </mesh>
         <mesh position={[0, 1.32, 0]}>
            <cylinderGeometry args={[0.32, 0.1, 0.46, 20]} />
            <meshStandardMaterial color="#fcd34d" metalness={0.85} roughness={0.2} emissive="#b45309" emissiveIntensity={0.3} />
         </mesh>
         <mesh position={[-0.36, 1.36, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.1, 0.03, 8, 14]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} />
         </mesh>
         <mesh position={[0.36, 1.36, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.1, 0.03, 8, 14]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} />
         </mesh>
      </group>
   );
}

/** The centre cover of levels 2-5, hidden on any frame it would cover a kid (like the snowman). */
export function Centre({ run, view, theme }: { run: Run; view: FittedView; theme: ArenaTheme }) {
   const ref = useRef<Group>(null);
   useFrame((state) => {
      const g = ref.current;
      if (g) g.visible = !snowmanCovers(run, view, state.size.width, state.size.height);
   });
   const piece = CENTRE[theme];
   return (
      <group ref={ref}>
         {piece === "fountain" && <Fountain />}
         {piece === "trophy" && <Trophy />}
         {piece === "snowmanBig" && <Model asset={SNOWMAN_BIG_CENTRE} />}
         {piece === "snowman" && <Model asset={ASSETS.snowman} />}
         <BlobShadow radius={0.85} opacity={0.28} y={0.02} />
      </group>
   );
}

/** Ice (glossy, a pale rim) and deep drifts (a low white mound everyone wades through). */
export function Zones({ level }: { level: SnowLevel }) {
   const ice = useMemo<InstanceSpot[]>(() => level.arena.ice.map((z) => ({ x: z.x, y: ICE_LOOK.y, z: z.z, sx: z.r, sy: 1, sz: z.r })), [level]);
   const rims = useMemo<InstanceSpot[]>(() => level.arena.ice.map((z) => ({ x: z.x, y: ICE_LOOK.y - 0.004, z: z.z, sx: z.r + 0.22, sy: 1, sz: z.r + 0.22 })), [level]);
   const drifts = useMemo<InstanceSpot[]>(() => level.arena.drifts.map((z) => ({ x: z.x, y: DRIFT_LOOK.y, z: z.z, sx: z.r, sy: DRIFT_LOOK.height, sz: z.r })), [level]);
   return (
      <group>
         {ice.length > 0 && (
            <>
               <Instanced spots={rims}>
                  <cylinderGeometry args={[1, 1, 0.01, 32]} />
                  <meshStandardMaterial color={ICE_LOOK.rim} roughness={0.6} />
               </Instanced>
               <Instanced spots={ice}>
                  <cylinderGeometry args={[1, 1, 0.012, 32]} />
                  <meshStandardMaterial color={ICE_LOOK.color} roughness={0.08} metalness={0.25} emissive="#38bdf8" emissiveIntensity={0.08} />
               </Instanced>
            </>
         )}
         {drifts.length > 0 && (
            <Instanced spots={drifts}>
               <sphereGeometry args={[1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
               <meshStandardMaterial color={DRIFT_LOOK.color} roughness={1} emissive={DRIFT_LOOK.rim} emissiveIntensity={0.06} />
            </Instanced>
         )}
      </group>
   );
}

const MODEL_KINDS: readonly (DecorKind & DecorModelId)[] = ["tree", "bench", "lamp", "tower", "glacier"];

function modelSpots(spots: readonly DecorSpot[], kind: DecorModelId): InstanceSpot[] {
   const glb = DECOR_GLB[kind];
   return spots.filter((s) => s.kind === kind).map((s) => ({ x: s.x, y: 0, z: s.z, rotY: s.rotY, sx: s.w / glb.width, sy: s.h / glb.height, sz: s.d / glb.depth }));
}

/** Bleachers: three stepped tiers and a crowd of bobbing heads (two instanced draws). */
function Stands({ spots }: { spots: readonly DecorSpot[] }) {
   const tiers = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const s of spots) for (let t = 0; t < 3; t++) {
         const back = -s.d / 2 + (t + 0.5) * (s.d / 3);
         out.push({ x: s.x + Math.sin(s.rotY) * -back, y: ((t + 1) * s.h) / 6, z: s.z + Math.cos(s.rotY) * -back, rotY: s.rotY, sx: s.w, sy: ((t + 1) * s.h) / 3, sz: s.d / 3 });
      }
      return out;
   }, [spots]);
   const heads = useRef<InstancedMesh>(null);
   const crowd = useMemo(() => {
      const out: { x: number; y: number; z: number; c: string; p: number }[] = [];
      const colors = ["#f87171", "#4ade80", "#fb923c", "#38bdf8", "#facc15", "#e2e8f0"];
      for (const s of spots) for (let t = 0; t < 3; t++) {
         const back = -s.d / 2 + (t + 0.5) * (s.d / 3);
         const count = Math.floor(s.w / 1.1);
         for (let k = 0; k < count; k++) {
            const along = -s.w / 2 + (k + 0.5) * (s.w / count) + ((k * 37 + t * 11) % 7) * 0.05;
            const c = Math.cos(s.rotY);
            const sn = Math.sin(s.rotY);
            out.push({ x: s.x + along * c - back * sn, y: ((t + 1) * s.h) / 3 + 0.32, z: s.z - along * sn - back * c, c: colors[(k + t * 2) % colors.length], p: k * 1.3 + t });
         }
      }
      return out;
   }, [spots]);
   const time = useGameTime();
   useLayoutEffect(() => {
      const m = heads.current;
      if (!m) return;
      const c = new Color();
      crowd.forEach((h, i) => m.setColorAt(i, c.set(h.c)));
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
   }, [crowd]);
   useFrame(() => {
      const m = heads.current;
      if (!m) return;
      const now = time.now;
      for (let i = 0; i < crowd.length; i++) {
         const h = crowd[i];
         place(m, i, h.x, h.y + Math.max(0, Math.sin(now * 3 + h.p)) * 0.12, h.z, 0, 0.26, 0.34, 0.26);
      }
      m.instanceMatrix.needsUpdate = true;
   });
   if (spots.length === 0) return null;
   return (
      <group>
         <Instanced spots={tiers}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={spots[0].color ?? "#1e3a8a"} roughness={0.7} />
         </Instanced>
         <instancedMesh ref={heads} args={[undefined, undefined, crowd.length]} frustumCulled={false}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
         </instancedMesh>
      </group>
   );
}

/** Team banners on two posts each (one tinted draw for the cloth). */
function Banners({ spots }: { spots: readonly DecorSpot[] }) {
   const cloth = useRef<InstancedMesh>(null);
   const cloths = useMemo<InstanceSpot[]>(() => spots.map((s) => ({ x: s.x, y: 0.15 + s.h / 2, z: s.z, rotY: s.rotY, sx: s.w, sy: s.h, sz: s.d })), [spots]);
   useLayoutEffect(() => {
      const m = cloth.current;
      if (!m) return;
      const c = new Color();
      spots.forEach((s, i) => {
         place(m, i, cloths[i].x, cloths[i].y, cloths[i].z, s.rotY, s.w, s.h, s.d);
         m.setColorAt(i, c.set(s.color ?? "#38bdf8"));
      });
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
   }, [spots, cloths]);
   if (spots.length === 0) return null;
   return (
      <instancedMesh ref={cloth} args={[undefined, undefined, spots.length]} frustumCulled={false}>
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color="#ffffff" roughness={0.55} emissive="#ffffff" emissiveIntensity={0.08} />
      </instancedMesh>
   );
}

/** Floodlight masts: a pole and a glowing head each. */
function Floods({ spots }: { spots: readonly DecorSpot[] }) {
   const poles = useMemo<InstanceSpot[]>(() => spots.map((s) => ({ x: s.x, y: s.h / 2, z: s.z, sx: 0.16, sy: s.h, sz: 0.16 })), [spots]);
   const heads = useMemo<InstanceSpot[]>(() => spots.map((s) => ({ x: s.x, y: s.h, z: s.z, rotY: Math.atan2(-s.x, -s.z), sx: s.w * 1.6, sy: 0.6, sz: 0.3 })), [spots]);
   if (spots.length === 0) return null;
   return (
      <group>
         <Instanced spots={poles}>
            <cylinderGeometry args={[1, 1, 1, 8]} />
            <meshStandardMaterial color="#475569" roughness={0.6} />
         </Instanced>
         <Instanced spots={heads}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={1.4} />
         </Instanced>
      </group>
   );
}

/** Everything past the fence for this theme, plus the arena's floodlights and rink ring. */
export function Scenery({ theme }: { theme: ArenaTheme }) {
   const spots = DECOR[theme];
   const models = useMemo(
      () => MODEL_KINDS.map((kind) => ({
         kind,
         spots: modelSpots(spots, kind),
         // stand-in until the GLB loads: a tinted box of the drawn size
         stand: spots.filter((s) => s.kind === kind).map((s) => ({ x: s.x, y: s.h / 2, z: s.z, rotY: s.rotY, sx: s.w * 0.8, sy: s.h, sz: s.d * 0.8 })),
      })).filter((m) => m.spots.length > 0),
      [spots],
   );
   const byKind = (kind: DecorKind) => spots.filter((s) => s.kind === kind);
   return (
      <group>
         {models.map((m) => (
            <InstancedModel
               key={m.kind}
               asset={DECOR_ASSETS[m.kind]}
               spots={m.spots}
               fallback={(
                  <Instanced spots={m.stand}>
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={DECOR_ASSETS[m.kind].fallbackColor} roughness={0.8} />
                  </Instanced>
               )}
            />
         ))}
         <Stands spots={byKind("stand")} />
         <Banners spots={byKind("banner")} />
         <Floods spots={byKind("flood")} />
         {theme === "arena" && (
            <>
               {FLOOD_LIGHTS.map((l, i) => (
                  <pointLight key={i} position={[l.x, l.y, l.z]} color={l.color} intensity={l.intensity} distance={26} decay={1.6} />
               ))}
               <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
                  <ringGeometry args={[2.35, 2.5, 48]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} depthWrite={false} />
               </mesh>
               <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
                  <planeGeometry args={[24, 0.14]} />
                  <meshBasicMaterial color="#f87171" transparent opacity={0.55} depthWrite={false} />
               </mesh>
            </>
         )}
      </group>
   );
}
