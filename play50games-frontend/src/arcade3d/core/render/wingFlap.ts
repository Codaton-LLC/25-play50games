// Wing flap for pooled flying creatures (birds, bats, a hawk): a vertex-shader bend of one static
// Hyper3D GLB, so a gull or a bat beats its wings instead of gliding as a stiff model. Owned by Claude.
//
//    <DynamicInstancedModel asset={ASSETS.gull} count={8} update={placeGull} flap={{ rate: 2.4, amplitude: 0.6 }} />
//
// The mesh's wings must spread along its x axis (a T-pose-like bird, the wings out to the sides).
// Every vertex further than `body` x the half-span from the centre line turns about the wing root
// (a line along z at that distance), the tips most and a little later than the roots, so the wing
// bends like a whip. The lift goes along the mesh's y. Each copy flaps at its own phase (taken
// from its instance position), on the run's pause-safe clock (`time.value`, set by the caller).
// Visual only: collisions use the game's own radii.
import type { BufferGeometry, Material } from "three";

export interface WingFlap {
   /** wing beats per second */
   rate: number;
   /** the wing tips' swing either side of the modelled pose, radians */
   amplitude: number;
   /** the share of the half-span that stays rigid round the centre (the body). Default 0.18 */
   body?: number;
}

/** The uniform every flapping material of one pool reads (seconds). */
export interface FlapClock {
   value: number;
}

/** The angle (rad) a wing point `k` (0 = root .. 1 = tip) turns to at `phase` (rad). Pure twin of the shader. */
export function flapAngle(flap: WingFlap, phase: number, k: number): number {
   return flap.amplitude * Math.sin(phase - k * 0.6);
}

/**
 * A clone of `material` whose vertices flap as described above. `geometry` gives the span (its
 * bounding box in mesh units); `clock` is shared by every material of the pool.
 */
export function flapMaterial(material: Material, geometry: BufferGeometry, flap: WingFlap, clock: FlapClock): Material {
   if (!geometry.boundingBox) geometry.computeBoundingBox();
   const box = geometry.boundingBox!;
   const center = (box.min.x + box.max.x) / 2;
   const half = Math.max(1e-4, (box.max.x - box.min.x) / 2);
   const root = half * (flap.body ?? 0.18);
   const out = material.clone();
   out.onBeforeCompile = (shader) => {
      shader.uniforms.uFlapTime = clock;
      shader.uniforms.uFlapRate = { value: flap.rate };
      shader.uniforms.uFlapAmp = { value: flap.amplitude };
      shader.uniforms.uFlapCenter = { value: center };
      shader.uniforms.uFlapHalf = { value: half };
      shader.uniforms.uFlapRoot = { value: root };
      shader.vertexShader = shader.vertexShader
         .replace(
            "#include <common>",
            "#include <common>\nuniform float uFlapTime;\nuniform float uFlapRate;\nuniform float uFlapAmp;\nuniform float uFlapCenter;\nuniform float uFlapHalf;\nuniform float uFlapRoot;"
         )
         .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
{
#ifdef USE_INSTANCING
   float flapPhase = uFlapTime * uFlapRate * 6.2831853 + instanceMatrix[3].x * 0.71 + instanceMatrix[3].z * 0.37;
#else
   float flapPhase = uFlapTime * uFlapRate * 6.2831853;
#endif
   float fd = transformed.x - uFlapCenter;
   float fa = max(0.0, abs(fd) - uFlapRoot);
   float fk = fa / max(1e-4, uFlapHalf - uFlapRoot);
   float fang = uFlapAmp * sin(flapPhase - fk * 0.6);
   transformed.x = uFlapCenter + sign(fd) * (min(abs(fd), uFlapRoot) + fa * cos(fang));
   transformed.y += fa * sin(fang);
}`
         );
   };
   out.customProgramCacheKey = () => `flap:${flap.rate}:${flap.amplitude}:${flap.body ?? 0.18}`;
   return out;
}
