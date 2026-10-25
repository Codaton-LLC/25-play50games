"use client";

import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "./looks";
import { chunkAt, createRun, sampleTrack, type Run } from "./rules";

export interface TerrainMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

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

const X_MIN = -140;
const X_MAX = 140;
const Z_MIN = -240;
const Z_MAX = 80;
const STEP_X = 7;
const STEP_Z = 8;

export function buildTerrainData(run?: Run, targetMesh?: TerrainMesh): TerrainMesh {
   const r = run ?? createRun(0);
   const heightAt = createTerrainSampler(r);
   const pathSampler = createTrackPathSampler(r);

   const numX = Math.round((X_MAX - X_MIN) / STEP_X);
   const numZ = Math.round((Z_MAX - Z_MIN) / STEP_Z);
   const numTriangles = numX * numZ * 2;
   const numFloats = numTriangles * 9;

   const pos = targetMesh ? targetMesh.positions : new Float32Array(numFloats);
   const col = targetMesh ? targetMesh.colors : new Float32Array(numFloats);

   let pIdx = 0;
   let cIdx = 0;

   const colorAt = (x: number, z: number, y: number): [number, number, number] => {
      const { x: trackX, y: trackY } = pathSampler(z);
      const absDist = Math.abs(x - trackX);
      if (absDist <= 5.2) return TONES[1]; // soft snow under track
      const drop = (trackY - 0.35) - y;
      if (drop < 0.8) return TONES[1]; // soft snow
      if (drop < 2.0) return TONES[2]; // shaded snow
      return TONES[3]; // icy hollow
   };

   for (let z = Z_MIN; z < Z_MAX; z += STEP_Z) {
      for (let x = X_MIN; x < X_MAX; x += STEP_X) {
         const x2 = Math.min(X_MAX, x + STEP_X);
         const z2 = Math.min(Z_MAX, z + STEP_Z);

         const h00 = heightAt(x, z);
         const h10 = heightAt(x2, z);
         const h01 = heightAt(x, z2);
         const h11 = heightAt(x2, z2);

         // Triangle 1: (x, h00, z) -> (x, h01, z2) -> (x2, h10, z)
         pos[pIdx++] = x;   pos[pIdx++] = h00; pos[pIdx++] = z;
         pos[pIdx++] = x;   pos[pIdx++] = h01; pos[pIdx++] = z2;
         pos[pIdx++] = x2;  pos[pIdx++] = h10; pos[pIdx++] = z;

         const midX1 = (x + x + x2) / 3;
         const midZ1 = (z + z2 + z) / 3;
         const midY1 = (h00 + h01 + h10) / 3;
         const tone1 = colorAt(midX1, midZ1, midY1);
         for (let k = 0; k < 3; k++) {
            col[cIdx++] = tone1[0];
            col[cIdx++] = tone1[1];
            col[cIdx++] = tone1[2];
         }

         // Triangle 2: (x2, h10, z) -> (x, h01, z2) -> (x2, h11, z2)
         pos[pIdx++] = x2;  pos[pIdx++] = h10; pos[pIdx++] = z;
         pos[pIdx++] = x;   pos[pIdx++] = h01; pos[pIdx++] = z2;
         pos[pIdx++] = x2;  pos[pIdx++] = h11; pos[pIdx++] = z2;

         const midX2 = (x2 + x + x2) / 3;
         const midZ2 = (z + z2 + z2) / 3;
         const midY2 = (h10 + h01 + h11) / 3;
         const tone2 = colorAt(midX2, midZ2, midY2);
         for (let k = 0; k < 3; k++) {
            col[cIdx++] = tone2[0];
            col[cIdx++] = tone2[1];
            col[cIdx++] = tone2[2];
         }
      }
   }

   return {
      positions: pos,
      colors: col,
      triangles: numTriangles,
   };
}

export function coloredGeometry(data: TerrainMesh): BufferGeometry {
   const geom = new BufferGeometry();
   geom.setAttribute("position", new BufferAttribute(data.positions, 3));
   geom.setAttribute("color", new BufferAttribute(data.colors, 3));
   geom.computeVertexNormals();
   return geom;
}

export function Terrain({ run, reduced: _reduced }: { run?: Run; reduced: boolean }) {
   const meshData = useMemo(() => buildTerrainData(run), []);
   const terrainGeo = useMemo(() => coloredGeometry(meshData), [meshData]);
   const lastSRef = useRef(-999);

   useEffect(() => () => {
      terrainGeo.dispose();
   }, [terrainGeo]);

   useFrame(() => {
      if (!run) return;
      if (Math.abs(run.s - lastSRef.current) >= 0.4) {
         buildTerrainData(run, meshData);
         (terrainGeo.getAttribute("position") as BufferAttribute).needsUpdate = true;
         (terrainGeo.getAttribute("color") as BufferAttribute).needsUpdate = true;
         terrainGeo.computeVertexNormals();
         lastSRef.current = run.s;
      }
   });

   return (
      <group name="arctic-terrain">
         {/* Expansive rolling low-poly terrain with vertex-colored snow shading */}
         <mesh geometry={terrainGeo} name="rolling-snow-terrain">
            <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0.02} />
         </mesh>

         {/* Deep continuous backing ground plane ensuring no sky/void shows at any camera angle or ratio */}
         <mesh
            name="arctic-ground-base"
            rotation={[-Math.PI / 2 + Math.atan(0.06), 0, 0]}
            position={[0, -8.0, -60]}
         >
            <planeGeometry args={[600, 600]} />
            <meshStandardMaterial color={COLORS.fog} roughness={1.0} />
         </mesh>
      </group>
   );
}
