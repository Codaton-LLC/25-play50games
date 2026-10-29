"use client";

// The level's own props (maps.ts): trunks and pines, ferns, fallen logs, bank rocks and reeds, basalt
// spires, the river or pond with its log bridges, the lava vents / geysers and the sanctuary pen,
// plus the grown-up dinos grazing outside the sanctuary. Visual only: the rules read the same map.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CylinderGeometry, RepeatWrapping, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { ADULT_DINO_SCALE, ASSETS } from "./assets";
import { DinoPrimitive, TreePrimitive } from "./Primitives";
import type { Obstacle, ValleyMap, Vent, WaterBox } from "./maps";

const PALETTE = {
   water: "#2b8fd6",
   waterDeep: "#1d6fb0",
   waterFoam: "#d6f1ff",
   pond: "#2fb5a6",
   pondDeep: "#1c8d84",
   bank: "#b08a55",
   basalt: "#4a403b",
   basaltTop: "#4a3f3a",
   lava: "#f97316",
   lavaCore: "#fde047",
   crater: "#1c1412",
   steam: "#f1f5f9",
   geyserRim: "#94a3b8",
   post: "#7c4a1e",
   lantern: "#fde68a",
} as const;

const byKind = (map: ValleyMap, kind: Obstacle["kind"]) => map.obstacles.filter((o) => o.kind === kind);
const rotOf = (i: number) => (i * 2.399) % (Math.PI * 2);

function useWaterTexture(pond: boolean) {
   const draw = useMemo<CanvasDraw>(
      () => (ctx, w, h) => {
         ctx.fillStyle = pond ? PALETTE.pond : PALETTE.water;
         ctx.fillRect(0, 0, w, h);
         ctx.strokeStyle = pond ? PALETTE.pondDeep : PALETTE.waterDeep;
         ctx.globalAlpha = 0.5;
         ctx.lineWidth = 3;
         for (let i = 0; i < 22; i++) {
            const y = (i * 53) % h;
            const x = (i * 97) % w;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + 20, y - 6, x + 44, y + 6, x + 70, y);
            ctx.stroke();
         }
         ctx.strokeStyle = PALETTE.waterFoam;
         ctx.globalAlpha = 0.55;
         ctx.lineWidth = 2;
         for (let i = 0; i < 14; i++) {
            const y = (i * 71 + 19) % h;
            const x = (i * 131 + 7) % w;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 26 + (i % 3) * 10, y);
            ctx.stroke();
         }
         ctx.globalAlpha = 1;
      },
      [pond]
   );
   const texture = useCanvasTexture(256, 256, draw);
   useEffect(() => {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.needsUpdate = true;
   }, [texture]);
   return texture;
}

/** A river or pond: the water sheet (its ripples scroll with the current), sandy banks and a darker edge. */
function Water({ box, pond }: { box: WaterBox; pond: boolean }) {
   const texture = useWaterTexture(pond);
   const time = useGameTime();
   // the river runs on past the valley's walls into the hills
   const x0 = pond ? box.x0 : box.x0 - 30;
   const x1 = pond ? box.x1 : box.x1 + 30;
   const w = x1 - x0;
   const d = box.z1 - box.z0;
   useEffect(() => {
      texture.repeat.set(w / 4, d / 4);
   }, [texture, w, d]);
   useFrame(() => {
      texture.offset.x = (-box.flowX * time.now) / 4;
      texture.offset.y = (box.flowZ * time.now) / 4;
   });
   return (
      <group>
         {/* banks */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.006, (box.z0 + box.z1) / 2]}>
            <planeGeometry args={[w + 0.8, d + 1.2]} />
            <meshStandardMaterial color={PALETTE.bank} roughness={0.95} />
         </mesh>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0.012, (box.z0 + box.z1) / 2]}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial map={texture} color="#ffffff" roughness={0.15} metalness={0.1} transparent opacity={0.92} emissive={pond ? PALETTE.pondDeep : PALETTE.waterDeep} emissiveIntensity={0.18} />
         </mesh>
      </group>
   );
}

