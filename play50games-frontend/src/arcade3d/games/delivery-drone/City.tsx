"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Group } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced } from "@/arcade3d/core/render";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { hover, type BodyOffset } from "@/arcade3d/core/motion";
import { advance, createPath, tangentAt } from "@/arcade3d/core/path";
import { ASSETS, BLOCK_FALLBACK, BLOCK_HEIGHT, BLOCK_SPOTS, BLOCK_WIDTH, TALL_FALLBACK, TALL_HEIGHT, TALL_SPOTS, TALL_WIDTH, BRICK_FALLBACK, BRICK_HEIGHT, BRICK_SPOTS, GLASS_FALLBACK, GLASS_HEIGHT, GLASS_SPOTS, SKYLINE_FOOTPRINT } from "./assets";
import { CITY, ROUTE, type Run, type City } from "./rules";
import { mergedBoxes, useMergedPart } from "./Primitives";
import { COLORS, GROUND_PLANE, PARK } from "./looks";
import { ROOF_CAP, ROOFTOP_OVERLAY_Y } from "./visuals";
import { Decor } from "./Decor";

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);
const WIND_TILT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
type BoxPiece = readonly [number, number, number, number, number, number, string];

const CRATES = [
   { x: -2.6, y: 0, z: 2 },
   { x: -2.6, y: 0, z: 3 },
   { x: -2.6, y: 0.57, z: 2.5 },
   { x: -3.5, y: 0, z: 2.5 },
];
const CRATE_FALLBACK = CRATES.map((p) => ({ ...p, y: p.y + 0.285 }));
const TREES = [
   { x: -3.2, y: 0, z: -3.2 },
   { x: 3.2, y: 0, z: -3.2 },
   { x: 3.2, y: 0, z: 3.2 },
   { x: -3.2, y: 0, z: 4.2 },
];

/** Street markings along the 8x8 grid. */
const STREET_MARKINGS = [
   // North-South avenue divider stripes
   ...Array.from({ length: 7 }, (_, i) => ({
      x: (i - 3) * CITY.pitch,
      y: 0.006,
      z: 0,
      sx: 0.12,
      sy: 0.01,
      sz: 60,
   })),
   // East-West cross-street divider stripes
   ...Array.from({ length: 7 }, (_, i) => ({
      x: 0,
      y: 0.006,
      z: (i - 3) * CITY.pitch,
      sx: 60,
      sy: 0.01,
      sz: 0.12,
   })),
];

/**
 * Procedural city chunks:
 * 16 pre-merged chunks covering the 64 city cells.
 * Each building has multi-tone architectural facades, dark street-level plinths,
 * multi-pane windows with warm/cool lighting, raised parapet roof trims,
 * recessed roof deck membranes, and authentic rooftop equipment.
 * Target roofs retain clean flat pad clearance (r = 1.5m).
 * Towers have skyscraper crowns and high-contrast coral/yellow hazard stripes.
 */
