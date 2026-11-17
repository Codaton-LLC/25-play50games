"use client";

// Levels 2-5's own floor (levels.ts STORES): the set pieces (produce stands, chilled cases, promo
// bakery islands, stock pallets), the floor machines on patrol, the closing-time lane shutter and the
// level's extra wet floor. Collision lives in rules.ts; every piece is drawn inside its rules box.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { BlobShadow, Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { SHARED_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BAKERY_DRAWN, MARKET_DRAWN } from "./assets";
import { COLORS } from "./looks";
import type { SetPiece, ShoppingCartLevel } from "./levels";
import { LANE_GATE, type Mover, type RunState } from "./rules";
import { STORE_LOOKS } from "./storeLooks";

/** crate.glb 1.880 x 1.335 x 1.810 (shared). */
export const CRATE_GLB = { width: 1.88, height: 1.335, depth: 1.81 } as const;
/** One crate in a stock stack: 0.78 m across, 0.55 m tall. */
export const CRATE_SIZE = 0.78;
const CRATE_H = (CRATE_GLB.height / CRATE_GLB.width) * CRATE_SIZE;
const PALLET_H = 0.14;
const CRATE: ModelAsset = { ...SHARED_ASSETS.crate, id: "cart-crate", scale: CRATE_SIZE / CRATE_GLB.width, budget: { ...PROP_BUDGET } };

/** Crates filling a pallet footprint, two high (inside the piece's rules box). */
export function crateSpots(piece: { x: number; z: number; w: number; d: number }, rotY = 0): InstanceSpot[] {
   const cols = Math.max(1, Math.floor((piece.w + 0.02) / CRATE_SIZE));
   const rows = Math.max(1, Math.floor((piece.d + 0.02) / CRATE_SIZE));
   const out: InstanceSpot[] = [];
   for (let layer = 0; layer < 2; layer++) for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      // the top layer leaves a corner gap so the stack reads as stacked stock, not one block
      if (layer === 1 && c === cols - 1 && r === 0 && cols > 1) continue;
      out.push({
         x: piece.x + (c - (cols - 1) / 2) * CRATE_SIZE,
         y: PALLET_H + layer * CRATE_H,
         z: piece.z + (r - (rows - 1) / 2) * CRATE_SIZE,
         rotY: rotY + ((c + r + layer) % 2) * 0.06,
      });
   }
   return out;
}

function CrateFallback({ spots }: { spots: InstanceSpot[] }) {
   return (
      <Instanced spots={spots.map((s) => ({ ...s, y: (s.y ?? 0) + CRATE_H / 2 }))}>
         <boxGeometry args={[CRATE_SIZE * 0.96, CRATE_H, CRATE_SIZE * 0.96]} />
         <meshStandardMaterial color="#b45309" roughness={0.8} />
      </Instanced>
   );
}

function Pieces({ pieces, pallet }: { pieces: readonly SetPiece[]; pallet: string }) {
   const crates = useMemo(() => pieces.filter((p) => p.kind === "crates").flatMap((p) => crateSpots(p)), [pieces]);
   const pallets = useMemo<InstanceSpot[]>(() => pieces.filter((p) => p.kind === "crates").map((p) => ({ x: p.x, y: PALLET_H / 2, z: p.z, sx: p.w, sy: PALLET_H, sz: p.d })), [pieces]);
   const stands = useMemo(() => pieces.filter((p) => p.kind === "fruitStand").map((p) => ({ x: p.x, y: 0, z: p.z, rotY: 0 })), [pieces]);
   const coolers = useMemo(() => pieces.filter((p) => p.kind === "cooler").map((p) => ({ x: p.x, y: 0, z: p.z, rotY: -Math.PI / 2 })), [pieces]);
   const bakeries = useMemo(() => pieces.filter((p) => p.kind === "bakery").map((p) => ({ x: p.x, y: 0, z: p.z, rotY: 0 })), [pieces]);
   const box = (spots: { x: number; z: number }[], w: number, h: number, d: number, color: string) => (
      <Instanced spots={spots.map((s) => ({ ...s, y: h / 2 }))}>
         <boxGeometry args={[w, h, d]} />
         <meshStandardMaterial color={color} roughness={0.7} />
      </Instanced>
   );
   return (
      <group name="set-pieces">
         {pallets.length > 0 && (
            <Instanced spots={pallets}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={pallet} roughness={0.85} />
            </Instanced>
         )}
         {crates.length > 0 && <InstancedModel asset={CRATE} spots={crates} fallback={<CrateFallback spots={crates} />} />}
         {stands.length > 0 && <InstancedModel asset={ASSETS.fruitStand} spots={stands} fallback={box(stands, MARKET_DRAWN.fruitStand.width, 1.4, MARKET_DRAWN.fruitStand.depth, "#a16207")} />}
         {coolers.length > 0 && <InstancedModel asset={ASSETS.freezerCase} spots={coolers} fallback={box(coolers, MARKET_DRAWN.freezerCase.depth, 2, MARKET_DRAWN.freezerCase.width, "#bae6fd")} />}
         {bakeries.length > 0 && <InstancedModel asset={ASSETS.bakery} spots={bakeries} fallback={box(bakeries, BAKERY_DRAWN.width, 2.4, BAKERY_DRAWN.depth, "#f59e0b")} />}
      </group>
   );
}

