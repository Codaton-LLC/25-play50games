"use client";

// A stylised water surface: a flat plane whose vertices ride three sine waves in the vertex shader,
// shaded deep-to-shallow by the view angle (fresnel-ish) with foam on the crests and an optional
// foam band along its edges (a shoreline). One draw call; fog works. Waves follow the quality tier
// (useQuality().water: "full", "reduced" = fewer vertices and 60 % of the height, "flat" = one quad,
// no waves). Moves with the run's pause-safe clock: render it inside the Scene.
//
//    <Water size={[60, 60]} position={[0, -0.2, 0]} color="#0e7490" amplitude={0.2} />
//
// The waves are visual only: game rules keep their own flat water height.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial, UniformsLib, UniformsUtils } from "three";
import { useGameTime } from "../gameTime";
import { FRAME_PRIORITY } from "../frameLoop";
import { useQuality, type WaterQuality } from "../quality";

export interface WaterProps {
   /** width (x) and depth (z), m; default [40, 40] */
   size?: readonly [number, number];
   position?: readonly [number, number, number];
   /** shallow / facing colour */
   color?: string;
   /** colour at grazing angles and in the troughs */
   deep?: string;
   foam?: string;
   /** wave height (m) at "full" quality; default 0.18 */
   amplitude?: number;
   /** main wavelength (m); default 6 */
   wavelength?: number;
   /** wave speed factor; default 1 */
   speed?: number;
   /** foam band along the edges, as a fraction of the shorter side (0 = none); default 0 */
   foamEdge?: number;
   /** 0..1, default 0.92 */
   opacity?: number;
}

/** Grid segments per side and wave height for a quality tier. Pure. */
export function waterDetail(quality: WaterQuality, amplitude: number, size: readonly [number, number]): { segments: [number, number]; amplitude: number } {
   if (quality === "flat") return { segments: [1, 1], amplitude: 0 };
   // about one vertex per 0.6 m ("full") or 1.2 m ("reduced"), at most 96 per side
   const step = quality === "full" ? 0.6 : 1.2;
   const seg = (len: number) => Math.max(4, Math.min(96, Math.round(len / step)));
   return { segments: [seg(size[0]), seg(size[1])], amplitude: quality === "full" ? amplitude : amplitude * 0.6 };
}

const VERTEX = /* glsl */ `
#include <fog_pars_vertex>
uniform float uTime;
uniform float uAmp;
uniform float uK;
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vCrest;
varying vec2 vUv;

// three waves along fixed directions, wavenumbers k, 1.7k, 2.9k (heights 1, 0.45, 0.2)
float wave(vec2 p, vec2 dir, float k, float w, float a, out vec2 grad) {
   float phase = dot(dir, p) * k + uTime * w;
   grad = dir * (a * k * cos(phase));
   return a * sin(phase);
}

void main() {
   vUv = uv;
   vec3 p = position; // the plane lies in local x/y, local z is up (the mesh is turned -90° about x)
   vec2 g1; vec2 g2; vec2 g3;
   float k = uK;
   float h = wave(p.xy, normalize(vec2(1.0, 0.35)), k, 1.1, uAmp, g1)
      + wave(p.xy, normalize(vec2(-0.6, 1.0)), k * 1.7, 1.7, uAmp * 0.45, g2)
      + wave(p.xy, normalize(vec2(0.2, -1.0)), k * 2.9, 2.6, uAmp * 0.2, g3);
   vec2 grad = g1 + g2 + g3;
   p.z += h;
   vCrest = uAmp > 0.0 ? h / (uAmp * 1.65) : 0.0;
   vec3 n = normalize(vec3(-grad.x, -grad.y, 1.0));
   vNormalV = normalize(normalMatrix * n);
   vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
   vViewV = -mvPosition.xyz;
   gl_Position = projectionMatrix * mvPosition;
   #include <fog_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uOpacity;
uniform float uEdge;
uniform vec2 uAspect;
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vCrest;
varying vec2 vUv;

void main() {
   vec3 n = normalize(vNormalV);
   vec3 v = normalize(vViewV);
   float facing = clamp(dot(n, v), 0.0, 1.0);
   float fresnel = pow(1.0 - facing, 3.0);
   vec3 col = mix(uColor, uDeep, clamp(fresnel * 0.85 + (0.5 - 0.5 * vCrest) * 0.25, 0.0, 1.0));
   // a soft sky glint at grazing angles
   col += vec3(0.18, 0.22, 0.26) * fresnel;
   float foam = smoothstep(0.55, 0.95, vCrest);
   if (uEdge > 0.0) {
      vec2 d = min(vUv, 1.0 - vUv) * uAspect;
      float edge = 1.0 - smoothstep(0.0, uEdge, min(d.x, d.y));
      foam = max(foam, edge);
   }
   col = mix(col, uFoam, foam * 0.85);
   gl_FragColor = vec4(col, mix(uOpacity, 1.0, foam));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #include <fog_fragment>
}
`;

const DEFAULT_SIZE = [40, 40] as const;
const ORIGIN = [0, 0, 0] as const;

export function Water({
   size = DEFAULT_SIZE,
   position = ORIGIN,
   color = "#0e7490",
   deep = "#083344",
   foam = "#e0f2fe",
   amplitude = 0.18,
   wavelength = 6,
   speed = 1,
   foamEdge = 0,
   opacity = 0.92,
}: WaterProps) {
   const time = useGameTime();
   const quality = useQuality();
   const [sx, sz] = size;
   const detail = waterDetail(quality.water, amplitude, [sx, sz]);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: UniformsUtils.merge([
               UniformsLib.fog,
               {
                  uTime: { value: 0 },
                  uAmp: { value: 0 },
                  uK: { value: 1 },
                  uColor: { value: new Color() },
                  uDeep: { value: new Color() },
                  uFoam: { value: new Color() },
                  uOpacity: { value: 1 },
                  uEdge: { value: 0 },
                  uAspect: { value: [1, 1] },
               },
            ]),
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            transparent: true,
            depthWrite: false,
            fog: true,
         }),
      []
   );
   useEffect(() => {
      const u = material.uniforms;
      (u.uColor.value as Color).set(color);
      (u.uDeep.value as Color).set(deep);
      (u.uFoam.value as Color).set(foam);
      u.uAmp.value = detail.amplitude;
      u.uK.value = (2 * Math.PI) / Math.max(0.5, wavelength);
      u.uOpacity.value = opacity;
      const short = Math.min(sx, sz);
      u.uEdge.value = foamEdge > 0 ? foamEdge * short : 0;
      // uv distances in metres: (u * width, v * depth)
      u.uAspect.value = [sx, sz];
   }, [material, color, deep, foam, detail.amplitude, wavelength, opacity, foamEdge, sx, sz]);
   useEffect(() => () => material.dispose(), [material]);

   useFrame(() => {
      material.uniforms.uTime.value = time.now * speed;
   }, FRAME_PRIORITY.visuals);

   return (
      <mesh
         material={material}
         position={[position[0], position[1], position[2]]}
         rotation={[-Math.PI / 2, 0, 0]}
         name="env-water"
      >
         <planeGeometry key={`${detail.segments[0]}x${detail.segments[1]}`} args={[sx, sz, detail.segments[0], detail.segments[1]]} />
      </mesh>
   );
}
