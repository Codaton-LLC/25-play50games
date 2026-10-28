"use client";

// Wind Tunnel Escape's look: one palette (a slate-blue storm tunnel with cyan light strips, teal
// currents, storm-violet hazards with a white rim, gold for orbs and hints), the procedural panel
// material every block shares (world-space panels, bevel lines, light strips, hazard edges: one shader,
// one draw call per look), canvas glows, and the per-level sky. Pure helpers are tested in look.test.ts.
import { CanvasTexture, Color, MeshStandardMaterial, SRGBColorSpace, type Texture } from "three";
import type { BlockLook } from "./tunnel";

export const COLORS = {
   background: "#20314a",
   fog: "#2c4462",
   skyTop: "#0f1d33",
   skyMid: "#2a4a6e",
   skyBottom: "#6f9cc4",
   floor: "#40587a",
   floorLine: "#22324a",
   wall: "#3a5577",
   wallLine: "#1b2a40",
   ledge: "#456184",
   pillar: "#52708f",
   duct: "#3a3f5c",
   shelf: "#5b6f8f",
   strip: "#5eead4",
   hazard: "#facc15",
   current: "#7dd3fc",
   currentStrong: "#f0f9ff",
   storm: "#7c3aed",
   stormRim: "#f5f3ff",
   ghost: "#c4b5fd",
   shock: "#4ade80",
   orb: "#ffe08a",
   hint: "#fbbf24",
   gate: "#7c5a2b",
} as const;

/** Levels 4 and 5 run at storm dusk: a violet sky, closer fog. */
export const DUSK = {
   skyTop: "#160f2e",
   skyMid: "#3b2a6b",
   skyBottom: "#8a6fb8",
   background: "#2a2147",
   fog: "#3a2d5e",
} as const;

export function isDusk(level: number): boolean {
   return level >= 4;
}

/** The fog band per level (near, far). */
export function fogFor(level: number): { color: string; near: number; far: number } {
   return isDusk(level) ? { color: DUSK.fog, near: 30, far: 110 } : { color: COLORS.fog, near: 36, far: 130 };
}

/** The level's environment override for GameDefinition.levels (levels 4-5 dusk). */
export function levelEnvironment(level: number): { background: string; fog: [string, number, number]; lighting: "day" | "night" } {
   const f = fogFor(level);
   return { background: isDusk(level) ? DUSK.background : COLORS.background, fog: [f.color, f.near, f.far], lighting: isDusk(level) ? "night" : "day" };
}

/** Each block look's two tones (base, panel line) and whether it carries light strips / hazard edges. */
export const BLOCK_LOOKS: Record<Exclude<BlockLook, "housing" | "ghost" | "cover" | "gate">, { base: string; line: string; strip: number; hazard: number; panel: number }> = {
   floor: { base: COLORS.floor, line: COLORS.floorLine, strip: 0, hazard: 1, panel: 2 },
   wall: { base: COLORS.wall, line: COLORS.wallLine, strip: 1, hazard: 0, panel: 3 },
   ledge: { base: COLORS.ledge, line: COLORS.wallLine, strip: 1, hazard: 1, panel: 2 },
   pillar: { base: COLORS.pillar, line: COLORS.floorLine, strip: 0, hazard: 1, panel: 1.5 },
   duct: { base: COLORS.duct, line: "#24263a", strip: 1, hazard: 0, panel: 1.2 },
   shelf: { base: COLORS.shelf, line: COLORS.floorLine, strip: 0, hazard: 1, panel: 1 },
};

/**
 * The panel pattern (pure, for tests): 0 on a panel's face, 1 on the bevel line between panels, at
 * world coordinate u along a face with panels `size` wide and a line `line` wide.
 */
export function panelLine(u: number, size: number, line = 0.06): number {
   const f = ((u / size) % 1 + 1) % 1;
   const d = Math.min(f, 1 - f) * size;
   return d < line ? 1 : 0;
}

/**
 * The shared block material: a MeshStandardMaterial (lit, fogged) whose colour is drawn in world space
 * by the shader: panels with bevel lines, a cyan light strip along the top of walls, yellow-black hazard
 * edges along floor rims. Instanced boxes keep it (the pattern reads the world position, not the UVs).
 */
