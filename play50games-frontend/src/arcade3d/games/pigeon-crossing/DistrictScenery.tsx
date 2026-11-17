"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { COVER_HEIGHT, type Horizon } from "./camera";
import type { DistrictMap, DistrictPalette, DistrictProp, DistrictSetPiece, PropKind } from "./maps";
import { COVER_INNER_X, ROW_PITCH, ROWS_PER_LEVEL, type PigeonRun } from "./rules";

const BLOCK_SPAN_Z = ROWS_PER_LEVEL * ROW_PITCH;

function unitAsset(id: string, url: string, glbHeight: number, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset {
   return { id, url, scale: 1 / glbHeight, fallback, fallbackColor, budget: { ...PROP_BUDGET } };
}

/** All 15 prop GLBs are in core/modelManifest.ts and normalized to 1 m unit height. */
export const DISTRICT_PROP_ASSETS: Record<PropKind, ModelAsset> = {
   townhouse: unitAsset("townhouseBlock", "/models/3d/taxi-rush-3d/townhouseBlock.glb", 1.8983, "box", "#d97757"),
   shop: unitAsset("cornerShop", "/models/3d/taxi-rush-3d/cornerShop.glb", 1.2808, "box", "#f59e0b"),
   busStop: unitAsset("busStop", "/models/3d/taxi-rush-3d/busStop.glb", 1.239, "box", "#2563eb"),
   tree: unitAsset("leafyTree", "/models/3d/shared/leafyTree.glb", 1.9133, "cylinder", "#65a30d"),
   pine: unitAsset("pineTree", "/models/3d/shared/pineTree.glb", 1.9181, "cylinder", "#166534"),
   cone: unitAsset("trafficCone", "/models/3d/shared/trafficCone.glb", 1.8767, "cylinder", "#f97316"),
   bench: unitAsset("bench", "/models/3d/clean-city/bench.glb", 0.8419, "box", "#92400e"),
   bin: unitAsset("bin", "/models/3d/clean-city/bin.glb", 1.899, "cylinder", "#64748b"),
   trafficLight: unitAsset("trafficLight", "/models/3d/shared/trafficLight.glb", 1.8964, "box", "#334155"),
   brickApartment: unitAsset("cityBrickApartment", "/models/3d/delivery-drone/cityBrickApartment.glb", 1.8988, "box", "#b45309"),
   glassOffice: unitAsset("cityGlassOffice", "/models/3d/delivery-drone/cityGlassOffice.glb", 1.8964, "box", "#38bdf8"),
   tallTower: unitAsset("cityBuildingTall", "/models/3d/delivery-drone/cityBuildingTall.glb", 1.893, "box", "#64748b"),
   officeBlock: unitAsset("cityBuildingV2", "/models/3d/delivery-drone/cityBuildingV2.glb", 1.654, "box", "#94a3b8"),
   lamp: unitAsset("lamp", "/models/3d/clean-city/lamp.glb", 1.9002, "cylinder", "#fbbf24"),
   barrier: unitAsset("roadBarrier", "/models/3d/burger-delivery-scooter/roadBarrier.glb", 0.9729, "box", "#fb7185"),
};

function PropFallback({ prop, palette }: { prop: DistrictProp; palette: DistrictPalette }) {
   const w = prop.halfX * 1.6, d = prop.halfZ * 1.6, h = prop.height;
   if (prop.kind === "tree" || prop.kind === "pine") {
      return (
         <group>
            <mesh position={[0, h * 0.25, 0]}><cylinderGeometry args={[0.14, 0.18, h * 0.5, 8]} /><meshStandardMaterial color="#784f32" roughness={0.9} /></mesh>
            <mesh position={[0, h * 0.65, 0]}><sphereGeometry args={[w * 0.55, 10, 8]} /><meshStandardMaterial color="#589b4c" roughness={0.85} /></mesh>
         </group>
      );
   }
   if (prop.kind === "lamp" || prop.kind === "trafficLight") {
      return (
         <group>
            <mesh position={[0, h * 0.5, 0]}><cylinderGeometry args={[0.07, 0.1, h, 8]} /><meshStandardMaterial color="#334155" roughness={0.6} /></mesh>
            <mesh position={[0, h * 0.92, 0]}><sphereGeometry args={[0.2, 8, 8]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.7} /></mesh>
         </group>
      );
   }
   return (
      <mesh position={[0, h * 0.5, 0]}>
         <boxGeometry args={[w, h, d]} />
         <meshStandardMaterial color={DISTRICT_PROP_ASSETS[prop.kind].fallbackColor ?? palette.terrace} roughness={0.75} />
      </mesh>
   );
}

function SetPieceMesh({ piece, palette, night }: { piece: DistrictSetPiece; palette: DistrictPalette; night: boolean }) {
   const h = piece.height;
   switch (piece.kind) {
      case "bus-layby":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, 0.06, 0]}><boxGeometry args={[3.4, 0.12, 1.8]} /><meshStandardMaterial color={palette.terrace} roughness={0.85} /></mesh>
               <mesh position={[0, 0.13, 0.72]}><boxGeometry args={[3.2, 0.04, 0.18]} /><meshStandardMaterial color={palette.accent} roughness={0.65} /></mesh>
               <mesh position={[-1.2, h * 0.45, -0.4]}><cylinderGeometry args={[0.08, 0.08, h * 0.9, 8]} /><meshStandardMaterial color="#334155" roughness={0.6} /></mesh>
               <mesh position={[1.2, h * 0.45, -0.4]}><cylinderGeometry args={[0.08, 0.08, h * 0.9, 8]} /><meshStandardMaterial color="#334155" roughness={0.6} /></mesh>
               <mesh position={[0, h * 0.9, -0.1]}><boxGeometry args={[2.9, 0.16, 1.3]} /><meshStandardMaterial color="#2563eb" roughness={0.55} /></mesh>
            </group>
         );
      case "crosswalk-beacon":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, h * 0.48, 0]}><cylinderGeometry args={[0.07, 0.1, h * 0.96, 8]} /><meshStandardMaterial color="#475569" roughness={0.6} /></mesh>
               <mesh position={[0, h * 0.85, 0]}><boxGeometry args={[0.42, 0.42, 0.14]} /><meshStandardMaterial color="#facc15" roughness={0.5} /></mesh>
               <mesh position={[0, h, 0]}><sphereGeometry args={[0.16, 10, 8]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.65} /></mesh>
            </group>
         );
      case "signal-cantilever":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, h * 0.5, 0]}><cylinderGeometry args={[0.1, 0.13, h, 8]} /><meshStandardMaterial color="#334155" roughness={0.55} /></mesh>
               <mesh position={[0, h * 0.92, 0.35]}><boxGeometry args={[0.14, 0.14, 0.85]} /><meshStandardMaterial color="#334155" roughness={0.55} /></mesh>
               <mesh position={[0, h * 0.84, 0.65]}><boxGeometry args={[0.28, 0.58, 0.22]} /><meshStandardMaterial color="#1e293b" roughness={0.5} /></mesh>
               <mesh position={[0, h * 0.96, 0.77]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} /></mesh>
               <mesh position={[0, h * 0.84, 0.77]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.8} /></mesh>
               <mesh position={[0, h * 0.72, 0.77]}><sphereGeometry args={[0.07, 8, 8]} /><meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.8} /></mesh>
            </group>
         );
      case "pocket-plaza":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, 0.07, 0]}><boxGeometry args={[3.2, 0.14, 2.0]} /><meshStandardMaterial color={palette.terrace} roughness={0.85} /></mesh>
               <mesh position={[-0.9, 0.32, 0.3]}><boxGeometry args={[0.9, 0.38, 0.9]} /><meshStandardMaterial color="#78350f" roughness={0.8} /></mesh>
               <mesh position={[-0.9, 0.72, 0.3]}><sphereGeometry args={[0.45, 10, 8]} /><meshStandardMaterial color="#4d7c0f" roughness={0.85} /></mesh>
               <mesh position={[0.7, h * 0.42, -0.2]}><cylinderGeometry args={[0.06, 0.06, h * 0.84, 8]} /><meshStandardMaterial color="#78350f" roughness={0.7} /></mesh>
               <mesh position={[0.7, h * 0.85, -0.2]}><cylinderGeometry args={[0.12, 0.85, 0.42, 8]} /><meshStandardMaterial color={palette.accent} roughness={0.65} /></mesh>
            </group>
         );
      case "neon-pylon":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, h * 0.5, 0]}><boxGeometry args={[0.42, h, 0.42]} /><meshStandardMaterial color="#1e293b" roughness={0.5} /></mesh>
               <mesh position={[0, h * 0.35, 0.22]}><boxGeometry args={[0.16, h * 0.55, 0.06]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={night ? 1.1 : 0.6} /></mesh>
               <mesh position={[0, h * 0.92, 0]}><cylinderGeometry args={[0.32, 0.32, 0.24, 12]} /><meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.9} /></mesh>
               <mesh position={[0, 0.02, 0.35]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.85, 16]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.45} /></mesh>
            </group>
         );
      case "sound-wall":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, h * 0.5, 0]}><boxGeometry args={[3.6, h, 0.36]} /><meshStandardMaterial color="#334155" roughness={0.75} /></mesh>
               <mesh position={[-1.6, h * 0.52, 0.06]}><boxGeometry args={[0.24, h * 1.04, 0.44]} /><meshStandardMaterial color="#1e293b" roughness={0.65} /></mesh>
               <mesh position={[1.6, h * 0.52, 0.06]}><boxGeometry args={[0.24, h * 1.04, 0.44]} /><meshStandardMaterial color="#1e293b" roughness={0.65} /></mesh>
               <mesh position={[0, h * 0.82, 0.2]}><boxGeometry args={[3.1, 0.14, 0.06]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.85} /></mesh>
            </group>
         );
      case "rush-gantry":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, h * 0.5, 0]}><boxGeometry args={[0.48, h, 0.48]} /><meshStandardMaterial color="#475569" roughness={0.55} /></mesh>
               <mesh position={[0, h * 0.88, 0.35]}><boxGeometry args={[0.36, 0.9, 0.85]} /><meshStandardMaterial color="#1e293b" roughness={0.5} /></mesh>
               <mesh position={[0, h * 0.88, 0.79]}><boxGeometry args={[0.28, 0.65, 0.05]} /><meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={0.85} /></mesh>
               <mesh position={[0, h * 1.02, 0.55]}><sphereGeometry args={[0.15, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.9} /></mesh>
            </group>
         );
      case "work-barricade":
         return (
            <group position={[piece.x, piece.y, piece.z]} rotation={[0, piece.yaw, 0]}>
               <mesh position={[0, 0.42, 0]}><boxGeometry args={[2.4, 0.84, 0.45]} /><meshStandardMaterial color="#f97316" roughness={0.65} /></mesh>
               <mesh position={[0, 0.62, 0.24]}><boxGeometry args={[2.2, 0.22, 0.04]} /><meshStandardMaterial color="#fef08a" roughness={0.5} /></mesh>
               <mesh position={[-0.85, 1.02, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.85} /></mesh>
               <mesh position={[0.85, 1.02, 0]}><sphereGeometry args={[0.14, 8, 8]} /><meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.85} /></mesh>
            </group>
         );
   }
}