/** A lava vent (volcano) or a geyser (sanctuary): a crater whose core glows on the warning and a column on the eruption. */
function VentProp({ vent, index, states, steam }: { vent: Vent; index: number; states: readonly number[]; steam: boolean }) {
   const core = useRef<Mesh>(null);
   const column = useRef<Mesh>(null);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const s = states[index] ?? 0;
      const c = core.current;
      if (c) {
         const mat = c.material as MeshStandardMaterial;
         const pulse = 0.5 + 0.5 * Math.sin(time.now * 14);
         mat.emissiveIntensity = s === 2 ? 3.2 : s === 1 ? 1.2 + 1.6 * pulse : 0.35;
      }
      const r = ring.current;
      if (r) {
         r.visible = s === 1;
         const pulse = 0.5 + 0.5 * Math.sin(time.now * 14);
         r.scale.setScalar(1 + 0.15 * pulse);
      }
      const col = column.current;
      if (col) {
         col.visible = s === 2;
         if (s === 2) {
            const flick = 0.9 + 0.2 * Math.sin(time.now * 31 + index);
            col.scale.set(flick, 1 + 0.15 * Math.sin(time.now * 23), flick);
         }
      }
   });
   const hot = steam ? PALETTE.steam : PALETTE.lava;
   const glow = steam ? "#7dd3fc" : PALETTE.lavaCore;
   return (
      <group position={[vent.x, 0, vent.z]}>
         {/* raised crater rim */}
         <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[vent.r, 0.16, 6, 18]} />
            <meshStandardMaterial color={steam ? PALETTE.geyserRim : PALETTE.crater} roughness={0.9} flatShading />
         </mesh>
         {/* glowing core */}
         <mesh ref={core} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[vent.r * 0.92, 20]} />
            <meshStandardMaterial color={hot} emissive={glow} emissiveIntensity={0.4} roughness={0.4} />
         </mesh>
         {/* warning ring */}
         <mesh ref={ring} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[vent.r + 0.1, vent.r + 0.3, 24]} />
            <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={2} transparent opacity={0.85} />
         </mesh>
         {/* the eruption column */}
         <mesh ref={column} position={[0, 1.4, 0]} visible={false}>
            <cylinderGeometry args={[vent.r * 0.45, vent.r * 0.9, 2.8, 10, 1, true]} />
            <meshStandardMaterial color={hot} emissive={glow} emissiveIntensity={steam ? 0.8 : 2.4} transparent opacity={steam ? 0.6 : 0.8} depthWrite={false} />
         </mesh>
      </group>
   );
}

/** Basalt spires: three hexagonal columns with a lava-lit seam at the foot. */
function Spires({ spires }: { spires: readonly Obstacle[] }) {
   const geo = useMemo(() => new CylinderGeometry(0.42, 0.5, 1, 6), []);
   useEffect(() => () => geo.dispose(), [geo]);
   const columns = useMemo(() => {
      const out: InstanceSpot[] = [];
      spires.forEach((o, i) => {
         const k = o.r / 0.7;
         out.push({ x: o.ax, y: 1.3 * k, z: o.az, rotY: rotOf(i), sx: k * 1.15, sy: 2.6 * k, sz: k * 1.15 });
         out.push({ x: o.ax + 0.42 * k, y: 0.8 * k, z: o.az + 0.25 * k, rotY: rotOf(i + 3), sx: k * 0.8, sy: 1.6 * k, sz: k * 0.8 });
         out.push({ x: o.ax - 0.35 * k, y: 0.55 * k, z: o.az - 0.3 * k, rotY: rotOf(i + 5), sx: k * 0.7, sy: 1.1 * k, sz: k * 0.7 });
      });
      return out;
   }, [spires]);
   return (
      <group>
         <Instanced spots={columns}>
            <primitive object={geo} attach="geometry" />
            <meshStandardMaterial color={PALETTE.basalt} emissive="#2a0c04" emissiveIntensity={0.6} roughness={0.85} flatShading />
         </Instanced>
         {spires.map((o, i) => (
            <mesh key={i} position={[o.ax, 0.02, o.az]} rotation={[-Math.PI / 2, 0, 0]}>
               <ringGeometry args={[o.r * 0.95, o.r * 1.25, 12]} />
               <meshStandardMaterial color={PALETTE.lava} emissive={PALETTE.lava} emissiveIntensity={1.4} transparent opacity={0.7} />
            </mesh>
         ))}
      </group>
   );
}

