"use client";

// Flooded Ruins Escape's water (look only, nothing here decides gameplay): one cheap shader for every
// surface (the chambers and the storm tide) and one for the water's body under it.
//
// Surface: a small vertex swell (none on the "flat" quality tier), two scrolling samples of one canvas
// ripple normal map, a fresnel mix from the deep teal-blue body colour to the sky, a sun / moon glint,
// and foam: along a chamber's walls (its rectangle's edges) or, for the tide, from a canvas mask of
// every block the water meets at its current height (redrawn as it rises). Body: darker and denser
// with depth under the surface. Both fog like the rest of the ruin.
import { CanvasTexture, Color, DoubleSide, LinearFilter, RepeatWrapping, ShaderMaterial, UniformsLib, UniformsUtils, Vector3, type Texture } from "three";

/** The water's palette: deep teal-blue, darker with depth. */
export const WATER = {
   shallow: "#1e7d8c",
   deep: "#0a2f45",
   abyss: "#04131f",
   foam: "#eef8fb",
   daySky: "#cfe8ea",
   stormSky: "#5b7d96",
   daySun: "#fff3d6",
   stormSun: "#c7dcff",
   /** the full-screen tint while the camera is under the surface */
   under: "#0b4b5e",
} as const;

/** A tileable ripple normal map (sum of whole-period waves), drawn once. */
export function rippleNormalTexture(size = 128): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = size;
   const g = c.getContext("2d")!;
   const img = g.createImageData(size, size);
   const TAU = Math.PI * 2;
   // [kx, ky, amplitude, phase]: integer wave numbers keep the tile seamless
   const waves: Array<[number, number, number, number]> = [
      [1, 2, 1, 0.3],
      [3, -1, 0.7, 1.9],
      [-2, 3, 0.55, 4.1],
      [5, 2, 0.35, 2.4],
      [-4, -5, 0.25, 5.3],
      [7, -3, 0.18, 0.8],
   ];
   for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
         const u = x / size;
         const v = y / size;
         let dx = 0;
         let dy = 0;
         for (const [kx, ky, a, ph] of waves) {
            const t = Math.cos(TAU * (kx * u + ky * v) + ph) * a;
            dx += t * kx;
            dy += t * ky;
         }
         const nx = -dx * 0.09;
         const ny = -dy * 0.09;
         const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
         const i = (y * size + x) * 4;
         img.data[i] = Math.round((nx * inv * 0.5 + 0.5) * 255);
         img.data[i + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
         img.data[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
         img.data[i + 3] = 255;
      }
   }
   g.putImageData(img, 0, 0);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.needsUpdate = true;
   return t;
}

export interface FoamBox {
   minX: number;
   minZ: number;
   sizeX: number;
   sizeZ: number;
}

/** A blank foam mask (red channel = foam) for the tide: filled by drawFoamMask. */
export function foamMaskTexture(px: number): { texture: CanvasTexture; ctx: CanvasRenderingContext2D } {
   const c = document.createElement("canvas");
   c.width = c.height = px;
   const ctx = c.getContext("2d")!;
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, px, px);
   const texture = new CanvasTexture(c);
   texture.minFilter = LinearFilter;
   texture.generateMipmaps = false;
   return { texture, ctx };
}

/**
 * Draws the foam where the water at `y` meets each block: a soft band round every block whose side
 * the surface crosses (blocks wholly above or below it make none). Returns how many it drew.
 */
export function drawFoamMask(
   ctx: CanvasRenderingContext2D,
   box: FoamBox,
   blocks: ReadonlyArray<{ cx: number; cz: number; hw: number; hd: number; top: number; bottom: number }>,
   y: number,
   band = 0.55,
): number {
   const px = ctx.canvas.width;
   const sx = px / box.sizeX;
   const sz = px / box.sizeZ;
   ctx.globalCompositeOperation = "source-over";
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, px, px);
   ctx.strokeStyle = "#fff";
   ctx.lineJoin = "round";
   let n = 0;
   const lw = Math.max(1.5, band * sx);
   for (const b of blocks) {
      if (!(b.bottom < y + 0.05 && b.top > y - 0.05)) continue;
      const x0 = (b.cx - b.hw - box.minX) * sx;
      const z0 = (b.cz - b.hd - box.minZ) * sz;
      ctx.lineWidth = lw * 2;
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(x0, z0, b.hw * 2 * sx, b.hd * 2 * sz);
      ctx.lineWidth = lw;
      ctx.globalAlpha = 1;
      ctx.strokeRect(x0, z0, b.hw * 2 * sx, b.hd * 2 * sz);
      n++;
   }
   ctx.globalAlpha = 1;
   return n;
}

