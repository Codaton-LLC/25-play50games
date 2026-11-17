"use client";

// The per-level set pieces: code-built, bevelled, cosmetic only (never in rules, never solids).
// Each level's pieces come from its look (looks.ts lookOf): tunnel arches for the shark tunnel,
// a kelp garden for the tropical tank, a sunken ruin for the giant aquarium, rim lamps and
// bioluminescent stalks for the deep sea exhibit. Everything stands outside the play area or
// against the back glass, so nothing comes between the camera and the diver.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry, type Group,
} from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced } from "@/arcade3d/core/render";
import { GLASS_H, HALL, archStations, glowSpots, kelpSpots, lampSpots, wreckAnchor, type LevelLook } from "./looks";
import { tankHalf, type Run } from "./rules";

const STONE = "#a8a29e";
const STONE_DARK = "#78716c";

/** Every set piece of the level's look, in one mount. */
export function SetPieces({ run, look }: { run: Run; look: LevelLook }) {
   return (
      <>
         {look.arches > 0 && <TunnelArches run={run} count={look.arches} />}
         {look.kelpCount > 0 && <KelpGarden run={run} count={look.kelpCount} />}
         {look.wreck && <SunkenRuin run={run} />}
         {look.lamps > 0 && <RimLamps run={run} count={look.lamps} />}
         {look.glowCount > 0 && <GlowStalks run={run} count={look.glowCount} />}
      </>
   );
}

/**
 * The shark tunnel: dark metal arches span the tank on the side plinths, each carrying a thin
 * emissive strip, so the tank reads as a tunnel the shark patrols. The crown sits above the
 * 3.2 m glass; the legs land outside the glass on the plinths.
 */
function TunnelArches({ run, count }: { run: Run; count: number }) {
   const stations = useMemo(() => archStations(run.level).slice(0, count), [run, count]);
   const { hx } = tankHalf(run.level);
   const radius = hx + HALL.plinthW / 2;
   const crown = GLASS_H + 0.35;
   const flat = crown / radius;
   const rib = useMemo(() => new TorusGeometry(radius, 0.13, 8, 40, Math.PI), []);
   const strip = useMemo(() => new TorusGeometry(radius, 0.045, 6, 40, Math.PI), []);
   const ribMat = useMemo(() => new MeshStandardMaterial({ color: "#1f3a44", roughness: 0.55, metalness: 0.35 }), []);
   const stripMat = useMemo(() => new MeshStandardMaterial({ color: "#2dd4bf", emissive: "#2dd4bf", emissiveIntensity: 1.6, roughness: 0.4 }), []);
   useEffect(() => () => { rib.dispose(); strip.dispose(); ribMat.dispose(); stripMat.dispose(); }, [rib, strip, ribMat, stripMat]);
   return (
      <>
         {stations.map((z, i) => (
            <group key={i} position={[0, 0.12, z]} scale={[1, flat, 1]}>
               <mesh geometry={rib} material={ribMat} />
               <mesh geometry={strip} material={stripMat} scale={[0.995, 1.02, 1.02]} />
            </group>
         ))}
      </>
   );
}