/** Fence panels along each fence segment, posts at the ends, two lanterns on the gate posts. */
function Fences({ fences }: { fences: readonly Obstacle[] }) {
   const panels = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const f of fences) {
         const len = Math.hypot(f.bx - f.ax, f.bz - f.az);
         const n = Math.max(1, Math.round(len / 1.9));
         const step = len / n;
         const yaw = -Math.atan2(f.bz - f.az, f.bx - f.ax);
         for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            out.push({ x: f.ax + (f.bx - f.ax) * t, y: 0, z: f.az + (f.bz - f.az) * t, rotY: yaw, sx: step, sy: 1.1, sz: 1.2 });
         }
      }
      return out;
   }, [fences]);
   // gate posts: the ends of the two north segments that face each other
   const gate = useMemo(() => {
      const north = fences.filter((f) => f.az === f.bz);
      if (north.length < 2) return [];
      return [north[0].bx, north[1].ax].map((x) => ({ x, z: north[0].az }));
   }, [fences]);
   return (
      <group>
         <InstancedModel
            asset={ASSETS.fence}
            spots={panels}
            fallback={
               <Instanced spots={panels}>
                  <boxGeometry args={[1, 0.9, 0.12]} />
                  <meshStandardMaterial color={PALETTE.post} roughness={0.8} />
               </Instanced>
            }
         />
         {gate.map((p, i) => (
            <group key={i} position={[p.x, 0, p.z]}>
               <mesh position={[0, 0.8, 0]}>
                  <boxGeometry args={[0.26, 1.6, 0.26]} />
                  <meshStandardMaterial color={PALETTE.post} roughness={0.8} />
               </mesh>
               <mesh position={[0, 1.72, 0]}>
                  <sphereGeometry args={[0.17, 10, 8]} />
                  <meshStandardMaterial color={PALETTE.lantern} emissive={PALETTE.lantern} emissiveIntensity={1.6} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

/** Two grown-up dinos grazing outside the sanctuary's north fence line (decor, outside the valley). */
function Residents() {
   const a = useRef<Group>(null);
   const b = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (a.current) a.current.rotation.x = 0.04 * Math.sin(time.now * 0.9);
      if (b.current) b.current.rotation.x = 0.04 * Math.sin(time.now * 0.8 + 1.3);
   });
   return (
      <group>
         <group ref={a} position={[-9, 0, -14.5]} rotation-y={0.5} scale={ADULT_DINO_SCALE}>
            <Model asset={ASSETS.dino} fallback={<DinoPrimitive />} />
         </group>
         <group ref={b} position={[7.5, 0, -15]} rotation-y={-0.9} scale={ADULT_DINO_SCALE * 0.85}>
            <Model asset={ASSETS.dino} fallback={<DinoPrimitive />} tint="#d9f99d" />
         </group>
      </group>
   );
}

export function LevelProps({ map, ventStates }: { map: ValleyMap; ventStates: readonly number[] }) {
   const spots = useMemo(() => {
      const point = (kind: Obstacle["kind"], scale: (o: Obstacle) => number, y = 0): InstanceSpot[] =>
         byKind(map, kind).map((o, i) => ({ x: o.ax, y, z: o.az, rotY: rotOf(i), scale: scale(o) }));
      return {
         trees: point("tree", () => 1),
         // the forest's big old trees (the "pine" solids: a 0.3 m trunk), the leafy tree grown 1.15-1.4x
         pines: point("pine", (o) => 1.15 * (o.size ?? 1)),
         ferns: point("fern", (o) => o.r * 3.2),
         rocks: point("rock", (o) => o.r * 2.3),
         reeds: point("reeds", () => 0.9),
         logs: byKind(map, "log").map((o, i) => {
            const len = Math.hypot(o.bx - o.ax, o.bz - o.az) + o.r * 2;
            return { x: (o.ax + o.bx) / 2, y: 0, z: (o.az + o.bz) / 2, rotY: -Math.atan2(o.bz - o.az, o.bx - o.ax) + (i % 2) * Math.PI, sx: len, sy: len, sz: len } as InstanceSpot;
         }),
         bridges: map.bridges.map((b) => ({ x: (b.x0 + b.x1) / 2, y: -0.05, z: (b.z0 + b.z1) / 2, sx: (b.x1 - b.x0) * 1.3, sy: 1.2, sz: b.z1 - b.z0 + 1.4 })),
      };
   }, [map]);
   const steam = map.theme === "sanctuary";
   return (
      <group name="level-props">
         {map.water.map((w, i) => (
            <Water key={i} box={w} pond={map.theme === "sanctuary"} />
         ))}
         {spots.bridges.length > 0 && <InstancedModel asset={ASSETS.bridge} spots={spots.bridges} fallback={<Instanced spots={spots.bridges}><boxGeometry args={[1, 0.25, 1]} /><meshStandardMaterial color="#92400e" /></Instanced>} />}
         {spots.trees.length > 0 && <InstancedModel asset={ASSETS.leafyTree} spots={spots.trees} fallback={<Instanced spots={spots.trees}><TreePrimitive /></Instanced>} />}
         {spots.pines.length > 0 && <InstancedModel asset={ASSETS.leafyTree} spots={spots.pines} fallback={<Instanced spots={spots.pines}><TreePrimitive /></Instanced>} />}
         {spots.ferns.length > 0 && <InstancedModel asset={ASSETS.fern} spots={spots.ferns} fallback={<Instanced spots={spots.ferns}><coneGeometry args={[0.5, 0.9, 5]} /><meshStandardMaterial color="#16a34a" /></Instanced>} />}
         {spots.rocks.length > 0 && <InstancedModel asset={ASSETS.bankRock} spots={spots.rocks} fallback={<Instanced spots={spots.rocks}><dodecahedronGeometry args={[0.5, 0]} /><meshStandardMaterial color="#78716c" flatShading /></Instanced>} />}
         {spots.reeds.length > 0 && <InstancedModel asset={ASSETS.fern} spots={spots.reeds} fallback={<Instanced spots={spots.reeds}><coneGeometry args={[0.3, 1.2, 5]} /><meshStandardMaterial color="#15803d" /></Instanced>} />}
         {spots.logs.length > 0 && <InstancedModel asset={ASSETS.log} spots={spots.logs} fallback={<Instanced spots={spots.logs}><boxGeometry args={[1, 0.26, 0.26]} /><meshStandardMaterial color="#78350f" /></Instanced>} />}
         {byKind(map, "spire").length > 0 && <Spires spires={byKind(map, "spire")} />}
         {byKind(map, "fence").length > 0 && <Fences fences={byKind(map, "fence")} />}
         {map.vents.map((v, i) => (
            <VentProp key={i} vent={v} index={i} states={ventStates} steam={steam} />
         ))}
         {map.theme === "sanctuary" && <Residents />}
      </group>
   );
}
