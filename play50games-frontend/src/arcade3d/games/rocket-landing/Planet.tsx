"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, type Group, type Mesh } from "three";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { ModelErrorBoundary, assetScale, useModel } from "@/arcade3d/core/assets";
import { TOWER, WORLD, padX, roofed, swings, windAt, worldOf, type Run } from "./rules";
import { ASSETS, BEACON_LIGHTS, BEACON_SIZE, beaconScaleX, flattenLandingPadCone } from "./assets";
import { COLORS, PLANET_LOOKS, buildCavernRoofGeometry, buildTerrainMesh } from "./looks";

function FallbackPad() {
   return (
      <group name="fallback-pad">
         {/* Base slab with chamfered look */}
         <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1, 0.4, 2]} />
            <meshStandardMaterial color={COLORS.padMetal} roughness={0.7} />
         </mesh>
         {/* Upper deck surface */}
         <mesh position={[0, 0.205, 0]}>
            <boxGeometry args={[0.94, 0.02, 1.84]} />
            <meshStandardMaterial color={COLORS.padDeck} roughness={0.6} />
         </mesh>
         {/* Glowing landing target rim */}
         <mesh position={[0, 0.215, 0]}>
            <boxGeometry args={[0.88, 0.01, 1.7]} />
            <meshStandardMaterial
               color={COLORS.padGlow}
               emissive={COLORS.padGlow}
               emissiveIntensity={0.8}
               depthWrite={false}
            />
         </mesh>
         {/* Front edge stripe */}
         <mesh position={[0, 0.03, 1.025]}>
            <boxGeometry args={[0.86, 0.075, 0.03]} />
            <meshBasicMaterial color={COLORS.padStripe} />
         </mesh>
      </group>
   );
}

function LandingPadModel() {
   const { scene } = useModel(ASSETS.landingPad);
   const prepared = useMemo(() => {
      if (!scene) return null;
      const clone = scene.clone(true);
      clone.traverse((obj) => {
         const mesh = obj as Mesh;
         if (mesh.isMesh && mesh.geometry) {
            mesh.geometry = mesh.geometry.clone();
            flattenLandingPadCone(mesh.geometry, mesh.position.y);
            mesh.geometry.computeVertexNormals();
         }
      });
      return clone;
   }, [scene]);

   if (!prepared) return <FallbackPad />;
   return (
      <primitive
         object={prepared}
         scale={assetScale(ASSETS.landingPad)}
         position-y={ASSETS.landingPad.yOffset ?? 0}
      />
   );
}

/** The planet's lighting preset, background and fog, crossfaded over 1 s on a planet change (Scene,
 *  inside GameShell: Planet itself stays renderable on its own for beacons.test.ts). */
export function PlanetLighting({ run }: { run: Run }) {
   const look = PLANET_LOOKS[worldOf(run).look] ?? PLANET_LOOKS[0];
   useStageLighting(look.lighting, 1.0, look.skyBottom, look.fog);
   return null;
}