/** A stock pallet on the move: a pallet and four crates (one group, moved each frame). */
const PALLET_LOAD: InstanceSpot[] = crateSpots({ x: 0, z: 0, w: 1.56, d: 0.78 }).filter((s) => (s.y ?? 0) < PALLET_H + 0.01).concat(crateSpots({ x: 0, z: 0, w: 0.78, d: 0.78 }).filter((s) => (s.y ?? 0) > PALLET_H + 0.01));

function MoverModel({ mover }: { mover: Mover }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const a = mover.agent;
      g.position.set(a.x, 0, a.z);
      if (Math.hypot(a.vx, a.vz) > 0.05) g.rotation.y = Math.atan2(a.vx, a.vz);
      // a stunned-cart grace period blinks the machine's warning light
      const light = g.children[g.children.length - 1];
      if (light) light.visible = mover.graceTimer > 0 ? Math.sin(time.now * 20) > 0 : true;
   });
   return (
      <group ref={ref}>
         {mover.kind === "scrubber" ? (
            <Model asset={ASSETS.scrubber} />
         ) : (
            <group>
               <mesh position={[0, PALLET_H / 2, 0]}>
                  <boxGeometry args={[1.6, PALLET_H, 0.82]} />
                  <meshStandardMaterial color="#92400e" roughness={0.85} />
               </mesh>
               {PALLET_LOAD.map((s, i) => (
                  <group key={i} position={[s.x, s.y ?? 0, s.z]} rotation-y={s.rotY ?? 0}>
                     <Model asset={CRATE} />
                  </group>
               ))}
               <mesh position={[0, 0.55, 0.62]}>
                  <boxGeometry args={[0.08, 1.1, 0.08]} />
                  <meshStandardMaterial color="#475569" />
               </mesh>
            </group>
         )}
         <BlobShadow radius={0.7} opacity={0.35} />
         <mesh position={[0, mover.kind === "scrubber" ? 1.45 : 1.25, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.6} />
         </mesh>
      </group>
   );
}

const drawClosed = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.fillStyle = "#facc15";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "#0f172a";
   for (let x = -h; x < w; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 24, h);
      ctx.lineTo(x + 24 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
   }
   ctx.fillStyle = "#dc2626";
   ctx.fillRect(w * 0.12, h * 0.22, w * 0.76, h * 0.56);
   ctx.fillStyle = "#ffffff";
   ctx.font = `bold ${Math.round(h * 0.36)}px sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText("CLOSED", w / 2, h / 2);
};

/** The west lane's shutter: it drops in over half a second when the rules shut the lane. */
function LaneShutter({ run }: { run: RunState }) {
   const ref = useRef<Group>(null);
   const sign = useCanvasTexture(256, 96, drawClosed);
   const drop = useRef(0);
   useFrame((_s, delta) => {
      const g = ref.current;
      if (!g) return;
      drop.current = run.laneClosed ? Math.min(1, drop.current + delta * 2) : 0;
      g.visible = drop.current > 0;
      g.position.y = (1 - drop.current) * 1.4;
   });
   const cx = (LANE_GATE.min.x + LANE_GATE.max.x) / 2;
   const w = LANE_GATE.max.x - LANE_GATE.min.x;
   return (
      <group position={[cx, 0, 8.9]}>
         <group ref={ref} visible={false}>
            <mesh position={[0, 0.55, 0]}>
               <boxGeometry args={[w, 1.1, 0.12]} />
               <meshStandardMaterial map={sign} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.55, -0.9]}>
               <boxGeometry args={[w, 1.1, 0.12]} />
               <meshStandardMaterial map={sign} roughness={0.5} />
            </mesh>
         </group>
      </group>
   );
}

function ExtraSpills({ level, run }: { level: ShoppingCartLevel; run: RunState }) {
   const refs = useRef<(Group | null)[]>([]);
   useFrame(() => {
      level.store.spills.forEach((spill, i) => {
         const g = refs.current[i];
         if (g) g.visible = run.playTimeS >= spill.spawnS;
      });
   });
   return (
      <group>
         {level.store.spills.map((spill, i) => (
            <group key={i} ref={(g) => { refs.current[i] = g; }} position={[spill.x, 0.012, spill.z]} visible={spill.spawnS <= 0}>
               <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[spill.radius, 24]} />
                  <meshStandardMaterial color={COLORS.spillWater} roughness={0.12} metalness={0.3} transparent opacity={0.8} />
               </mesh>
               <mesh position={[0.8, 0.25, 0]}>
                  <coneGeometry args={[0.15, 0.5, 8]} />
                  <meshStandardMaterial color={COLORS.coneYellow} roughness={0.35} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

/** A coloured stripe across the cross walkways (the level's accent), under everything. */
function Stripes({ color }: { color: string }) {
   return (
      <group>
         {[-9.05, 6.0].map((z) => (
            <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.004, z]}>
               <planeGeometry args={[24, 0.18]} />
               <meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} />
            </mesh>
         ))}
      </group>
   );
}

export default function StoreSetPieces({ run }: { run: RunState }) {
   const level = run.level;
   const store = level.store;
   const look = STORE_LOOKS[store.theme];
   if (store.theme === "mini") return null;
   return (
      <group name="store-set-pieces">
         {look.stripe && <Stripes color={look.stripe} />}
         <Pieces pieces={store.pieces} pallet={look.pallet} />
         {run.movers?.map((mover, i) => <MoverModel key={i} mover={mover} />)}
         {store.closeLaneAt > 0 && <LaneShutter run={run} />}
         <ExtraSpills level={level} run={run} />
      </group>
   );
}
