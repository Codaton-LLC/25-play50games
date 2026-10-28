// A cloth wave for a static GLB (a flying carpet, a flag, a sail): a vertex-shader ripple that runs
// along the mesh's z axis, growing towards the far ends, so a stiff Hyper3D model reads as cloth.
// Owned by Claude. Visual only.
//
//    const clock = useMemo(() => ({ value: 0 }), []);
//    patchClothWave(groupRef.current, { amplitude: 0.06, wavelength: 1.6, speed: 2.4 }, clock);  // once the GLB is in
//    useFrame(() => (clock.value = time.now));
import type { BufferGeometry, Material, Mesh, Object3D } from "three";
import type { FlapClock } from "./wingFlap";

export interface ClothWave {
   /** the ripple's height at the ends of the mesh, in mesh units */
   amplitude: number;
   /** one ripple's length along z, in mesh units */
   wavelength: number;
   /** ripples per second */
   speed: number;
}

/** The ripple's lift at a point `u` (-1 = the back end .. 1 = the front end) and time t. Pure twin of the shader. */
export function clothLift(wave: ClothWave, u: number, zMesh: number, t: number): number {
   return wave.amplitude * (0.35 + 0.65 * Math.abs(u)) * Math.sin((zMesh / wave.wavelength) * Math.PI * 2 - t * wave.speed * Math.PI * 2);
}

/** A clone of `material` whose vertices ripple along z (see above). */
export function clothWaveMaterial(material: Material, geometry: BufferGeometry, wave: ClothWave, clock: FlapClock): Material {
   if (!geometry.boundingBox) geometry.computeBoundingBox();
   const box = geometry.boundingBox!;
   const center = (box.min.z + box.max.z) / 2;
   const half = Math.max(1e-4, (box.max.z - box.min.z) / 2);
   const out = material.clone();
   out.onBeforeCompile = (shader) => {
      shader.uniforms.uWaveTime = clock;
      shader.uniforms.uWaveAmp = { value: wave.amplitude };
      shader.uniforms.uWaveLen = { value: wave.wavelength };
      shader.uniforms.uWaveSpeed = { value: wave.speed };
      shader.uniforms.uWaveCenter = { value: center };
      shader.uniforms.uWaveHalf = { value: half };
      shader.vertexShader = shader.vertexShader
         .replace("#include <common>", "#include <common>\nuniform float uWaveTime;\nuniform float uWaveAmp;\nuniform float uWaveLen;\nuniform float uWaveSpeed;\nuniform float uWaveCenter;\nuniform float uWaveHalf;")
         .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
{
   float wu = (transformed.z - uWaveCenter) / uWaveHalf;
   transformed.y += uWaveAmp * (0.35 + 0.65 * abs(wu)) * sin(transformed.z / uWaveLen * 6.2831853 - uWaveTime * uWaveSpeed * 6.2831853);
}`
         );
   };
   out.customProgramCacheKey = () => `cloth:${wave.amplitude}:${wave.wavelength}:${wave.speed}`;
   return out;
}

/**
 * Gives every mesh under `root` the cloth wave (once: patched meshes are marked). Returns how many
 * meshes it patched, so a caller can retry until the GLB has loaded.
 */
export function patchClothWave(root: Object3D, wave: ClothWave, clock: FlapClock): number {
   let n = 0;
   root.traverse((obj) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh || mesh.userData.clothWave) return;
      const geo = mesh.geometry;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => clothWaveMaterial(m, geo, wave, clock)) : clothWaveMaterial(mesh.material, geo, wave, clock);
      mesh.userData.clothWave = true;
      n++;
   });
   return n;
}
