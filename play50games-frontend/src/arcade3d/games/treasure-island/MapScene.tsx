"use client";

// The map levels' look (levels 2-5, maps.ts): sky, the terrain grid (beach slope, the hill, the carved
// stream / tide pools / ravine the sea shows through, painted paths and rock), the sea, the props
// (reused GLBs drawn as 1 m units on their rules footprints), the bridges, the gates and how they
// open, the palms, the dock, the crabs, the surroundings decor, and the level's own light (an accent
// light; lightning on Pirate Peak). Level 1 keeps Island.tsx.
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, type AmbientLight, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { PLANK_DECK, PROP_ASSETS, PROP_GLB, type PropAssetId } from "./assets";
import { Decor } from "./Decor";
import { Crabs, Dock, Palms, Sea } from "./Island";
import { BANK, COLORS, THEMES, distToPolyline, groundHeight, hillHeight, terrainHeight, type Theme } from "./looks";
import type { GateSpec, IslandMap, MapProp, PropKind } from "./maps";
import { rho, type Island, type IslandShape, type RunState } from "./rules";

// ---------- terrain ----------

const CELL = 0.42;
const speckle = (i: number, j: number) => {
   const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
   return v - Math.floor(v);
};
const smooth = (e0: number, e1: number, v: number) => {
   const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
   return t * t * (3 - 2 * t);
};

function buildTerrain(map: IslandMap, shape: IslandShape, theme: Theme): BufferGeometry {
   const hx = shape.rx * 1.6;
   const hz = shape.rz * 1.7;
   const nx = Math.ceil((2 * hx) / CELL) + 1;
   const nz = Math.ceil((2 * hz) / CELL) + 1;
   const positions = new Float32Array(nx * nz * 3);
   const colors = new Float32Array(nx * nz * 3);
   const keep = new Uint8Array(nx * nz);
   const c = new Color();
   const tint = new Color();
   const pal = {
      sand: new Color(theme.sand), sandSun: new Color(theme.sandSun), wet: new Color(theme.wet), grass: new Color(theme.grass),
      grassDark: new Color(theme.grassDark), path: new Color(theme.path), rock: new Color(theme.rock), mud: new Color(theme.mud),
      moss: new Color(theme.moss), ash: new Color(theme.ash), under: new Color(COLORS.underwaterSand), lagoon: new Color(COLORS.deepLagoon),
      bed: new Color(COLORS.oceanBed), cliffDark: new Color(COLORS.rockDark),
   };
   for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
         const x = -hx + i * CELL;
         const z = -hz + j * CELL;
         const k = i * nz + j;
         const r = rho(x, z, shape);
         keep[k] = r < 1.9 ? 1 : 0;
         const y = terrainHeight(x, z, map, shape);
         positions[k * 3] = x;
         positions[k * 3 + 1] = y;
         positions[k * 3 + 2] = z;
         const n = speckle(i, j);
         const a = Math.atan2(z / shape.rz, x / shape.rx);
         const edge = theme.grassRho + Math.sin(a * 13 + 0.7) * 0.025 + Math.sin(a * 31) * 0.012;
         if (r < edge - 0.03) c.copy(pal.grass).lerp(pal.grassDark, 0.15 + n * 0.3 + 0.15 * Math.sin(x * 0.7 + z * 0.4));
         else if (r < edge) c.copy(pal.grass).lerp(pal.sand, 0.45 + n * 0.2);
         else if (r < 0.9) c.copy(pal.sand).lerp(pal.sandSun, 0.3 + 0.3 * Math.sin(r * 50 + Math.sin(a * 8)) + n * 0.1);
         else if (r < 1.02) c.copy(pal.sand).lerp(pal.wet, Math.min(1, (r - 0.9) / 0.12) * 0.9 + n * 0.05);
         else if (r < 1.18) c.copy(pal.wet).lerp(pal.under, ((r - 1.02) / 0.16) * 0.85);
         else c.copy(pal.lagoon).lerp(pal.bed, Math.min(1, (r - 1.18) / 0.6) * 0.85 + n * 0.05);
         if (r < 1.0) {
            for (const p of map.paints) {
               const d = distToPolyline(x, z, p.points);
               const w = smooth(p.half + 0.4, p.half - 0.25, d);
               if (w <= 0) continue;
               tint.copy(pal[p.kind === "sand" ? "sandSun" : p.kind]).lerp(pal.grassDark, n * 0.12);
               c.lerp(tint, w * 0.88);
            }
         }
         // the carves' banks: wet sand by water, dark rock down the ravine
         for (const cv of map.carves) {
            const d = distToPolyline(x, z, cv.points);
            const w = smooth(cv.half + BANK + 0.25, cv.half * 0.6, d);
            if (w <= 0) continue;
            tint.copy(cv.kind === "ravine" ? pal.cliffDark : pal.wet).lerp(pal.rock, cv.kind === "ravine" ? n * 0.4 : 0.15);
            c.lerp(tint, w);
         }
         // the hill: darker towards its top (ash and rock), lit by the slope (looks)
         const hill = hillHeight(x, z, map);
         if (hill > 0 && map.hill) c.lerp(pal.rock, (hill / map.hill.h) * 0.25);
         colors[k * 3] = c.r;
         colors[k * 3 + 1] = c.g;
         colors[k * 3 + 2] = c.b;
      }
   }
   const index: number[] = [];
   for (let i = 1; i < nx; i++) {
      for (let j = 1; j < nz; j++) {
         const a = (i - 1) * nz + (j - 1);
         const b = i * nz + (j - 1);
         const d = (i - 1) * nz + j;
         const e = i * nz + j;
         if (!(keep[a] || keep[b] || keep[d] || keep[e])) continue;
         index.push(a, d, b, b, d, e);
      }
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(positions, 3));
   g.setAttribute("color", new Float32BufferAttribute(colors, 3));
   g.setIndex(index);
   g.computeVertexNormals();
   return g;
}