function CityChunks({ city }: { city: City }) {
   const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), []);

   const chunks = useMemo(
      () =>
         Array.from({ length: 16 }, (_, chunkIdx) => {
            const pieces: BoxPiece[] = [];

            for (let bIdx = 0; bIdx < city.buildings.length; bIdx++) {
               const b = city.buildings[bIdx];
               if (Math.floor(b.cell / 16) * 4 + Math.floor((b.cell % 8) / 2) !== chunkIdx) continue;

               const isTarget = city.targets.includes(bIdx);
               const facade = COLORS.facades[b.cell % COLORS.facades.length];

               // 1. Pedestrian sidewalk block with curb around the building
               pieces.push([b.x, 0.015, b.z, 6.2, 0.03, 6.2, COLORS.sidewalk]);
               pieces.push([b.x, 0.02, b.z, 6.3, 0.025, 6.3, COLORS.curb]);

               // 2. Building ground-level plinth tier (dark architectural base)
               const plinthHeight = Math.min(0.9, b.height * 0.25);
               pieces.push([b.x, plinthHeight / 2, b.z, 5.06, plinthHeight, 5.06, facade.base]);

               // 3. Main building facade body
               const mainBodyHeight = b.height - plinthHeight;
               pieces.push([
                  b.x,
                  plinthHeight + mainBodyHeight / 2,
                  b.z,
                  5.0,
                  mainBodyHeight,
                  5.0,
                  facade.wall,
               ]);

               // 4. Corner pilasters / architectural trim
               for (const cx of [-2.45, 2.45]) {
                  for (const cz of [-2.45, 2.45]) {
                     pieces.push([b.x + cx, b.height / 2, b.z + cz, 0.22, b.height, 0.22, facade.trim]);
                  }
               }

               // 5. Multi-pane window grid with warm interior and cool reflective glass
               for (let y = 1.4; y < b.height - 0.7; y += 1.8) {
                  for (let column = -1; column <= 1; column++) {
                     const isWarm = (b.cell + Math.floor(y) + column) % 3 === 0;
                     const winColor = isWarm ? COLORS.windowWarm : COLORS.windowCool;
                     // South and North window bands
                     pieces.push([b.x + column * 1.3, y, b.z + 2.51, 0.65, 0.85, 0.025, winColor]);
                     pieces.push([b.x + column * 1.3, y, b.z - 2.51, 0.65, 0.85, 0.025, winColor]);
                     // East and West window bands
                     pieces.push([b.x + 2.51, y, b.z + column * 1.3, 0.025, 0.85, 0.65, winColor]);
                     pieces.push([b.x - 2.51, y, b.z + column * 1.3, 0.025, 0.85, 0.65, winColor]);
                  }
               }

               // 6. Roof structure:
               // Recessed roof deck membrane
               pieces.push([
                  b.x,
                  b.height + ROOF_CAP.centerY,
                  b.z,
                  4.85,
                  ROOF_CAP.thickness,
                  4.85,
                  COLORS.roofDeck,
               ]);

               // Raised parapet perimeter rim
               pieces.push([b.x, b.height + 0.045, b.z - 2.46, 5.04, 0.07, 0.12, COLORS.roofTrim]);
               pieces.push([b.x, b.height + 0.045, b.z + 2.46, 5.04, 0.07, 0.12, COLORS.roofTrim]);
               pieces.push([b.x - 2.46, b.height + 0.045, b.z, 0.12, 0.07, 4.8, COLORS.roofTrim]);
               pieces.push([b.x + 2.46, b.height + 0.045, b.z, 0.12, 0.07, 4.8, COLORS.roofTrim]);

               // 7. Rooftop Equipment:
               if (b.tower) {
                  // Skyscraper architectural crown
                  pieces.push([b.x, b.height + 0.35, b.z, 4.4, 0.7, 4.4, COLORS.towerCrown]);

                  // Hazard warning bands (alternating coral red and amber caution)
                  for (let k = -2; k <= 2; k++) {
                     const isOdd = Math.abs(k) % 2 === 1;
                     const hazardColor = isOdd ? COLORS.towerHazardA : COLORS.towerHazardB;
                     pieces.push([b.x + k * 0.9, b.height + 0.72, b.z, 0.8, 0.06, 4.42, hazardColor]);
                     pieces.push([b.x, b.height + 0.72, b.z + k * 0.9, 4.42, 0.06, 0.8, hazardColor]);
                  }

                  // Central communication mast & beacon
                  pieces.push([b.x, b.height + 1.2, b.z, 0.22, 1.4, 0.22, COLORS.roofMetal]);
                  pieces.push([b.x, b.height + 1.95, b.z, 0.24, 0.24, 0.24, COLORS.towerBeacon]);
               } else if (!isTarget) {
                  // Non-target buildings receive authentic urban rooftop details:
                  // Stairwell penthouse / roof access
                  pieces.push([b.x - 1.4, b.height + 0.38, b.z - 1.4, 1.1, 0.72, 1.1, facade.wall]);
                  pieces.push([b.x - 1.4, b.height + 0.76, b.z - 1.4, 1.2, 0.06, 1.2, COLORS.roofTrim]);

                  // AC / HVAC compressor units
                  pieces.push([b.x + 1.2, b.height + 0.24, b.z - 1.1, 0.9, 0.44, 1.3, COLORS.roofHvac]);
                  pieces.push([b.x + 1.2, b.height + 0.48, b.z - 1.1, 0.6, 0.08, 0.6, COLORS.roofMetal]);

                  // Solar panel arrays or skylights
                  if (b.cell % 2 === 0) {
                     pieces.push([b.x + 0.6, b.height + 0.16, b.z + 1.2, 1.6, 0.08, 1.4, COLORS.solarPanel]);
                     pieces.push([b.x - 1.1, b.height + 0.16, b.z + 1.2, 1.4, 0.08, 1.4, COLORS.solarPanel]);
                  } else {
                     pieces.push([b.x - 0.2, b.height + 0.18, b.z + 1.1, 1.8, 0.24, 1.2, COLORS.windowCool]);
                     pieces.push([b.x + 1.3, b.height + 0.18, b.z + 1.1, 0.8, 0.32, 0.8, COLORS.roofMetal]);
                  }
               } else {
                  // Target buildings: keep centre radius 1.5m completely flat for the target pad.
                  // Only add subtle corner gravel border markings:
                  for (const cx of [-2.0, 2.0]) {
                     for (const cz of [-2.0, 2.0]) {
                        pieces.push([b.x + cx, b.height + 0.05, b.z + cz, 0.5, 0.04, 0.5, COLORS.roofHvac]);
                     }
                  }
               }
            }

            return pieces.length ? mergedBoxes(pieces) : null;
         }),
      [city]
   );

   useEffect(() => () => {
      for (const g of chunks) g?.dispose();
      material.dispose();
   }, [chunks, material]);

   return (
      <group name="city-chunks">
         {chunks.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={material} dispose={null} />)}
      </group>
   );
}

