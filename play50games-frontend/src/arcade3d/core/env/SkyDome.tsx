"use client";

// A two-colour gradient sky: one inside-out sphere around the camera, never fogged, drawn behind
// everything (one draw call).
//
//    <SkyDome top="#1e3a8a" bottom="#fdba74" />
//
// It follows the camera, so it never clips however far the camera travels. Combine with a matching
// environment.background (seen only where the dome does not reach) and lighting preset.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, ShaderMaterial, type Mesh } from "three";
import { FRAME_PRIORITY } from "../frameLoop";

export interface SkyDomeProps {
   /** colour overhead */
   top?: string;
   /** colour at and below the horizon */
   bottom?: string;
   /** shifts the horizon up (> 0) or down (< 0), as a fraction of the radius */
   offset?: number;
   /** < 1 = the top colour reaches further down, > 1 = a tighter band at the horizon */
   exponent?: number;
   /** inside the camera's far plane (400); default 180 */
   radius?: number;
}

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
   vDir = normalize(position);
   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uOffset;
uniform float uExponent;
varying vec3 vDir;
void main() {
   float h = max(vDir.y + uOffset, 0.0);
   gl_FragColor = vec4(mix(uBottom, uTop, pow(h, uExponent)), 1.0);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
}
`;

export function SkyDome({ top = "#60a5fa", bottom = "#e0f2fe", offset = 0, exponent = 0.7, radius = 180 }: SkyDomeProps) {
   const ref = useRef<Mesh>(null);
   const camera = useThree((state) => state.camera);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTop: { value: new Color() },
               uBottom: { value: new Color() },
               uOffset: { value: 0 },
               uExponent: { value: 1 },
            },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            side: BackSide,
            depthWrite: false,
            fog: false,
         }),
      []
   );
   useEffect(() => {
      (material.uniforms.uTop.value as Color).set(top);
      (material.uniforms.uBottom.value as Color).set(bottom);
      material.uniforms.uOffset.value = offset;
      material.uniforms.uExponent.value = Math.max(0.05, exponent);
   }, [material, top, bottom, offset, exponent]);
   useEffect(() => () => material.dispose(), [material]);

   // centred on the camera, after the rigs moved it
   useFrame(() => {
      ref.current?.position.copy(camera.position);
   }, FRAME_PRIORITY.visuals);

   return (
      <mesh ref={ref} material={material} renderOrder={-1000} frustumCulled={false} name="env-sky">
         <sphereGeometry args={[radius, 32, 16]} />
      </mesh>
   );
}