const DistrictBlock = memo(function DistrictBlock({ map }: { map: DistrictMap }) {
   const night = map.theme === "night-traffic" || map.theme === "rush-hour";
   return (
      <>
         {map.props.map((p, i) => (
            <group key={`p-${i}`} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]}>
               <group scale={p.height}>
                  <Model asset={DISTRICT_PROP_ASSETS[p.kind]} fallback={<PropFallback prop={p} palette={map.palette} />} />
               </group>
            </group>
         ))}
         {map.setPieces.map((s, i) => (
            <SetPieceMesh key={`s-${i}`} piece={s} palette={map.palette} night={night} />
         ))}
      </>
   );
});

export const DistrictScenery = memo(function DistrictScenery({
   run,
   horizon,
}: {
   run: PigeonRun;
   horizon: Horizon;
}) {
   const map = run.config.map;
   const leftTrim = useRef<Mesh>(null), rightTrim = useRef<Mesh>(null);
   const slot0 = useRef<Group>(null), slot1 = useRef<Group>(null), slot2 = useRef<Group>(null);
   const night = map.theme === "night-traffic";

   useFrame(() => {
      if (map.id === 1) return;
      const length = Math.max(1, horizon.coverMaxZ - horizon.coverMinZ);
      const z = (horizon.coverMaxZ + horizon.coverMinZ) / 2;
      if (leftTrim.current) {
         leftTrim.current.position.set(-COVER_INNER_X - 0.16, COVER_HEIGHT + 0.04, z);
         leftTrim.current.scale.set(0.28, 0.08, length);
      }
      if (rightTrim.current) {
         rightTrim.current.position.set(COVER_INNER_X + 0.16, COVER_HEIGHT + 0.04, z);
         rightTrim.current.scale.set(0.28, 0.08, length);
      }
      const centerBlock = Math.floor(run.player.row / ROWS_PER_LEVEL);
      for (let d = -1; d <= 1; d++) {
         const b = centerBlock + d;
         const slot = ((b % 3) + 3) % 3;
         const group = slot === 0 ? slot0.current : slot === 1 ? slot1.current : slot2.current;
         if (group) group.position.z = -b * BLOCK_SPAN_Z;
      }
   });

   if (map.id === 1) return null;

   return (
      <group name={`district-${map.theme}`}>
         <mesh ref={leftTrim}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={map.palette.coverTrim} emissive={night ? map.palette.coverTrim : "#000000"} emissiveIntensity={night ? 0.65 : 0} roughness={0.7} />
         </mesh>
         <mesh ref={rightTrim}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={map.palette.coverTrim} emissive={night ? map.palette.coverTrim : "#000000"} emissiveIntensity={night ? 0.65 : 0} roughness={0.7} />
         </mesh>
         <group ref={slot0} position={[0, 0, 0]}><DistrictBlock map={map} /></group>
         <group ref={slot1} position={[0, 0, -BLOCK_SPAN_Z]}><DistrictBlock map={map} /></group>
         <group ref={slot2} position={[0, 0, BLOCK_SPAN_Z]}><DistrictBlock map={map} /></group>
      </group>
   );
});