function Terrain({ map, shape, theme }: { map: IslandMap; shape: IslandShape; theme: Theme }) {
   const geometry = useMemo(() => buildTerrain(map, shape, theme), [map, shape, theme]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry} name="map-terrain">
         <meshStandardMaterial vertexColors roughness={0.93} />
      </mesh>
   );
}

// ---------- props ----------

/** How much of a prop sinks into the ground (m per m of height), so a slope never shows its base. */
const SINK: Partial<Record<PropKind, number>> = { boulder: 0.12, rock: 0.12, cliff: 0.1, bush: 0.05, fern: 0.05, plant: 0.03, shell: 0.25 };

/** A ruin block longer than this is drawn as several stones. */
const BLOCK_STONE = 2.1;

function propSpots(props: readonly MapProp[], shape: IslandShape, map: IslandMap): Map<PropAssetId, InstanceSpot[]> {
   const out = new Map<PropAssetId, InstanceSpot[]>();
   const push = (id: PropAssetId, s: InstanceSpot) => {
      const list = out.get(id) ?? [];
      list.push(s);
      out.set(id, list);
   };
   for (const p of props) {
      const y = terrainHeight(p.x, p.z, map, shape) - (SINK[p.kind] ?? 0) * p.h;
      if (p.kind === "block") {
         const long = Math.max(p.w, p.d);
         const n = Math.max(1, Math.round(long / BLOCK_STONE));
         for (let k = 0; k < n; k++) {
            const t = (k + 0.5) / n - 0.5;
            const x = p.w >= p.d ? p.x + t * p.w : p.x;
            const z = p.w >= p.d ? p.z : p.z + t * p.d;
            const h = p.h * (0.82 + 0.3 * (((k * 7 + Math.round(p.x * 3)) % 5) / 5));
            const yaw = p.w >= p.d ? 0 : Math.PI / 2;
            push("block", { x, y: terrainHeight(x, z, map, shape) - 0.05, z, rotY: yaw + (k % 2) * Math.PI, sx: long / n + 0.08, sy: h, sz: Math.min(p.w, p.d) });
         }
         continue;
      }
      push(p.kind, { x: p.x, y, z: p.z, rotY: p.yaw, sx: p.w, sy: p.h, sz: p.d });
   }
   return out;
}

const UNIT_SHAPE: Record<PropAssetId, "box" | "rock" | "post"> = {
   hut: "box", bush: "rock", fern: "rock", plant: "rock", boulder: "rock", rock: "rock", cliff: "rock", pillar: "post", column: "post",
   block: "box", ruinGate: "box", arch: "rock", wreck: "box", cannon: "post", barrel: "post", crate: "box", anchor: "post", flag: "post",
   totem: "post", log: "post", vine: "post", shell: "rock", plankBridge: "box", ropeBridge: "box",
};

