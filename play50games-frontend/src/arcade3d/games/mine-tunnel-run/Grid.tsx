"use client";

// The mine's cells: one instanced, bevelled cube mesh per terrain type (soft, packed, rock, ore, cracked,
// ghost, gas, rubble, bedrock), the back wall behind every open cell, and the water. Only the rows near
// the focus are drawn; the buffers are rebuilt when the grid changes (world.version) or the window moves.
// Ore veins glow (emissive map, a slow pulse); cracked rock shows its hot seams; ghost rock is see-through.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
   AdditiveBlending,
   Color,
   DoubleSide,
   InstancedMesh,
   Matrix4,
   MeshStandardMaterial,
   PlaneGeometry,
   ShaderMaterial,
   type Material,
} from "three";
import { useGameTime } from "../../core/gameTime";
import { T, type World } from "./rules";
import { CELL, VIEW_ROWS, cellX, cellY } from "./space";
import { lookFor } from "./look";
import { terrainTextures } from "./textures";

const KINDS = [T.SOFT, T.PACKED, T.ROCK, T.ORE, T.CRACKED, T.GHOST, T.GAS, T.RUBBLE, T.BEDROCK] as const;
type Kind = (typeof KINDS)[number];

const WATER_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
   vUv = uv;
   vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
   vWorld = wp.xyz;
   gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor;