const SURFACE_VERT = /* glsl */ `
   uniform float uTime;
   uniform float uSwell;
   varying vec3 vWorld;
   varying vec2 vUv;
   #include <fog_pars_vertex>
   void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      float w = sin(wp.x * 0.55 + uTime * 1.3) * 0.5 + sin(wp.z * 0.7 - uTime * 1.1) * 0.35 + sin((wp.x + wp.z) * 1.3 + uTime * 2.1) * 0.15;
      wp.y += w * uSwell;
      vWorld = wp.xyz;
      vUv = uv;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
   }
`;

const SURFACE_FRAG = /* glsl */ `
   uniform float uTime;
   uniform sampler2D uNormal;
   uniform sampler2D uFoamMap;
   uniform vec4 uFoamBox;
   uniform float uUseFoamMap;
   uniform vec2 uSize;
   uniform float uEdgeFoam;
   uniform vec3 uShallow;
   uniform vec3 uDeep;
   uniform vec3 uSky;
   uniform vec3 uSun;
   uniform vec3 uFoam;
   uniform vec3 uSunDir;
   uniform float uDepth;
   uniform float uOpacity;
   uniform float uDetail;
   varying vec3 vWorld;
   varying vec2 vUv;
   #include <fog_pars_fragment>
   void main() {
      vec2 p = vWorld.xz;
      vec3 n1 = texture2D(uNormal, p * 0.09 + vec2(uTime * 0.021, uTime * 0.013)).xyz * 2.0 - 1.0;
      vec3 n2 = uDetail > 0.5 ? texture2D(uNormal, p * 0.21 + vec2(-uTime * 0.017, uTime * 0.029)).xyz * 2.0 - 1.0 : vec3(0.0, 0.0, 1.0);
      vec2 tilt = (n1.xy + n2.xy * 0.6) * 0.55;
      vec3 N = normalize(vec3(tilt.x, 1.0, tilt.y));
      vec3 V = normalize(cameraPosition - vWorld);
      float ndv = abs(dot(N, V));
      float fres = pow(1.0 - ndv, 4.0);
      vec3 base = mix(uShallow, uDeep, uDepth);
      // a little light through the ripples' crests
      base += (n1.x * 0.5 + 0.5) * 0.05 * uShallow;
      vec3 col = mix(base, uSky, clamp(0.08 + fres * 0.85, 0.0, 1.0));
      vec3 H = normalize(normalize(uSunDir) + V);
      float spec = pow(max(dot(N, H), 0.0), 160.0) * 1.8 + pow(max(dot(N, H), 0.0), 24.0) * 0.12;
      col += uSun * spec;
      // foam: along the chamber's walls, or where the tide meets a block (the canvas mask)
      float foam = 0.0;
      if (uEdgeFoam > 0.5) {
         vec2 e = min(vUv, 1.0 - vUv) * uSize;
         foam = 1.0 - smoothstep(0.0, 0.6, min(e.x, e.y));
      }
      if (uUseFoamMap > 0.5) {
         vec2 fuv = (p - uFoamBox.xy) / uFoamBox.zw;
         if (fuv.x > 0.0 && fuv.x < 1.0 && fuv.y > 0.0 && fuv.y < 1.0) foam = max(foam, texture2D(uFoamMap, vec2(fuv.x, 1.0 - fuv.y)).r);
      }
      float breakup = n1.x * 0.35 + n2.y * 0.2 + 0.12 * sin(uTime * 2.3 + p.x * 2.7 + p.y * 1.9);
      float f = smoothstep(0.32, 0.7, foam + breakup * foam);
      col = mix(col, uFoam, f * 0.9);
      float alpha = clamp(mix(uOpacity, 0.97, fres) + f * 0.6, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
      #include <fog_fragment>
   }
`;