/** A deliberate two-tone stand-in for a prop (only drawn if its GLB fails): a body and a darker base. */
function PropPrimitives({ id, spots }: { id: PropAssetId; spots: readonly InstanceSpot[] }) {
   const shape = UNIT_SHAPE[id];
   const color = PROP_GLB[id].color;
   const base = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (s.sy ?? 1) * 0.08, sy: (s.sy ?? 1) * 0.16, sx: (s.sx ?? 1) * 1.04, sz: (s.sz ?? 1) * 1.04 })), [spots]);
   const body = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (s.sy ?? 1) * 0.55, sy: (s.sy ?? 1) * 0.9 })), [spots]);
   return (
      <>
         <Instanced spots={base} name={`${id}-standin-base`}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rockDark} roughness={0.95} />
         </Instanced>
         <Instanced spots={body} name={`${id}-standin`}>
            {shape === "box" ? <boxGeometry args={[0.96, 1, 0.96]} /> : shape === "rock" ? <dodecahedronGeometry args={[0.55, 0]} /> : <cylinderGeometry args={[0.42, 0.48, 1, 10]} />}
            <meshStandardMaterial color={color} roughness={0.85} flatShading={shape === "rock"} />
         </Instanced>
      </>
   );
}

function Props({ map, shape }: { map: IslandMap; shape: IslandShape }) {
   const groups = useMemo(() => [...propSpots(map.props, shape, map)], [map, shape]);
   return (
      <group name="map-props">
         {groups.map(([id, spots]) => (
            <InstancedModel key={id} asset={PROP_ASSETS[id]} spots={spots} fallback={<PropPrimitives id={id} spots={spots} />} />
         ))}
      </group>
   );
}

// ---------- bridges ----------

function Bridges({ map }: { map: IslandMap }) {
   return (
      <group name="bridges">
         {map.bridges.map((b) => {
            const rope = b.kind === "rope";
            const id: PropAssetId = rope ? "ropeBridge" : "plankBridge";
            const width = 2 * b.half + (rope ? 0.5 : 0.35);
            const height = rope ? 1.5 : 0.9;
            // the plank deck top lands on b.deck; the rope bridge hangs from its posts, its slats at the sagging deck
            const y = rope ? b.deck - b.sag - 0.08 : b.deck - PLANK_DECK * height;
            return (
               <group key={`${b.x},${b.z}`} position={[b.x, y, b.z]} rotation-y={b.axis === "x" ? Math.PI / 2 : 0}>
                  <group scale={[width, height, b.length + 0.4]}>
                     <Model asset={PROP_ASSETS[id]} fallback={<BridgePrimitive />} />
                  </group>
               </group>
            );
         })}
      </group>
   );
}

function BridgePrimitive() {
   return (
      <group>
         <mesh position-y={0.42}>
            <boxGeometry args={[1, 0.08, 1]} />
            <meshStandardMaterial color={COLORS.deck} roughness={0.85} />
         </mesh>
         {[-0.48, 0.48].map((x) => (
            <mesh key={x} position={[x, 0.7, 0]}>
               <boxGeometry args={[0.05, 0.05, 1]} />
               <meshStandardMaterial color={COLORS.woodDark} roughness={0.9} />
            </mesh>
         ))}
      </group>
   );
}

// ---------- gates ----------

/** How long a gate takes to clear (s, game time). */
export const GATE_OPEN_S = 0.9;

