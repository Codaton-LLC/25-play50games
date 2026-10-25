"use client";

// Sky Tower Jump's look: one palette, the drawn textures (clouds, glows, the rock, the
// waterfall, the pad arrow) and the billboard shader shared by clouds and glows. Textures are drawn
// once per mount on a canvas (no image files) and disposed with their component.
import { CanvasTexture, Color, ShaderMaterial, AdditiveBlending, NormalBlending, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

export const COLORS = {
   skyTop: "#1658c9",
   skyMid: "#4f9cf0",
   skyBottom: "#cfeaff",
   fog: "#b9dcfa",
   background: "#8cc4f5",
   sun: "#fff0d2",
   rim: "#cfe8ff",
   cloud: "#ffffff",
   cloudShade: "#b9cde6",
   orbGlow: "#ffd76a",
   padGlow: "#4cc9ff",
   beaconIdle: "#5ad1ff",
   beaconLit: "#ffd257",
   portal: "#8fe3ff",
   rockTop: "#e8d8c0",
   rockMid: "#ffffff",
   rockBottom: "#b8a894",
   water: "#bfe9ff",
} as const;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
   const c = document.createElement("canvas");
   c.width = w;
   c.height = h;
   return [c, c.getContext("2d")!];
}

function finish(c: HTMLCanvasElement, srgb = true): CanvasTexture {
   const t = new CanvasTexture(c);
   if (srgb) t.colorSpace = SRGBColorSpace;
   t.needsUpdate = true;
   return t;
}

/** A soft cumulus puff: white top, a blue-grey belly, feathered edges. Seeded by `variant`. */
export function cloudTexture(variant: number): CanvasTexture {
   const [c, g] = canvas(256, 160);
   let s = 1234 + variant * 977;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   const blobs: Array<[number, number, number]> = [];
   for (let i = 0; i < 11; i++) {
      const x = 64 + rnd() * 128;
      const y = 92 + (rnd() - 0.5) * 24 - Math.sin(((x - 64) / 128) * Math.PI) * 26;
      blobs.push([x, y, 20 + rnd() * 22]);
   }
   // belly shade first, then the lit tops slightly higher
   for (const [x, y, r] of blobs) {
      const grad = g.createRadialGradient(x, y + 8, r * 0.2, x, y + 8, r);
      grad.addColorStop(0, "rgba(185,205,230,0.95)");
      grad.addColorStop(1, "rgba(185,205,230,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y + 8, r, 0, Math.PI * 2);
      g.fill();
   }
   for (const [x, y, r] of blobs) {
      const grad = g.createRadialGradient(x - r * 0.15, y - r * 0.25, r * 0.1, x, y, r * 0.95);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.6, "rgba(250,252,255,0.85)");
      grad.addColorStop(1, "rgba(240,246,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r * 0.95, 0, Math.PI * 2);
      g.fill();
   }
   return finish(c);
}

/** A round soft glow (white; tinted by the material). */
export function glowTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
   grad.addColorStop(0, "rgba(255,255,255,1)");
   grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
   grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(0, 0, 128, 128);
   return finish(c, false);
}

/** The pad's up arrow (white on transparent; tinted additive). */
export function arrowTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   g.fillStyle = "rgba(255,255,255,1)";
   g.shadowColor = "rgba(255,255,255,0.9)";
   g.shadowBlur = 10;
   g.beginPath();
   g.moveTo(64, 14);
   g.lineTo(110, 62);
   g.lineTo(82, 62);
   g.lineTo(82, 112);
   g.lineTo(46, 112);
   g.lineTo(46, 62);
   g.lineTo(18, 62);
   g.closePath();
   g.fill();
   return finish(c, false);
}

/** Cliff rock: horizontal strata of blocky stones with dark joints (tiled around the rock roots). */
export function rockTexture(): CanvasTexture {
   const [c, g] = canvas(256, 256);
   let s = 4242;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   g.fillStyle = "#6b5a48";
   g.fillRect(0, 0, 256, 256);
   let y = 0;
   while (y < 256) {
      const h = 18 + rnd() * 26;
      let x = -rnd() * 30;
      while (x < 256) {
         const w = 28 + rnd() * 50;
         const l = 150 + rnd() * 70;
         g.fillStyle = `rgb(${l}, ${l * 0.86}, ${l * 0.7})`;
         g.fillRect(x + 2, y + 2, w - 3, h - 3);
         // a lit top edge and a darker bottom on each stone
         g.fillStyle = "rgba(255,245,225,0.25)";
         g.fillRect(x + 2, y + 2, w - 3, 3);
         g.fillStyle = "rgba(40,28,18,0.25)";
         g.fillRect(x + 2, y + h - 5, w - 3, 3);
         x += w;
      }
      y += h;
   }
   const t = finish(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.repeat.set(3, 1.5);
   return t;
}

/** Falling water: soft vertical streaks, tiled down the strip (scrolled in the shader). */
export function waterfallTexture(): CanvasTexture {
   const [c, g] = canvas(64, 256);
   g.fillStyle = "rgba(200,235,255,0.55)";
   g.fillRect(0, 0, 64, 256);
   let s = 99;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 40; i++) {
      const x = rnd() * 64;
      const w = 1 + rnd() * 4;
      const y = rnd() * 256;
      const h = 30 + rnd() * 120;
      g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
      g.fillRect(x, y, w, h);
      g.fillRect(x, y - 256, w, h);
   }
   const t = finish(c);
   return t;
}

/** The billboard shader for instanced quads (clouds, glows): per-instance centre + size + shade, fogged. */
export function billboardMaterial(map: Texture, additive: boolean, fog: { color: string; near: number; far: number }, opacity = 1): ShaderMaterial {
   return new ShaderMaterial({
      uniforms: {
         uMap: { value: map },
         uOpacity: { value: opacity },
         uTint: { value: new Color("#ffffff") },
         uShade: { value: new Color(COLORS.cloudShade) },
         uFogColor: { value: new Color(fog.color) },
         uFogNear: { value: fog.near },
         uFogFar: { value: fog.far },
         uAspect: { value: 1.6 },
      },
      vertexShader: /* glsl */ `
         attribute vec4 aSpot;   // centre xyz, size
         attribute vec3 aTint;   // instance colour
         uniform float uAspect;
         varying vec2 vUv;
         varying vec3 vTint;
         varying float vFogDepth;
         void main() {
            vec4 mv = viewMatrix * vec4(aSpot.xyz, 1.0);
            mv.xy += position.xy * aSpot.w * vec2(uAspect, 1.0);
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
            vec3 col = mix(tex.rgb * vTint, uFogColor, fog * ${additive ? "0.0" : "0.45"});
            // feather the quad's border so no cloud ever shows a straight edge
            float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
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
