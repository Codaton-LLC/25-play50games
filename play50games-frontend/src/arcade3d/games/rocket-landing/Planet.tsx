"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, type Group, type Mesh } from "three";
import { useStageLighting } from "@/arcade3d/core/lighting";
import { ModelErrorBoundary, assetScale, useModel } from "@/arcade3d/core/assets";
import { PLANETS, WORLD, padX, type Run } from "./rules";
import { ASSETS, BEACON_LIGHTS, flattenLandingPadCone } from "./assets";
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

export default function Planet({ run }: { run: Run }) {
   const pad = useRef<Group>(null);
   const roof = useRef<Mesh>(null);
   const ground = useRef<Mesh>(null);

   const look = PLANET_LOOKS[run.planet] ?? PLANET_LOOKS[0];
   // Crossfade lighting preset, background and fog smoothly over 1 s on planet change
   useStageLighting(look.lighting, 1.0, look.skyBottom, look.fog);

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
         pad.current.scale.x = PLANETS[run.planet].width;
      }
      if (roof.current) {
         roof.current.visible = run.planet === 4;
      }
      if (data.planet === run.planet) return;
      data.planet = run.planet;
      const terrain = run.layouts[run.planet].terrain;
      buildTerrainMesh(terrain, run.planet, data.geometry);
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
               <mesh key={i} position={[b.x, b.y, b.z]}>
                  <cylinderGeometry args={[0.025, 0.03, 0.04, 8]} />
                  <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.8} />
               </mesh>
            ))}
         </group>

         {/* Sculpted cavern roof slab (Asteroid planet 4) matching exact collision AABB */}
         <mesh ref={roof} geometry={roofGeometry} visible={false} position={[0, 0, 0]} name="cavern-roof-hazard">
            <meshStandardMaterial vertexColors roughness={0.9} flatShading />
         </mesh>
      </group>
   );
}