export default function Planet({ run }: { run: Run }) {
   const pad = useRef<Group>(null);
   const roof = useRef<Mesh>(null);
   const beacons = useRef<(Mesh | null)[]>([]);
   const ground = useRef<Mesh>(null);
   const towers = useRef<(Group | null)[]>([]);
   const rail = useRef<Group>(null);
   const sock = useRef<Group>(null);
   const sockCone = useRef<Group>(null);
   const look = PLANET_LOOKS[worldOf(run).look] ?? PLANET_LOOKS[0];


   const [data] = useState(() => ({
      geometry: new BufferGeometry(),
      planet: -1,
   }));

   useEffect(() => () => data.geometry.dispose(), [data]);

   const roofGeometry = useMemo(() => buildCavernRoofGeometry(), []);
   useEffect(() => () => roofGeometry.dispose(), [roofGeometry]);

   useFrame(() => {
      if (pad.current) {
         pad.current.position.x = padX(
            run.layouts[run.planet],
            run.planet,
            run.attemptTime,
            run.level?.padAmplitude
         );
         pad.current.scale.x = worldOf(run).width;
         // the rim beacons cancel the pad's width stretch (beacons.test.ts)
         for (const b of beacons.current) if (b) b.scale.x = beaconScaleX(worldOf(run).width);
      }
      const layout = run.layouts[run.planet], world = worldOf(run);
      if (roof.current) {
         roof.current.visible = roofed(layout, run.planet);
      }
      // the rock towers beside the pad (rules.ts TOWER, the same boxes the rocket hits)
      for (let i = 0; i < towers.current.length; i++) {
         const t = towers.current[i], x = layout.towers?.[i];
         if (!t) continue;
         t.visible = x !== undefined;
         if (x !== undefined) t.position.x = x;
      }
      // a rail pad's track: the whole span the pad slides along
      if (rail.current) {
         rail.current.visible = swings(layout, run.planet);
         rail.current.scale.x = 2 * (run.level?.padAmplitude ?? 2) + world.width;
      }
      // the windsock beside a windy pad: points downwind, fills out with the gust
      if (sock.current) {
         const wind = windAt(run), gusty = world.wind > 0;
         sock.current.visible = gusty;
         if (gusty) {
            sock.current.position.x = layout.pad + world.width / 2 + 0.9;
            const k = Math.min(1, Math.abs(wind) / 0.55);
            if (sockCone.current) {
               sockCone.current.rotation.y = wind >= 0 ? 0 : Math.PI;
               sockCone.current.rotation.z = -(1 - k) * 1.2;
               sockCone.current.scale.set(0.5 + 0.5 * k, 1, 1);
            }
         }
      }
      if (data.planet === run.planet) return;
      data.planet = run.planet;
      const terrain = run.layouts[run.planet].terrain;
      buildTerrainMesh(terrain, worldOf(run).look, data.geometry);
   });

   return (
      <group name="rocket-planet-stage">
         {/* Wide seamless terrain covering the entire view at all screen sizes */}
         <mesh ref={ground} geometry={data.geometry} frustumCulled={false} name="planet-terrain">
            <meshStandardMaterial vertexColors roughness={1} flatShading />
         </mesh>

         {/* Landing pad with Hyper3D GLB model + glowing beacon zone + point light */}
         <group ref={pad} position={[0, WORLD.padY - WORLD.padThickness / 2, 0]} name="landing-pad-group">
            <ModelErrorBoundary fallback={<FallbackPad />}>
               <LandingPadModel />
            </ModelErrorBoundary>
            {/* Glowing target zone on pad surface */}
            <mesh position={[0, 0.205, 0]} name="pad-glow-zone">
               <boxGeometry args={[0.92, 0.015, 1.76]} />
               <meshStandardMaterial
                  color={COLORS.padGlow}
                  emissive={COLORS.padGlow}
                  emissiveIntensity={0.8}
                  depthWrite={false}
               />
            </mesh>
            {/* Pad landing illumination */}
            <pointLight position={[0, 0.45, 0]} color={COLORS.padBeacon} intensity={1.5} distance={7} />
            {BEACON_LIGHTS.map((b, i) => (
               <mesh key={i} ref={(m) => { beacons.current[i] = m; }} position={[b.x, b.y, b.z]} scale-x={beaconScaleX(worldOf(run).width)}>
                  <cylinderGeometry args={[BEACON_SIZE.top, BEACON_SIZE.bottom, BEACON_SIZE.height, 12]} />
                  <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.8} />
               </mesh>
            ))}
         </group>

         {/* Rock towers (World.towers): bevelled stacked columns over the collision boxes */}
         {[0, 1].map((i) => (
            <group key={i} ref={(g) => { towers.current[i] = g; }} visible={false} name={`rock-tower-${i}`}>
               <mesh position={[0, (TOWER.top - 2) / 2 - 0.1, 0]}>
                  <cylinderGeometry args={[TOWER.half * 0.92, TOWER.half * 1.12, TOWER.top + 2 - 0.2, 6]} />
                  <meshStandardMaterial color={look.rockColor} roughness={1} flatShading />
               </mesh>
               {[1.2, 3.1].map((y) => (
                  <mesh key={y} position={[0, y, 0]}>
                     <cylinderGeometry args={[TOWER.half * 1.06, TOWER.half * 1.06, 0.18, 6]} />
                     <meshStandardMaterial color={look.rockAltColor} roughness={1} flatShading />
                  </mesh>
               ))}
               <mesh position={[0, TOWER.top - 0.05, 0]}>
                  <cylinderGeometry args={[TOWER.half * 0.55, TOWER.half * 0.92, 0.3, 6]} />
                  <meshStandardMaterial color={look.rockAltColor} roughness={1} flatShading />
               </mesh>
               <mesh position={[0, TOWER.top + 0.12, 0]}>
                  <sphereGeometry args={[0.09, 8, 6]} />
                  <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={1.2} />
               </mesh>
            </group>
         ))}

         {/* A rail pad's track: a slotted beam under the pad's full slide, with end stops */}
         <group ref={rail} visible={false} position={[0, WORLD.padY - WORLD.padThickness - 0.12, -0.2]} name="pad-rail">
            <mesh>
               <boxGeometry args={[1, 0.14, 0.5]} />
               <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.075, 0.26]}>
               <boxGeometry args={[1, 0.03, 0.03]} />
               <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.6} />
            </mesh>
            {[-0.5, 0.5].map((x) => (
               <mesh key={x} position={[x, -0.6, 0]}>
                  <boxGeometry args={[0.02, 1.3, 0.4]} />
                  <meshStandardMaterial color="#334155" roughness={0.6} />
               </mesh>
            ))}
         </group>

         {/* Windsock on windy landings: pole behind the pad edge, sock points downwind */}
         <group ref={sock} visible={false} position={[0, 0, -1.3]} name="windsock">
            <mesh position={[0, 1.6, 0]}>
               <cylinderGeometry args={[0.05, 0.07, 3.2, 8]} />
               <meshStandardMaterial color="#e2e8f0" metalness={0.4} roughness={0.5} />
            </mesh>
            <group ref={sockCone} position={[0, 3.1, 0]}>
               <mesh position={[0.55, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[0.2, 1.1, 12, 1, true]} />
                  <meshStandardMaterial color="#f97316" side={2} roughness={0.7} />
               </mesh>
               <mesh position={[0.2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <cylinderGeometry args={[0.165, 0.18, 0.16, 12, 1, true]} />
                  <meshStandardMaterial color="#f8fafc" side={2} roughness={0.7} />
               </mesh>
            </group>
         </group>

         {/* Sculpted cavern roof slab (Asteroid planet 4) matching exact collision AABB */}
         <mesh ref={roof} geometry={roofGeometry} visible={false} position={[0, 0, 0]} name="cavern-roof-hazard">
            <meshStandardMaterial vertexColors roughness={0.9} flatShading />
         </mesh>
      </group>
   );
}