function Gate({ gate, index, run, map, shape }: { gate: GateSpec; index: number; run: RunState; map: IslandMap; shape: IslandShape }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const [state] = useState(() => ({ openedAt: -1 }));
   const y = terrainHeight(gate.x, gate.z, map, shape);
   const across = gate.hx >= gate.hz ? "x" : "z";
   const span = 2 * Math.max(gate.hx, gate.hz);
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      if (run.gateOpen[index] && state.openedAt < 0) state.openedAt = time.now;
      const k = state.openedAt < 0 ? 0 : Math.min(1, (time.now - state.openedAt) / GATE_OPEN_S);
      g.visible = k < 1;
      if (gate.kind === "log") {
         // rolls off the bridge to the east and sinks into the stream
         g.position.set(gate.x + k * 2.2, y + 0.02 - k * k * 1.1, gate.z);
         g.rotation.set(0, 0, -k * 2.4);
      } else if (gate.kind === "vines") {
         // the curtain draws up into the canopy
         g.position.set(gate.x, y + k * 1.6, gate.z);
         g.scale.set(1, Math.max(0.02, 1 - k), 1);
      } else {
         // the rocks crumble and sink
         g.position.set(gate.x, y - k * 1.5, gate.z);
         g.scale.setScalar(Math.max(0.02, 1 - 0.4 * k));
      }
   });
   const vines = useMemo<InstanceSpot[]>(() => {
      const n = Math.max(2, Math.round(span / 1.0));
      return Array.from({ length: n }, (_v, k) => {
         const t = (k + 0.5) / n - 0.5;
         return { x: across === "x" ? t * span : 0, y: 0, z: across === "x" ? 0 : t * span, rotY: k * 1.3, sx: 1.15, sy: 2.4 - (k % 2) * 0.35, sz: 0.9 };
      });
   }, [across, span]);
   const rocks = useMemo<InstanceSpot[]>(
      () => [
         { x: -0.45, y: -0.1, z: 0.25, rotY: 0.4, sx: 1.4, sy: 0.9, sz: 1.3 },
         { x: 0.5, y: -0.1, z: -0.2, rotY: 2.1, sx: 1.3, sy: 0.85, sz: 1.2 },
         { x: 0.05, y: 0.45, z: 0.05, rotY: 1.2, sx: 1.0, sy: 0.7, sz: 0.95 },
      ],
      []
   );
   const log = useMemo<InstanceSpot[]>(() => [{ x: 0, y: 0, z: 0, rotY: across === "x" ? 0 : Math.PI / 2, sx: span + 0.5, sy: 0.62, sz: 0.68 }], [across, span]);
   return (
      <group ref={root} name={`gate-${gate.kind}`}>
         {gate.kind === "vines" && <InstancedModel asset={PROP_ASSETS.vine} spots={vines} fallback={<PropPrimitives id="vine" spots={vines} />} />}
         {gate.kind === "rockfall" && <InstancedModel asset={PROP_ASSETS.boulder} spots={rocks} fallback={<PropPrimitives id="boulder" spots={rocks} />} />}
         {gate.kind === "log" && <InstancedModel asset={PROP_ASSETS.log} spots={log} fallback={<PropPrimitives id="log" spots={log} />} />}
      </group>
   );
}

// ---------- light ----------

/** Pirate Peak's storm: a soft flash every few seconds (two quick pulses), on the game clock. */
function Lightning() {
   const time = useGameTime();
   const light = useRef<AmbientLight>(null);
   useFrame(() => {
      const l = light.current;
      if (!l) return;
      const t = (time.now + 2.5) % 7.7;
      l.intensity = t < 0.09 ? 0.9 : t > 0.2 && t < 0.27 ? 0.6 : 0;
   });
   return <ambientLight ref={light} color="#dbeafe" intensity={0} />;
}

// ---------- the map scene ----------

export function MapScene({ island, run, levelId }: { island: Island; run: RunState; levelId: LevelId }) {
   const map = run.shape.map!;
   const theme = THEMES[levelId];
   return (
      <group name="map-island">
         <SkyDome top={theme.skyTop} bottom={theme.skyBottom} offset={0.06} exponent={0.72} />
         <Terrain map={map} shape={run.shape} theme={theme} />
         <Sea run={run} color={theme.sea} deep={theme.deep} />
         <Props map={map} shape={run.shape} />
         <Bridges map={map} />
         {map.gates.map((g, i) => (
            <Gate key={i} gate={g} index={i} run={run} map={map} shape={run.shape} />
         ))}
         <Palms island={island} run={run} />
         <Dock />
         <Crabs island={island} run={run} />
         <Decor levelId={levelId} />
         {theme.accent && <directionalLight color={theme.accent.color} intensity={theme.accent.intensity} position={[...theme.accent.position]} />}
         {theme.storm && <Lightning />}
      </group>
   );
}

/** The sand height used under the dock's foot (kept for tests: the start is on flat sand on every map). */
export const startHeight = (shape: IslandShape) => groundHeight(rho(0, 9.2, shape));