export function blockMaterial(look: keyof typeof BLOCK_LOOKS): MeshStandardMaterial {
   const L = BLOCK_LOOKS[look];
   const m = new MeshStandardMaterial({ color: L.base, roughness: 0.78, metalness: 0.18 });
   const line = new Color(L.line);
   const strip = new Color(COLORS.strip);
   const hazard = new Color(COLORS.hazard);
   m.onBeforeCompile = (shader) => {
      shader.uniforms.uLine = { value: line };
      shader.uniforms.uStrip = { value: strip };
      shader.uniforms.uHazard = { value: hazard };
      shader.uniforms.uPanel = { value: L.panel };
      shader.uniforms.uUseStrip = { value: L.strip };
      shader.uniforms.uUseHazard = { value: L.hazard };
      shader.vertexShader = shader.vertexShader
         .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nvarying float vTop;")
         .replace(
            "#include <worldpos_vertex>",
            `#include <worldpos_vertex>
            vec4 wp4 = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
               wp4 = instanceMatrix * wp4;
            #endif
            wp4 = modelMatrix * wp4;
            vWPos = wp4.xyz;
            vec4 top4 = vec4(0.0, 0.5, 0.0, 1.0);
            #ifdef USE_INSTANCING
               top4 = instanceMatrix * top4;
            #endif
            vTop = (modelMatrix * top4).y;
            vec3 n0 = objectNormal;
            #ifdef USE_INSTANCING
               n0 = mat3(instanceMatrix) * n0;
            #endif
            vWNormal = normalize(mat3(modelMatrix) * n0);`,
         );
      shader.fragmentShader = shader.fragmentShader
         .replace(
            "#include <common>",
            `#include <common>
            varying vec3 vWPos;
            varying vec3 vWNormal;
            varying float vTop;
            uniform vec3 uLine;
            uniform vec3 uStrip;
            uniform vec3 uHazard;
            uniform float uPanel;
            uniform float uUseStrip;
            uniform float uUseHazard;
            float pline(float u, float s) { float f = fract(u / s); float d = min(f, 1.0 - f) * s; return 1.0 - smoothstep(0.03, 0.07, d); }`,
         )
         .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            vec3 an = abs(vWNormal);
            vec2 uv = an.y > 0.5 ? vWPos.xz : (an.x > 0.5 ? vWPos.zy : vWPos.xy);
            float l = max(pline(uv.x, uPanel), pline(uv.y, uPanel));
            diffuseColor.rgb = mix(diffuseColor.rgb, uLine, l * 0.85);
            // a soft vertical gradient so tall faces read as depth
            diffuseColor.rgb *= 0.86 + 0.14 * clamp(fract(vWPos.y / 9.0) + 0.2, 0.0, 1.0);
            // a yellow-black hazard edge along the top rim of side faces (gap edges, ledges)
            float rim = an.y < 0.5 ? 1.0 - step(0.22, vTop - vWPos.y) : 0.0;
            float stripes = step(0.5, fract((vWPos.x + vWPos.z + vWPos.y) * 1.6));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(uHazard, vec3(0.08), stripes), rim * uUseHazard);`,
         )
         .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            // a cyan light strip at 2.6 m over each 9 m band on walls
            float band = abs(fract(vWPos.y / 9.0 - 0.29) - 0.5);
            float s = (1.0 - smoothstep(0.004, 0.012, abs(band - 0.5) )) * step(an.y, 0.5) * uUseStrip;
            totalEmissiveRadiance += uStrip * s * 1.6;`,
         );
   };
   m.customProgramCacheKey = () => `wte-block-${look}`;
   return m;
}

/** A soft round glow (orb halos, current glints), drawn once per mount. */
export function glowTexture(size = 64): Texture {
   const c = document.createElement("canvas");
   c.width = c.height = size;
   const g = c.getContext("2d")!;
   const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
   grad.addColorStop(0, "rgba(255,255,255,1)");
   grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(0, 0, size, size);
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** A current streak's colour by strength: cyan for one current, near white where currents add. */
export function streakColor(speed: number, out: Color): Color {
   const k = Math.max(0, Math.min(1, (speed - 7) / 3));
   return out.set(COLORS.current).lerp(new Color(COLORS.currentStrong), k);
}

/** The storm's lightning flash 0..1 (visual only): a double flicker every ~4.3 s. */
export function lightningFlash(timeS: number): number {
   if (!(timeS > 0)) return 0;
   const period = 4.3;
   const n = Math.floor(timeS / period);
   if (n % 3 === 2) return 0;
   const t = timeS - n * period;
   if (t < 0.08) return 1;
   if (t < 0.16) return 0.2;
   if (t < 0.24) return 0.75;
   return Math.max(0, 0.75 - (t - 0.24) * 3);
}