/** One swaying kelp strand: two tapering segments, bent and drifting with the water. */
function KelpStrand({ x, z, height, phase }: { x: number; z: number; height: number; phase: number }) {
   const g = useRef<Group>(null);
   const time = useGameTime();
   const stuff = useMemo(() => ({
      low: new CylinderGeometry(0.045, 0.07, height * 0.55, 6),
      top: new CylinderGeometry(0.02, 0.045, height * 0.5, 6),
      leaf: new MeshStandardMaterial({ color: "#3f6212", roughness: 0.7 }),
      tip: new MeshStandardMaterial({ color: "#65a30d", roughness: 0.65 }),
   }), [height]);
   useEffect(() => () => {
      stuff.low.dispose(); stuff.top.dispose(); stuff.leaf.dispose(); stuff.tip.dispose();
   }, [stuff]);
   useFrame(() => {
      const gr = g.current;
      if (!gr) return;
      gr.rotation.z = Math.sin(time.now * 0.7 + phase) * 0.1;
      gr.rotation.x = Math.cos(time.now * 0.55 + phase * 1.7) * 0.06;
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={g} position={[x, 0, z]}>
         <mesh geometry={stuff.low} material={stuff.leaf} position={[0.04, height * 0.27, 0]} rotation={[0, 0, -0.08]} />
         <mesh geometry={stuff.top} material={stuff.tip} position={[0.1, height * 0.72, 0]} rotation={[0, 0, -0.14]} />
      </group>
   );
}

/** The tropical garden: kelp strands along the back glass, each swaying on its own phase. */
function KelpGarden({ run, count }: { run: Run; count: number }) {
   const spots = useMemo(() => kelpSpots(run, count), [run, count]);
   return (
      <>
         {spots.map((s, i) => (
            <KelpStrand key={i} x={s.x} z={s.z} height={s.scale ?? 1.4} phase={i * 1.7} />
         ))}
      </>
   );
}

/** The giant aquarium's sunken ruin: a tilted column, a stump, a hull rib and a slab, back-left. */
function SunkenRuin({ run }: { run: Run }) {
   const anchor = useMemo(() => wreckAnchor(run), [run]);
   const stuff = useMemo(() => ({
      column: new CylinderGeometry(0.26, 0.3, 2.2, 10),
      stump: new CylinderGeometry(0.3, 0.34, 0.9, 10),
      rib: new TorusGeometry(1.15, 0.11, 8, 24, Math.PI),
      slab: new BoxGeometry(1.7, 0.22, 0.9),
      stone: new MeshStandardMaterial({ color: STONE, roughness: 0.85 }),
      dark: new MeshStandardMaterial({ color: STONE_DARK, roughness: 0.9 }),
   }), []);
   useEffect(() => () => {
      for (const g of [stuff.column, stuff.stump, stuff.rib, stuff.slab]) g.dispose();
      stuff.stone.dispose(); stuff.dark.dispose();
   }, [stuff]);
   return (
      <group position={[anchor.x, 0, anchor.z]} rotation-y={anchor.rotY}>
         <mesh geometry={stuff.column} material={stuff.stone} position={[-0.5, 0.85, -0.2]} rotation={[0.12, 0, 0.55]} />
         <mesh geometry={stuff.stump} material={stuff.dark} position={[0.55, 0.45, 0.15]} rotation={[0, 0, 0.08]} />
         <mesh geometry={stuff.rib} material={stuff.dark} position={[1.5, 0.05, -0.25]} rotation={[0, Math.PI / 2, 0]} />
         <mesh geometry={stuff.slab} material={stuff.stone} position={[0.2, 0.12, 0.55]} rotation={[0, 0.4, 0.1]} />
      </group>
   );
}

/** The deep sea exhibit's rim lamps: poles and warm lamp heads on the back plinth, outside the glass. */
function RimLamps({ run, count }: { run: Run; count: number }) {
   const spots = useMemo(() => lampSpots(run.level, count), [run, count]);
   const pole = useMemo(() => new CylinderGeometry(0.06, 0.08, 1, 8), []);
   const head = useMemo(() => new SphereGeometry(0.17, 10, 8), []);
   const poleMat = useMemo(() => new MeshStandardMaterial({ color: "#1e293b", roughness: 0.5, metalness: 0.4 }), []);
   const headMat = useMemo(() => new MeshStandardMaterial({ color: "#fde68a", emissive: "#fbbf24", emissiveIntensity: 2.2, roughness: 0.4 }), []);
   useEffect(() => () => { pole.dispose(); head.dispose(); poleMat.dispose(); headMat.dispose(); }, [pole, head, poleMat, headMat]);
   const heads = spots.map((s) => ({ ...s, y: 2.15 }));
   const poles = spots.map((s) => ({ ...s, y: 1.1, sy: 2.2 }));
   return (
      <>
         <Instanced spots={poles} name="rim-lamp-poles">
            <primitive object={pole} attach="geometry" />
            <primitive object={poleMat} attach="material" />
         </Instanced>
         <Instanced spots={heads} name="rim-lamp-heads">
            <primitive object={head} attach="geometry" />
            <primitive object={headMat} attach="material" />
         </Instanced>
         <pointLight position={[0, GLASS_H + 0.4, -run.hz * 0.4]} intensity={7} distance={Math.max(run.hx, run.hz) * 2.2} decay={1.7} color="#67e8f9" />
      </>
   );
}

/** The deep sea exhibit's bioluminescent stalks: thin stems with glowing cyan / violet heads. */
function GlowStalks({ run, count }: { run: Run; count: number }) {
   const spots = useMemo(() => glowSpots(run, count), [run, count]);
   const cyan = useMemo(() => spots.filter((_, i) => i % 2 === 0), [spots]);
   const violet = useMemo(() => spots.filter((_, i) => i % 2 === 1), [spots]);
   const stem = useMemo(() => new CylinderGeometry(0.02, 0.035, 1, 6), []);
   const bulb = useMemo(() => new SphereGeometry(0.09, 8, 6), []);
   const stemMat = useMemo(() => new MeshStandardMaterial({ color: "#0f172a", roughness: 0.8 }), []);
   const cyanMat = useMemo(() => new MeshStandardMaterial({ color: "#22d3ee", emissive: "#22d3ee", emissiveIntensity: 2.4, roughness: 0.4 }), []);
   const violetMat = useMemo(() => new MeshStandardMaterial({ color: "#a78bfa", emissive: "#a78bfa", emissiveIntensity: 2.4, roughness: 0.4 }), []);
   useEffect(() => () => {
      stem.dispose(); bulb.dispose(); stemMat.dispose(); cyanMat.dispose(); violetMat.dispose();
   }, [stem, bulb, stemMat, cyanMat, violetMat]);
   const stems = (list: typeof spots) => list.map((s) => {
      const h = s.scale ?? 1;
      return { x: s.x, y: h / 2, z: s.z, rotY: s.rotY ?? 0, sx: 1, sy: h, sz: 1 };
   });
   const heads = (list: typeof spots) => list.map((s) => {
      const h = s.scale ?? 1;
      return { x: s.x, y: h, z: s.z, rotY: s.rotY ?? 0, scale: 1 };
   });
   return (
      <>
         <Instanced spots={stems(cyan)} name="glow-stalks-cyan">
            <primitive object={stem} attach="geometry" />
            <primitive object={stemMat} attach="material" />
         </Instanced>
         <Instanced spots={heads(cyan)} name="glow-heads-cyan">
            <primitive object={bulb} attach="geometry" />
            <primitive object={cyanMat} attach="material" />
         </Instanced>
         <Instanced spots={stems(violet)} name="glow-stalks-violet">
            <primitive object={stem} attach="geometry" />
            <primitive object={stemMat} attach="material" />
         </Instanced>
         <Instanced spots={heads(violet)} name="glow-heads-violet">
            <primitive object={bulb} attach="geometry" />
            <primitive object={violetMat} attach="material" />
         </Instanced>
      </>
   );
}