export interface SurfaceOptions {
   /** "flat": no swell, one ripple sample */
   lite: boolean;
   storm: boolean;
   /** a chamber: foam along its rectangle's edges (its walls); size in metres */
   edges?: { w: number; d: number };
   foamMap?: Texture;
   foamBox?: FoamBox;
   opacity?: number;
}

/** The water surface material. Animate with `uniforms.uTime.value` (visual seconds). */
export function waterSurfaceMaterial(normal: Texture, o: SurfaceOptions): ShaderMaterial {
   const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
         uTime: { value: 0 },
         uSwell: { value: o.lite ? 0 : 0.06 },
         uNormal: { value: null },
         uFoamMap: { value: null },
         uFoamBox: { value: [0, 0, 1, 1] },
         uUseFoamMap: { value: 0 },
         uSize: { value: [1, 1] },
         uEdgeFoam: { value: 0 },
         uShallow: { value: new Color(WATER.shallow) },
         uDeep: { value: new Color(WATER.deep) },
         uSky: { value: new Color(o.storm ? WATER.stormSky : WATER.daySky) },
         uSun: { value: new Color(o.storm ? WATER.stormSun : WATER.daySun) },
         uFoam: { value: new Color(WATER.foam) },
         uSunDir: { value: new Vector3(0.45, 0.8, 0.35) },
         uDepth: { value: 0.6 },
         uOpacity: { value: o.opacity ?? 0.78 },
         uDetail: { value: o.lite ? 0 : 1 },
      },
   ]);
   // merge clones values: textures go in afterwards so they stay shared
   uniforms.uNormal.value = normal;
   if (o.foamMap && o.foamBox) {
      uniforms.uFoamMap.value = o.foamMap;
      uniforms.uFoamBox.value = [o.foamBox.minX, o.foamBox.minZ, o.foamBox.sizeX, o.foamBox.sizeZ];
      uniforms.uUseFoamMap.value = 1;
   }
   if (o.edges) {
      uniforms.uEdgeFoam.value = 1;
      uniforms.uSize.value = [o.edges.w, o.edges.d];
   }
   return new ShaderMaterial({
      uniforms,
      vertexShader: SURFACE_VERT,
      fragmentShader: SURFACE_FRAG,
      transparent: true,
      depthWrite: false,
      fog: true,
      side: DoubleSide,
   });
}

const BODY_VERT = /* glsl */ `
   varying vec3 vWorld;
   #include <fog_pars_vertex>
   void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
   }
`;

const BODY_FRAG = /* glsl */ `
   uniform float uSurface;
   uniform vec3 uShallow;
   uniform vec3 uDeep;
   uniform vec3 uAbyss;
   varying vec3 vWorld;
   #include <fog_pars_fragment>
   void main() {
      float d = max(0.0, uSurface - vWorld.y);
      vec3 col = mix(mix(uShallow, uDeep, smoothstep(0.0, 2.5, d)), uAbyss, smoothstep(2.5, 9.0, d));
      float alpha = mix(0.5, 0.95, smoothstep(0.0, 4.0, d));
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
      #include <fog_fragment>
   }
`;

/** The water's body (its sides seen through gaps): darker and denser with depth under `uSurface`. */
export function waterBodyMaterial(): ShaderMaterial {
   const uniforms = UniformsUtils.merge([
      UniformsLib.fog,
      {
         uSurface: { value: 0 },
         uShallow: { value: new Color(WATER.shallow) },
         uDeep: { value: new Color(WATER.deep) },
         uAbyss: { value: new Color(WATER.abyss) },
      },
   ]);
   return new ShaderMaterial({ uniforms, vertexShader: BODY_VERT, fragmentShader: BODY_FRAG, transparent: true, depthWrite: false, fog: true });
}
