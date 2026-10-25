"use client";

import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, type Group } from "three";
import { useFrame } from "@react-three/fiber";
import { createStripScratch, createTrackFrame, fillStrip, stripFloats, trackFrame } from "./ground";
import { COLORS } from "./looks";
import { chunkAt, createRun, sampleTrack, type Run } from "./rules";

interface Vec3Point {
   x: number;
   y: number;
   z: number;
}

function hexToRgb(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const TONES = [
   hexToRgb(COLORS.snowSun),
   hexToRgb(COLORS.terrainSnow),
   hexToRgb(COLORS.terrainShade),
   hexToRgb(COLORS.terrainIce),
];

// The view-space helpers below (sampleWorldAt, createTrackPathSampler, createTerrainSampler) describe
// the ground surface around the penguin for the decor tests. The drawn ground is ground.ts
// fillStrip: the same surface, built once per chunk in track world coordinates.

/**
 * Samples the world position of track at distance s and lateral offset d.
 * Uses its own point objects without mutating run.scratch.
 */
export function sampleWorldAt(r: Run, s: number, d: number, out: Vec3Point): Vec3Point {
   const c = chunkAt(r, s);
   const here = chunkAt(r, r.s);
   const pHere = { x: 0, y: 0, z: 0 };
   const tHere = { x: 0, y: 0, z: 0 };
   const pTarget = { x: 0, y: 0, z: 0 };
   const tTarget = { x: 0, y: 0, z: 0 };

   sampleTrack(here, r.s - here.index * 60, 0, pHere, tHere, r.branch);
   sampleTrack(c, s - c.index * 60, d, pTarget, tTarget, d > 0 ? 1 : -1);

   const dx = pTarget.x - pHere.x;
   const dz = pTarget.z - pHere.z;
   const yaw = Math.atan2(tHere.x, tHere.z);
   const cos = Math.cos(yaw);
   const sin = Math.sin(yaw);

   out.x = cos * dx - sin * dz;
   out.y = pTarget.y - pHere.y;
   out.z = -(sin * dx + cos * dz);
   return out;
}

interface PathSample {
   s: number;
   x: number;
   y: number;
   z: number;
}

/**
 * Samples the generated track path for a run across its active chunks.
 * Returns a function that maps any world z to the track's centre line x(z) and height y(z).
 */
export function createTrackPathSampler(run: Run): (z: number) => { x: number; y: number } {
   const samples: PathSample[] = [];
   const sMin = run.chunks[0].index * 60;
   const sMax = (run.chunks[2].index + 1) * 60;
   const pt: Vec3Point = { x: 0, y: 0, z: 0 };

   for (let s = sMin; s <= sMax; s += 0.8) {
      sampleWorldAt(run, s, 0, pt);
      samples.push({ s, x: pt.x, y: pt.y, z: pt.z });
   }

   return (z: number): { x: number; y: number } => {
      const len = samples.length;
      if (len === 0) return { x: 0, y: 0 };
      if (len === 1) return { x: samples[0].x, y: samples[0].y };

      // Extrapolate behind player (z > samples[0].z)
      if (z >= samples[0].z) {
         const dz = samples[0].z - samples[1].z;
         const t = dz !== 0 ? (z - samples[0].z) / dz : 0;
         return {
            x: samples[0].x + t * (samples[0].x - samples[1].x),
            y: samples[0].y + t * (samples[0].y - samples[1].y),
         };
      }

      // Extrapolate down-track ahead (z < samples[len - 1].z)
      if (z <= samples[len - 1].z) {
         const last = len - 1;
         const dz = samples[last - 1].z - samples[last].z;
         const t = dz !== 0 ? (samples[last].z - z) / dz : 0;
         return {
            x: samples[last].x + t * (samples[last].x - samples[last - 1].x),
            y: samples[last].y + t * (samples[last].y - samples[last - 1].y),
         };
      }

      // Binary search for the segment containing z (samples.z is strictly descending)
      let lo = 0;
      let hi = len - 2;
      while (lo < hi) {
         const mid = (lo + hi) >> 1;
         if (samples[mid + 1].z <= z) {
            hi = mid;
         } else {
            lo = mid + 1;
         }
      }

      const dz = samples[lo + 1].z - samples[lo].z;
      const t = dz !== 0 ? (z - samples[lo].z) / dz : 0;
      return {
         x: samples[lo].x + t * (samples[lo + 1].x - samples[lo].x),
         y: samples[lo].y + t * (samples[lo + 1].y - samples[lo].y),
      };
   };
}

/**
 * Creates a terrain height query function for a run.
 * Follows the generated track path (x(z), y(z)):
 * - Inside the slope corridor (|x - x(z)| <= 5.2): sits flat at track height - 0.35 m
 * - Outside the slope corridor: slopes away downward, never rising above the track corridor
 */
export function createTerrainSampler(run?: Run): (x: number, z: number) => number {
   const r = run ?? createRun(0);
   const pathSampler = createTrackPathSampler(r);
   const corridor = 5.2;

   return (x: number, z: number): number => {
      const { x: trackX, y: trackY } = pathSampler(z);
      const absDist = Math.abs(x - trackX);
      const base = trackY - 0.35;

      if (absDist <= corridor) {
         return base;
      }

      const dist = absDist - corridor;
      const drop = dist * 0.05;
      const roll = Math.sin(x * 0.08) * Math.cos(z * 0.06) * 0.15;
      return base - drop + Math.min(0, roll);
   };
}

/** Height of the backing plane in the view (the penguin's track point is y 0). */
export const BASE_PLANE_Y = -40;

/** One chunk strip: fixed buffers, refilled in place only when its chunk is generated. */
function stripGeometry(): BufferGeometry {
   const g = new BufferGeometry();
   const floats = stripFloats();
   g.setAttribute("position", new BufferAttribute(new Float32Array(floats), 3));
   g.setAttribute("color", new BufferAttribute(new Float32Array(floats), 3));
   // flatShading derives face normals in the shader; one fixed up normal keeps the attribute set complete
   const normal = new Float32Array(floats);
   for (let i = 1; i < floats; i += 3) normal[i] = 1;
   g.setAttribute("normal", new BufferAttribute(normal, 3));
   return g;
}

/**
 * The snow field: three chunk strips in track world coordinates under the same transform as the
 * track (ground.ts trackFrame), so it scrolls with the track. A strip is rebuilt only when the run
 * generates a new chunk (every 60 m); a frame only moves one group. No allocation per frame.
 */
export function Terrain({ run, reduced: _reduced }: { run: Run; reduced: boolean }) {
   const root = useRef<Group>(null);
   const state = useMemo(() => {
      const scratch = createStripScratch();
      const geometries = [stripGeometry(), stripGeometry(), stripGeometry()];
      const indices = [-1, -1, -1];
      const frame = createTrackFrame();
      const fill = () => {
         for (let i = 0; i < 3; i++) {
            const chunk = run.chunks[i];
            if (indices[i] === chunk.index) continue;
            const g = geometries[i];
            const pos = g.getAttribute("position") as BufferAttribute;
            const col = g.getAttribute("color") as BufferAttribute;
            fillStrip(chunk, pos.array as Float32Array, col.array as Float32Array, TONES, scratch);
            pos.needsUpdate = true;
            col.needsUpdate = true;
            g.computeBoundingSphere();
            indices[i] = chunk.index;
         }
      };
      fill();
      return { scratch, geometries, frame, fill, p: { x: 0, y: 0, z: 0 }, t: { x: 0, y: 0, z: 0 } };
   }, [run]);

   useEffect(() => () => {
      for (const g of state.geometries) g.dispose();
   }, [state]);

   useFrame(() => {
      state.fill();
      const f = trackFrame(run, state.frame, state.p, state.t);
      const g = root.current;
      if (!g) return;
      g.rotation.y = f.yaw;
      g.position.set(-f.cos * f.x + f.sin * f.z, -f.y, f.sin * f.x + f.cos * f.z);
   });

   return (
      <group name="arctic-terrain">
         <group ref={root} name="snow-strips">
            {state.geometries.map((geometry, i) => (
               <mesh key={i} geometry={geometry} frustumCulled={false} name="rolling-snow-terrain">
                  <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0.02} />
               </mesh>
            ))}
         </group>

         {/*
            Backing plane, a safety net only (the strips reach ±160 m, past the fog): flat and 40 m down,
            under every strip in view, unlit in the fog colour, so it never cuts through the snow. The
            tilted plane it replaces rose 0.06 m per metre ahead while the glacier falls, poked out of
            the far snow and drew a grey line on the horizon.
         */}
         <mesh name="arctic-ground-base" rotation={[-Math.PI / 2, 0, 0]} position={[0, BASE_PLANE_Y, -60]}>
            <planeGeometry args={[1200, 1200]} />
            <meshBasicMaterial color={COLORS.fog} />
         </mesh>
      </group>
   );
}