/** Low-poly modern traffic with multi-part fallbacks sharing 1 draw call per vehicle pool. */
function Traffic({ run }: { run: Run }) {
   const carParts = useMergedPart([
      // Sporty car body, white cabin, dark windshield, headlights, taillights, wheels
      [0, 0.14, 0, 0.8, 0.22, 1.6, COLORS.carBody],
      [0, 0.32, -0.06, 0.68, 0.22, 0.88, COLORS.carRoof],
      [0, 0.32, 0.38, 0.64, 0.18, 0.04, COLORS.vehicleGlass],
      [0, 0.32, -0.51, 0.64, 0.18, 0.04, COLORS.vehicleGlass],
      [0.26, 0.15, 0.81, 0.16, 0.08, 0.03, COLORS.headlight],
      [-0.26, 0.15, 0.81, 0.16, 0.08, 0.03, COLORS.headlight],
      [0.26, 0.18, -0.81, 0.16, 0.08, 0.03, COLORS.taillight],
      [-0.26, 0.18, -0.81, 0.16, 0.08, 0.03, COLORS.taillight],
      [0.41, 0.11, 0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [-0.41, 0.11, 0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [0.41, 0.11, -0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [-0.41, 0.11, -0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
   ]);

   const taxiParts = useMergedPart([
      // Taxi body, roof sign, dark windshield, wheels
      [0, 0.14, 0, 0.8, 0.22, 1.6, COLORS.taxiBody],
      [0, 0.32, -0.06, 0.68, 0.22, 0.88, COLORS.taxiBody],
      [0, 0.46, -0.06, 0.22, 0.08, 0.14, COLORS.taxiSign],
      [0, 0.32, 0.38, 0.64, 0.18, 0.04, COLORS.vehicleGlass],
      [0, 0.32, -0.51, 0.64, 0.18, 0.04, COLORS.vehicleGlass],
      [0.26, 0.15, 0.81, 0.16, 0.08, 0.03, COLORS.headlight],
      [-0.26, 0.15, 0.81, 0.16, 0.08, 0.03, COLORS.headlight],
      [0.41, 0.11, 0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [-0.41, 0.11, 0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [0.41, 0.11, -0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
      [-0.41, 0.11, -0.48, 0.08, 0.2, 0.26, COLORS.droneDark],
   ]);

   const vanParts = useMergedPart([
      // High-capacity delivery van with blue stripe
      [0, 0.42, -0.15, 0.9, 0.7, 1.7, COLORS.vanBody],
      [0, 0.3, 0.75, 0.9, 0.48, 0.5, COLORS.vanBody],
      [0, 0.36, -0.15, 0.92, 0.12, 1.72, COLORS.vanStripe],
      [0, 0.36, 0.96, 0.7, 0.24, 0.04, COLORS.vehicleGlass],
      [0.46, 0.13, 0.6, 0.08, 0.24, 0.28, COLORS.droneDark],
      [-0.46, 0.13, 0.6, 0.08, 0.24, 0.28, COLORS.droneDark],
      [0.46, 0.13, -0.6, 0.08, 0.24, 0.28, COLORS.droneDark],
      [-0.46, 0.13, -0.6, 0.08, 0.24, 0.28, COLORS.droneDark],
   ]);

   const { decor } = useQuality();
   const count = scaledCount(4, decor);
   const [scratch] = useState(() => ({
      q: new Quaternion(),
      v: new Vector3(),
      tangent: { x: 0, y: 0, z: 0 },
   }));

   const [cars] = useState(() =>
      Array.from({ length: 12 }, (_, i) => {
         const r = i % 2 ? 15 : 22.5;
         const path = createPath(
            [
               { x: -r, y: 0.05, z: -r },
               { x: r, y: 0.05, z: -r },
               { x: r, y: 0.05, z: r },
               { x: -r, y: 0.05, z: r },
            ],
            { closed: true }
         );
         const state = { path, s: i * 7, position: { x: 0, y: 0, z: 0 }, time: 0 };
         advance(state, 0);
         return state;
      })
   );

   const place = (kind: number, i: number, m: Matrix4) => {
      if (i >= count) return false;
      const speed = kind === 0 ? 4 : kind === 1 ? 5 : 3;
      const car = cars[kind * 4 + i];
      advance(car, (run.time - car.time) * speed);
      car.time = run.time;
      tangentAt(car.path, car.s, scratch.tangent);
      scratch.q.setFromAxisAngle(UP, Math.atan2(scratch.tangent.x, scratch.tangent.z));
      scratch.v.set(car.position.x, car.position.y, car.position.z);
      m.compose(scratch.v, scratch.q, ONE);
   };

   return (
      <group name="traffic">
         <DynamicInstancedModel asset={ASSETS.car} count={4} update={(i, m) => place(0, i, m)} fallbackParts={carParts} />
         <DynamicInstancedModel asset={ASSETS.taxi} count={4} update={(i, m) => place(1, i, m)} fallbackParts={taxiParts} />
         <DynamicInstancedModel asset={ASSETS.van} count={4} update={(i, m) => place(2, i, m)} fallbackParts={vanParts} />
      </group>
   );
}

/** Low-poly pigeon hazard flock with deliberate bird fallback. */
function Birds({ run, reduced }: { run: Run; reduced: boolean }) {
   const pigeonParts = useMergedPart([
      // Body, neck/head, beak, wings and tail
      [0, 0.05, 0, 0.22, 0.16, 0.36, "#64748b"],
      [0, 0.15, 0.16, 0.12, 0.14, 0.14, "#475569"],
      [0, 0.14, 0.25, 0.04, 0.04, 0.07, "#fb923c"],
      [-0.18, 0.08, 0, 0.22, 0.03, 0.28, "#94a3b8"],
      [0.18, 0.08, 0, 0.22, 0.03, 0.28, "#94a3b8"],
      [0, 0.07, -0.22, 0.14, 0.02, 0.16, "#334155"],
   ]);

   const time = useGameTime();
   const [scratch] = useState(() => ({
      q: new Quaternion(),
      v: new Vector3(),
      bob: { y: 0, roll: 0, yaw: 0, squash: 1 } as BodyOffset,
   }));

   return (
      <DynamicInstancedModel
         asset={ASSETS.pigeon}
         count={run.city.birds.length}
         fallbackParts={pigeonParts}
         update={(i, m) => {
            const level = run.level;
            if (
               i >=
               (run.time < level.pigeonMiddleFrom
                  ? level.pigeonInitial
                  : run.time < level.pigeonFinalFrom
                  ? level.pigeonMiddle
                  : level.pigeons)
            )
               return false;
            const b = run.birds[i];
            hover(time.play + i, reduced ? 0 : 0.035, scratch.bob);
            scratch.q.setFromAxisAngle(UP, b.yaw);
            scratch.v.set(b.x, b.y + scratch.bob.y, b.z);
            m.compose(scratch.v, scratch.q, ONE);
         }}
      />
   );
}

/** High-contrast rooftop delivery pads, active beacon beam, and depot landing helipad. */
function Pads({ run }: { run: Run }) {
   const active = useRef<Mesh>(null);
   const beacon = useRef<Mesh>(null);
   const loading = useRef<Mesh>(null);
   const time = useGameTime();

   const [mint] = useState(() => new Color(COLORS.padCompleted));
   const [blue] = useState(() => new Color(COLORS.padActive));
   const [padScale] = useState(() => new Vector3(1, 1, 1));

   useFrame(() => {
      const last = run.city.targets.length - 1;
      const b = run.city.buildings[run.city.targets[Math.min(run.completed, last)]];
      const s = run.level.padRadius / ROUTE.padRadius;
      if (active.current) {
         active.current.position.set(b.x, b.height + ROOFTOP_OVERLAY_Y, b.z);
         active.current.scale.set(s, s, s);
         active.current.visible = run.completed < run.level.count;
      }
      if (beacon.current) {
         beacon.current.position.set(b.x, b.height + 1.4, b.z);
         beacon.current.scale.y = 1 + Math.sin(time.now * 3) * 0.08;
         beacon.current.visible = run.completed < run.level.count;
      }
      if (loading.current) {
         loading.current.scale.setScalar(0.1 + (run.loading / ROUTE.loading) * 0.9);
         loading.current.visible = run.loading > 0;
      }
   });

   return (
      <group name="delivery-pads">
         {/* one ring per route pad; scaled so the rim matches this level's pad radius */}
         <DynamicInstanced
            count={run.city.targets.length}
            tinted
            update={(i, m, color) => {
               const b = run.city.buildings[run.city.targets[i]];
               const s = run.level.padRadius / ROUTE.padRadius;
               m.makeRotationX(-Math.PI / 2);
               m.scale(padScale.set(s, s, s));
               m.setPosition(b.x, b.height + ROOFTOP_OVERLAY_Y, b.z);
               color.copy(i < run.completed ? mint : blue);
            }}
         >
            <ringGeometry args={[1.05, 1.25, 32]} />
            <meshBasicMaterial color="white" />
         </DynamicInstanced>

         {/* Active target disc */}
         <mesh ref={active} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.92, 32]} />
            <meshBasicMaterial color={COLORS.padActive} transparent opacity={0.28} depthWrite={false} />
         </mesh>

         {/* Active target holographic beacon pillar */}
         <mesh ref={beacon}>
            <cylinderGeometry args={[0.08, 0.28, 2.8, 8]} />
            <meshBasicMaterial color={COLORS.padBeam} transparent opacity={0.42} depthWrite={false} />
         </mesh>

         {/* Central depot landing helipad */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]}>
            <ringGeometry args={[1.3, 1.5, 40]} />
            <meshBasicMaterial color={COLORS.depotRing} />
         </mesh>

         {/* Continuous depot loading progress disc */}
         <mesh ref={loading} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[1.25, 40]} />
            <meshBasicMaterial color={COLORS.depotLoading} transparent opacity={0.5} depthWrite={false} />
         </mesh>
      </group>
   );
}

/** Wind particle indicators across street zones. */
function Wind({ run, reduced }: { run: Run; reduced: boolean }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const { decor } = useQuality();
   const [scratch] = useState(() => ({ q: new Quaternion(), v: new Vector3() }));
   const count = scaledCount(32, decor);

   useFrame(() => {
      if (root.current) root.current.visible = run.time >= run.level.windFrom;
   });

   return (
      <group ref={root} visible={false} name="wind">
         <DynamicInstanced
            count={32}
            update={(i, m) => {
               if (i >= count) return false;
               const w = run.city.winds[i % 2];
               const k = Math.floor(i / 2);
               const phase = reduced ? 0 : (time.play * 0.4 + k * 0.17) % 1;
               scratch.q.setFromAxisAngle(UP, Math.atan2(w.ax, w.az)).multiply(WIND_TILT);
               scratch.v.set(
                  w.x + ((k % 4) - 1.5) * 1.7 + w.ax * phase,
                  12 + Math.floor(k / 4) * 0.08,
                  w.z + (Math.floor(k / 4) - 1.5) * 1.7 + w.az * phase
               );
               m.compose(scratch.v, scratch.q, ONE);
            }}
         >
            <coneGeometry args={[0.1, 0.6, 3]} />
            <meshBasicMaterial color="#7dd3fc" transparent opacity={0.55} depthWrite={false} />
         </DynamicInstanced>
      </group>
   );
}

/**
 * Main City visual scene:
 * Expansive 280m ground plane, street grid, central depot park plaza,
 * 16 pre-merged city chunks, traffic, birds, wind, and outer surroundings decor.
 */
export default function CityScene({ run, reduced }: { run: Run; reduced: boolean }) {
   const { decor } = useQuality();
   const trees = useMemo(() => TREES.slice(0, scaledCount(4, decor)), [decor]);
   const treeFallback = useMemo(() => trees.map((p) => ({ ...p, y: p.y + 1.5 })), [trees]);

   return (
      <group name="miniature-city">
         {/* Expansive 280m x 280m ground plane: covers the entire viewport at all viewports and sizes */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_PLANE.y, 0]} name="ground-plane">
            <planeGeometry args={[GROUND_PLANE.size, GROUND_PLANE.size]} />
            <meshStandardMaterial color={COLORS.asphalt} roughness={0.95} />
         </mesh>

         {/* Street grid centre markings */}
         <Instanced spots={STREET_MARKINGS} name="street-markings">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.asphaltMarking} roughness={0.8} />
         </Instanced>

         {/* Central depot park lawn */}
         <mesh position={[0, PARK.y, 0]} name="depot-park-lawn">
            <boxGeometry args={[14.8, 0.03, 14.8]} />
            <meshStandardMaterial color={COLORS.grass} roughness={0.9} />
         </mesh>

         {/* Central depot plaza paved apron */}
         <mesh position={[0, PARK.y + 0.008, 0]} name="depot-plaza-apron">
            <cylinderGeometry args={[4.2, 4.2, 0.02, 32]} />
            <meshStandardMaterial color={COLORS.parkPlaza} roughness={0.8} />
         </mesh>

         {/* 16 City Chunks */}
         <CityChunks city={run.city} />

         {/* Pads, Traffic, Birds, Wind */}
         <Pads run={run} />
         <Traffic run={run} />
         <Birds run={run} reduced={reduced} />
         <Wind run={run} reduced={reduced} />

         {/* Crates at depot */}
         <InstancedModel
            asset={ASSETS.crate}
            spots={CRATES}
            fallback={
               <Instanced spots={CRATE_FALLBACK}>
                  <boxGeometry args={[0.8, 0.57, 0.8]} />
                  <meshStandardMaterial color="#b98955" roughness={0.8} />
               </Instanced>
            }
         />

         {/* Park Trees */}
         <InstancedModel
            asset={ASSETS.tree}
            spots={trees}
            fallback={
               <Instanced spots={treeFallback}>
                  <coneGeometry args={[0.9, 3, 8]} />
                  <meshStandardMaterial color={COLORS.treeFoliageA} roughness={0.9} />
               </Instanced>
            }
         />

         {/* Brick and glass towers in the gap between the z -37 and z -48 skyline rows. */}
         <InstancedModel
            asset={ASSETS.brick}
            spots={BRICK_SPOTS}
            fallback={
               <Instanced spots={BRICK_FALLBACK}>
                  <boxGeometry args={[SKYLINE_FOOTPRINT, BRICK_HEIGHT, SKYLINE_FOOTPRINT]} />
                  <meshStandardMaterial color="#9a3412" roughness={0.85} />
               </Instanced>
            }
         />
         {/* Hyper3D tower and block row behind the procedural skyline (z -55) */}
         <InstancedModel
            asset={ASSETS.cityTall}
            spots={TALL_SPOTS}
            fallback={
               <Instanced spots={TALL_FALLBACK}>
                  <boxGeometry args={[TALL_WIDTH, TALL_HEIGHT, TALL_WIDTH]} />
                  <meshStandardMaterial color="#94a3b8" roughness={0.85} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.cityBlock}
            spots={BLOCK_SPOTS}
            fallback={
               <Instanced spots={BLOCK_FALLBACK}>
                  <boxGeometry args={[BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_WIDTH]} />
                  <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.glass}
            spots={GLASS_SPOTS}
            fallback={
               <Instanced spots={GLASS_FALLBACK}>
                  <boxGeometry args={[SKYLINE_FOOTPRINT, GLASS_HEIGHT, SKYLINE_FOOTPRINT]} />
                  <meshStandardMaterial color="#7dd3fc" roughness={0.3} metalness={0.4} />
               </Instanced>
            }
         />

         {/* Surroundings outside play area: River, Quayside, Distant Skyline, Clouds */}
         <Decor reduced={reduced} />
      </group>
   );
}
