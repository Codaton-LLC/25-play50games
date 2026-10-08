"use client";

// The detector ring on the sand around the explorer and the dig-progress arc: one shader quad, one
// draw call. It shows the rules' detector three ways at once (README "Accessibility"): the ring's
// radius (0.7 -> 1.5 m) and colour (slate -> gold) by the strength, a wave that runs out of the
// centre once per pulse (the rules' pulse phase, so a beep and a wave are the same event), and a
// second solid ring when a dig would find the treasure ("ready"). While a dig is held, an arc around
// the ring fills clockwise from the top over DIG.holdS.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, ShaderMaterial, type Mesh } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { groundAt, waterLevel } from "./looks";
import { DIG, shoreAt, type RunState } from "./rules";

/** Ring radius at strength s (m). */
export const ringRadius = (s: number) => 0.7 + 0.8 * s;
/** The quad's half size (m): the ring, the ready ring and the arc fit inside. */
const OUTER = 2.2;
const SLATE = new Color("#64748b");
const GOLD = new Color("#fbbf24");

const VERTEX = /* glsl */ `
varying vec2 vP;
void main() {
   vP = (uv * 2.0 - 1.0) * ${OUTER.toFixed(2)};
   gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uRadius;
uniform float uPulse;
uniform float uReady;
uniform float uProgress;
uniform float uOpacity;
varying vec2 vP;

float band(float r, float at, float width) {
   return 1.0 - smoothstep(width * 0.6, width, abs(r - at));
}

void main() {
   float r = length(vP);
   // the ring: colour with a dark rim so it reads on pale sand
   float ring = band(r, uRadius, 0.07);
   float rim = band(r, uRadius, 0.11) - ring;
   // the pulse wave runs from the centre to the ring once per pulse, fading
   float wave = band(r, uRadius * (0.25 + 0.9 * uPulse), 0.06) * (1.0 - uPulse) * 0.85;
   // ready: a second solid ring outside the first
   float ready = band(r, uRadius + 0.2, 0.06) * uReady;
   // dig progress: an arc outside, filling clockwise from the top (the camera's -z)
   float angle = fract(atan(vP.x, vP.y) / 6.28318530718 + 1.0);
   float arc = band(r, uRadius + 0.42, 0.07) * step(angle, uProgress) * step(0.001, uProgress);
   float arcTrack = band(r, uRadius + 0.42, 0.07) * step(0.001, uProgress) * 0.25;
   float wc = ring + wave + ready;
   float wa = arc + arcTrack;
   float sum = max(0.0001, wc + rim + wa);
   vec3 col = (uColor * wc + vec3(0.05, 0.06, 0.1) * rim + vec3(0.94, 0.99, 0.98) * wa) / sum;
   float a = clamp(wc + rim * 0.55 + wa, 0.0, 1.0) * uOpacity;
   if (a < 0.01) discard;
   gl_FragColor = vec4(col, a);
   #include <colorspace_fragment>
}
`;

export function DetectorRing({ run }: { run: RunState }) {
   const mesh = useRef<Mesh>(null);
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uColor: { value: new Color() },
               uRadius: { value: 0.7 },
               uPulse: { value: 0 },
               uReady: { value: 0 },
               uProgress: { value: 0 },
               uOpacity: { value: 1 },
            },
            vertexShader: VERTEX,
            fragmentShader: FRAGMENT,
            transparent: true,
            depthWrite: false,
         }),
      []
   );
   useEffect(() => () => material.dispose(), [material]);

   useFrame(() => {
      const m = mesh.current;
      if (!m) return;
      const { phase } = useArcadeStore.getState();
      const det = run.detector;
      const e = run.explorer;
      const u = material.uniforms;
      const shown = phase === "playing" || phase === "paused" || phase === "countdown";
      m.visible = shown && det.target >= 0;
      if (!m.visible) return;
      (u.uColor.value as Color).copy(SLATE).lerp(GOLD, det.ready ? 1 : det.strength);
      u.uRadius.value = ringRadius(det.strength);
      u.uPulse.value = det.pulse;
      u.uReady.value = det.ready ? 1 : 0;
      u.uProgress.value = run.dig.active ? Math.min(1, run.dig.held / DIG.holdS) : 0;
      // on the sand (the inland side of the slope, so the ring never sinks into it) or on the water
      const ground = Math.max(groundAt(e.x * 0.9, e.z * 0.9), groundAt(e.x, e.z));
      m.position.set(e.x, Math.max(ground, waterLevel(shoreAt(run.time))) + 0.04, e.z);
   });

   return (
      <mesh ref={mesh} material={material} rotation-x={-Math.PI / 2} renderOrder={3} name="detector-ring">
         <planeGeometry args={[OUTER * 2, OUTER * 2]} />
      </mesh>
   );
}