varying vec3 vWorld;
varying vec2 vUv;
void main() {
   float wave = sin(vWorld.x * 3.0 + uTime * 2.0) * 0.5 + sin(vWorld.y * 4.0 - uTime * 1.6) * 0.5;
   float caustic = smoothstep(0.55, 1.0, sin(vWorld.x * 7.0 + uTime * 3.0) * sin(vWorld.y * 6.0 - uTime * 2.4));
   vec3 c = uColor * (0.75 + wave * 0.12) + vec3(0.6, 0.95, 1.0) * caustic * 0.35;
   gl_FragColor = vec4(c, 0.62);
}`;

export function Grid({ world, focusRow }: { world: World; focusRow: MutableRefObject<number> }) {
   const look = lookFor(world.level);
   const time = useGameTime();
   const tex = useMemo(() => terrainTextures(look, 11 + world.level * 7), [look, world.level]);
   const geometry = useMemo(() => new RoundedBoxGeometry(CELL * 0.995, CELL * 0.995, CELL, 1, 0.14), []);
   const backGeometry = useMemo(() => new PlaneGeometry(CELL, CELL), []);
   const materials = useMemo(() => {
      const m: Record<Kind, Material> = {
         [T.SOFT]: new MeshStandardMaterial({ map: tex.soft, roughness: 0.95 }),
         [T.PACKED]: new MeshStandardMaterial({ map: tex.packed, roughness: 0.92 }),
         [T.ROCK]: new MeshStandardMaterial({ map: tex.rock, roughness: 0.85 }),
         [T.ORE]: new MeshStandardMaterial({ map: tex.ore, roughness: 0.7, emissive: new Color(look.ore), emissiveMap: tex.oreGlow, emissiveIntensity: 1.6 }),
         [T.CRACKED]: new MeshStandardMaterial({ map: tex.cracked, roughness: 0.85, emissive: new Color("#ff6a1a"), emissiveMap: tex.crackedGlow, emissiveIntensity: 1.1 }),
         [T.GHOST]: new MeshStandardMaterial({ map: tex.ghost, roughness: 0.6, transparent: true, opacity: 0.72, emissive: new Color("#a855f7"), emissiveIntensity: 0.25 }),
         [T.GAS]: new MeshStandardMaterial({ map: tex.gas, roughness: 0.8, emissive: new Color("#84cc16"), emissiveIntensity: 0.35 }),
         [T.RUBBLE]: new MeshStandardMaterial({ map: tex.rubble, roughness: 1 }),
         [T.BEDROCK]: new MeshStandardMaterial({ map: tex.bedrock, roughness: 0.9 }),
      };
      return m;
   }, [tex, look]);
   const backMaterial = useMemo(() => new MeshStandardMaterial({ map: tex.back, roughness: 1, color: "#b8a596" }), [tex]);
   const water = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new Color(look.water) } },
            vertexShader: WATER_VERT,
            fragmentShader: WATER_FRAG,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
         }),
      [look]
   );
   const glow = useMemo(() => new MeshStandardMaterial({ color: "#000", emissive: new Color(look.ore), emissiveIntensity: 0.6, transparent: true, opacity: 0.0, blending: AdditiveBlending }), [look]);
   useEffect(
      () => () => {
         tex.dispose();
         geometry.dispose();
         backGeometry.dispose();
         Object.values(materials).forEach((m) => m.dispose());
         backMaterial.dispose();
         water.dispose();
         glow.dispose();
      },
      [tex, geometry, backGeometry, materials, backMaterial, water, glow]
   );
   const cap = world.w * (VIEW_ROWS * 2 + 3);
   const meshes = useRef<Partial<Record<Kind, InstancedMesh | null>>>({});
   const backMesh = useRef<InstancedMesh>(null);
   const waterMesh = useRef<InstancedMesh>(null);
   const state = useRef({ version: -1, r0: -1, r1: -1 });
   const m4 = useMemo(() => new Matrix4(), []);
   const tint = useMemo(() => new Color(), []);
   useFrame(() => {
      const f = Math.round(focusRow.current);
      const r0 = Math.max(0, f - VIEW_ROWS);
      const r1 = Math.min(world.h - 1, f + VIEW_ROWS);
      const ore = materials[T.ORE] as MeshStandardMaterial;
      ore.emissiveIntensity = 1.3 + Math.sin(time.now * 2.2) * 0.45;
      water.uniforms.uTime.value = time.now;
      const s = state.current;
      if (s.version === world.version && s.r0 === r0 && s.r1 === r1) return;
      s.version = world.version;
      s.r0 = r0;
      s.r1 = r1;
      const counts: Record<number, number> = {};
      for (const k of KINDS) counts[k] = 0;
      let backs = 0;
      let waters = 0;
      for (let r = r0; r <= r1; r++) {
         for (let c = 0; c < world.w; c++) {
            const t = world.tiles[r * world.w + c];
            const x = cellX(world.w, c);
            const y = cellY(r);
            if (t === T.EMPTY || t === T.WATER || t === T.BOULDER) {
               const bm = backMesh.current;
               if (bm && backs < cap) {
                  bm.setMatrixAt(backs, m4.makeTranslation(x, y, -CELL / 2 + 0.02));
                  const h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
                  tint.setScalar(0.82 + (h % 100) / 600);
                  bm.setColorAt(backs, tint);
                  backs++;
               }
               if (t === T.WATER && waterMesh.current && waters < cap) waterMesh.current.setMatrixAt(waters++, m4.makeTranslation(x, y, 0));
               continue;
            }
            const mesh = meshes.current[t as Kind];
            if (!mesh) continue;
            const n = counts[t];
            if (n >= cap) continue;
            mesh.setMatrixAt(n, m4.makeTranslation(x, y, 0));
            // a little per-cell variation so the wall never reads as a flat tile
            const h = ((c * 2654435761) ^ (r * 40503)) >>> 0;
            tint.setScalar(0.86 + (h % 1000) / 4200);
            mesh.setColorAt(n, tint);
            counts[t] = n + 1;
         }
      }
      for (const k of KINDS) {
         const mesh = meshes.current[k];
         if (!mesh) continue;
         mesh.count = counts[k];
         mesh.instanceMatrix.needsUpdate = true;
         if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      if (backMesh.current) {
         backMesh.current.count = backs;
         backMesh.current.instanceMatrix.needsUpdate = true;
         if (backMesh.current.instanceColor) backMesh.current.instanceColor.needsUpdate = true;
      }
      if (waterMesh.current) {
         waterMesh.current.count = waters;
         waterMesh.current.instanceMatrix.needsUpdate = true;
      }
   });
   return (
      <group>
         {KINDS.map((k) => (
            <instancedMesh
               key={k}
               ref={(m) => {
                  meshes.current[k] = m;
               }}
               args={[geometry, materials[k], cap]}
               frustumCulled={false}
               renderOrder={k === T.GHOST ? 2 : 0}
            />
         ))}
         <instancedMesh ref={backMesh} args={[backGeometry, backMaterial, cap]} frustumCulled={false} />
         <instancedMesh ref={waterMesh} args={[geometry, water, cap]} frustumCulled={false} renderOrder={3} />
      </group>
   );
}
