// Wing flap, visual only: the bee GLB is one baked mesh, so its wings are bent in the vertex shader.
// Vertices out past the body (|x| beyond WING_ROOT, raw GLB units, x = wing tip to wing tip) swing up and
// down about the body's length axis, more the further out they are. No rules, hitbox or fit changes.
import type { Material, Object3D } from "three";

/** Wing beats per second and the swing (radians at the tips). */
export const FLAP_HZ = 14;
export const FLAP_SWING = 0.55;
/** raw GLB units: the body stays still inside this, the wings bend outside it */
export const WING_ROOT = 0.22;

/** Shared by every patched material; set `value` to the run clock's seconds each frame. */
export const FLAP_TIME = { value: 0 };

/** The flap offset of a vertex at raw x (shared with the shader; tests pin it). */
export function flapOffset(x: number, seconds: number): number {
   const reach = Math.max(0, Math.abs(x) - WING_ROOT);
   return Math.sin(seconds * FLAP_HZ * Math.PI * 2) * FLAP_SWING * reach;
}

type Patchable = Material & { userData: Record<string, unknown>; onBeforeCompile?: (shader: { uniforms: Record<string, { value: number }>; vertexShader: string }) => void };

/** Patches every mesh material under `root` once (the bee's); cheap to call every frame. */
export function patchWings(root: Object3D): void {
   root.traverse((o) => {
      const mat = (o as { material?: Patchable | Patchable[] }).material;
      if (!mat) return;
      for (const m of Array.isArray(mat) ? mat : [mat]) {
         if (m.userData.flap) continue;
         m.userData.flap = true;
         m.onBeforeCompile = (shader) => {
            shader.uniforms.uFlapT = FLAP_TIME;
            shader.vertexShader = shader.vertexShader
               .replace("#include <common>", `#include <common>\nuniform float uFlapT;`)
               .replace(
                  "#include <begin_vertex>",
                  `#include <begin_vertex>\n  float reach = max(0.0, abs(position.x) - ${WING_ROOT.toFixed(3)});\n  transformed.y += sin(uFlapT * ${(FLAP_HZ * Math.PI * 2).toFixed(3)}) * ${FLAP_SWING.toFixed(3)} * reach;`,
               );
         };
         m.needsUpdate = true;
      }
   });
}
