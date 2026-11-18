"use client";

// Camera-facing quads in one draw call (the cloud sea, glows, sparks, smoke, wind streaks): one
// instanced quad with a per-copy centre, size and tint, fogged in the shader. `live` rewrites the
// copies each frame (moving glows); a size of 0 hides a copy.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   Color,
   InstancedBufferAttribute,
   InstancedBufferGeometry,
   NormalBlending,
   PlaneGeometry,
   ShaderMaterial,
   type Texture,
} from "three";

export interface Billboard {
   x: number;
   y: number;
   z: number;
   size: number;
   r?: number;
   g?: number;
   b?: number;
}

export interface FogBand {
   color: string;
   near: number;
   far: number;
}

function material(map: Texture, additive: boolean, fog: FogBand, opacity: number, aspect: number, stretch: boolean): ShaderMaterial {
   return new ShaderMaterial({
      uniforms: {
         uMap: { value: map },
         uOpacity: { value: opacity },
         uFogColor: { value: new Color(fog.color) },
         uFogNear: { value: fog.near },
         uFogFar: { value: fog.far },
         uAspect: { value: aspect },
      },
      vertexShader: /* glsl */ `
         attribute vec4 aSpot;
         attribute vec3 aTint;
         uniform float uAspect;
         varying vec2 vUv;
         varying vec3 vTint;
         varying float vFogDepth;
         void main() {
            vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.0);
            ${stretch
               ? `// world-x streaks: the quad lies along the world's +x, turned to face the camera
            vec3 ax = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
            vec3 ay = normalize(cross(vec3(0.0, 0.0, 1.0), ax));
            mv.xyz += (ax * position.x * uAspect + ay * position.y) * aSpot.w;`
               : `mv.xy += position.xy * aSpot.w * vec2(uAspect, 1.0);`}
            vUv = uv;
            vTint = aTint;
            vFogDepth = -mv.z;
            gl_Position = projectionMatrix * mv;
         }
      `,
      fragmentShader: /* glsl */ `
         uniform sampler2D uMap;
         uniform float uOpacity;
         uniform vec3 uFogColor;
         uniform float uFogNear;
         uniform float uFogFar;
         varying vec2 vUv;
         varying vec3 vTint;
         varying float vFogDepth;
         void main() {
            vec4 tex = texture2D(uMap, vUv);
            float fog = smoothstep(uFogNear, uFogFar, vFogDepth);
            vec3 col = mix(tex.rgb * vTint, uFogColor, fog * ${additive ? "0.0" : "0.55"});
            float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x) * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
            float a = tex.a * edge * uOpacity * ${additive ? "(1.0 - fog)" : "1.0"};
            if (a < 0.004) discard;
            gl_FragColor = vec4(col, a);
            #include <colorspace_fragment>
         }
      `,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      fog: false,
   });
}

export function BillboardField({
   spots,
   map,
   fog,
   additive = false,
   opacity = 1,
   aspect = 1.6,
   stretch = false,
   renderOrder = 0,
   live,
}: {
   spots: readonly Billboard[];
   map: Texture;
   fog: FogBand;
   additive?: boolean;
   opacity?: number;
   aspect?: number;
   /** lay the quads along world +x (wind streaks) instead of the screen */
   stretch?: boolean;
   renderOrder?: number;
   /** rewrite copies each frame: data is [x, y, z, size] per copy; return true when it changed */
   live?: (data: Float32Array) => boolean;
}) {
   const geometry = useMemo(() => {
      const base = new PlaneGeometry(1, 1);
      const g = new InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute("position", base.getAttribute("position"));
      g.setAttribute("uv", base.getAttribute("uv"));
      const spot = new Float32Array(Math.max(1, spots.length) * 4);
      const tint = new Float32Array(Math.max(1, spots.length) * 3);
      spots.forEach((s, i) => {
         spot.set([s.x, s.y, s.z, s.size], i * 4);
         tint.set([s.r ?? 1, s.g ?? 1, s.b ?? 1], i * 3);
      });
      const a = new InstancedBufferAttribute(spot, 4);
      if (live) a.setUsage(35048); // DynamicDrawUsage
      g.setAttribute("aSpot", a);
      g.setAttribute("aTint", new InstancedBufferAttribute(tint, 3));
      g.instanceCount = spots.length;
      return g;
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [spots]);
   const mat = useMemo(() => material(map, additive, fog, opacity, aspect, stretch), [map, additive, fog, opacity, aspect, stretch]);
   useEffect(
      () => () => {
         geometry.dispose();
         mat.dispose();
      },
      [geometry, mat],
   );
   useFrame(() => {
      if (!live) return;
      const attr = geometry.getAttribute("aSpot") as InstancedBufferAttribute;
      if (live(attr.array as Float32Array)) attr.needsUpdate = true;
   });
   if (spots.length === 0) return null;
   return <mesh geometry={geometry} material={mat} frustumCulled={false} renderOrder={renderOrder} />;
}

/** Hex colour to linear-ish 0..1 rgb for a billboard tint. */
export function tintOf(hex: string): { r: number; g: number; b: number } {
   const c = new Color(hex);
   return { r: c.r, g: c.g, b: c.b };
}
