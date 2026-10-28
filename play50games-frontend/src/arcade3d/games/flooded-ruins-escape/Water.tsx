"use client";

// The ruin's water, drawn from the rules (waterLook.ts has the shaders): each chamber's water (a rippling
// surface with foam along its walls, a body darker with depth, a ripple ring when a lever moves it and
// the card's glowing target line on its walls), the storm tide (the same water under the whole ruin,
// foam where it meets a block at its current height), bubbles round the hero while it swims, and a
// gentle teal shift of the picture while the camera is under a surface. Phones ("flat" water quality)
// get the same water without the swell or the second ripple layer.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, type Group, type Mesh, type MeshBasicMaterial, type ShaderMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { tideY, zoneLevel, type RuinRun } from "./rules";
import { WATER, drawFoamMask, foamMaskTexture, rippleNormalTexture, waterBodyMaterial, waterSurfaceMaterial, type FoamBox } from "./waterLook";

/** The visual clock (ms of rules time), written by Scene every frame. */
interface VisualClock {
   ms: number;
}

const visMs = (clock: VisualClock) => Math.max(0, clock.ms);

/** The water's height over (x, z) at rules ms `ms`: the highest of the tide and the chamber there, -Infinity when dry. */
export function waterLevelAt(run: RuinRun, x: number, z: number, ms: number): number {
   let y = tideY(run, ms);
   const zones = run.course.zones;
   for (let i = 0; i < zones.length; i++) {
      const zn = zones[i];
      if (x < zn.minX || x > zn.maxX || z < zn.minZ || z > zn.maxZ) continue;
      const l = zoneLevel(run.water, i, ms);
      if (l > zn.floor + 0.02 && l > y) y = l;
   }
   return y;
}

/** One chamber's water: the body, the surface, a ripple ring on a lever change, and the target lines on its walls. */
function Chamber({ run, zi, clock, normal, lite, storm }: { run: RuinRun; zi: number; clock: VisualClock; normal: ReturnType<typeof rippleNormalTexture>; lite: boolean; storm: boolean }) {
   const z = run.course.zones[zi];
   const body = useRef<Mesh>(null);
   const surface = useRef<Mesh>(null);
   const ripple = useRef<Mesh>(null);
   const lines = useRef<Group>(null);
   const time = useGameTime();
   const memo = useRef({ target: Number.NaN, at: -9 });
   const w = z.maxX - z.minX;
   const d = z.maxZ - z.minZ;
   const cx = (z.minX + z.maxX) / 2;
   const cz = (z.minZ + z.maxZ) / 2;
   const surfaceMat = useMemo(() => waterSurfaceMaterial(normal, { lite, storm, edges: { w, d }, opacity: 0.74 }), [normal, lite, storm, w, d]);
   const bodyMat = useMemo(() => waterBodyMaterial(), []);
   useEffect(() => () => {
      surfaceMat.dispose();
      bodyMat.dispose();
   }, [surfaceMat, bodyMat]);
   const segs = lite ? 1 : Math.max(2, Math.min(24, Math.round(Math.max(w, d) / 1.2)));
   useFrame(() => {
      const ms = visMs(clock);
      const y = zoneLevel(run.water, zi, ms);
      const wet = y > z.floor + 0.02;
      const target = run.water.target[zi];
      if (memo.current.target !== target) {
         if (!Number.isNaN(memo.current.target)) memo.current.at = time.now;
         memo.current.target = target;
      }
      surfaceMat.uniforms.uTime.value = time.now;
      // deeper water reads darker
      surfaceMat.uniforms.uDepth.value = Math.max(0.25, Math.min(1, (y - z.floor) / 3.5));
      bodyMat.uniforms.uSurface.value = y;
      if (body.current) {
         body.current.visible = wet;
         body.current.position.y = (z.floor + y) / 2;
         body.current.scale.y = Math.max(0.01, y - z.floor);
      }
      if (surface.current) {
         surface.current.visible = wet;
         surface.current.position.y = y + 0.01;
      }
      const r = ripple.current;
      if (r) {
         const t = time.now - memo.current.at;
         r.visible = wet && t < 1.4;
         if (r.visible) {
            const k = t / 1.4;
            r.position.y = y + 0.03;
            r.scale.setScalar(0.3 + k * Math.max(w, d) * 0.5);
            (r.material as MeshBasicMaterial).opacity = 0.7 * (1 - k);
         }
      }
      const l = lines.current;
      if (l) {
         // the glowing line on the walls at the level the chamber is heading for (the card's lever readout)
         l.position.y = target + 0.02;
         l.visible = Math.abs(target - y) > 0.05 || time.now - memo.current.at < 3;
      }
   });
   return (
      <group>
         <mesh ref={body} position={[cx, z.floor, cz]} visible={false} material={bodyMat} renderOrder={2}>
            <boxGeometry args={[w - 0.02, 1, d - 0.02]} />
         </mesh>
         <mesh ref={surface} position={[cx, z.floor, cz]} rotation-x={-Math.PI / 2} visible={false} renderOrder={3} material={surfaceMat}>
            <planeGeometry args={[w, d, segs, segs]} />
         </mesh>
         <mesh ref={ripple} position={[cx, z.floor, cz]} rotation-x={-Math.PI / 2} visible={false} renderOrder={4}>
            <ringGeometry args={[0.85, 1, 40]} />
            <meshBasicMaterial color="#e0fbff" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
         </mesh>
         <group ref={lines} position={[0, z.floor, 0]}>
            {[z.minX + 0.03, z.maxX - 0.03].map((x, i) => (
               <mesh key={i} position={[x, 0, cz]}>
                  <boxGeometry args={[0.05, 0.06, d]} />
                  <meshBasicMaterial color="#5eead4" toneMapped={false} />
               </mesh>
            ))}
         </group>
      </group>
   );
}

/** Redraw the tide's foam mask when the tide has moved this far (m). */
const FOAM_STEP = 0.3;

/**
 * The storm tide: the same water under the whole ruin (it waits out of sight below until it starts),
 * foam where it meets a block, its body darker with depth. A heartbeat brightens the foam while it rises.
 */
function Tide({ run, clock, normal, lite, storm }: { run: RuinRun; clock: VisualClock; normal: ReturnType<typeof rippleNormalTexture>; lite: boolean; storm: boolean }) {
   const group = useRef<Group>(null);
   const time = useGameTime();
   const box = useMemo(() => {
      let x0 = Infinity;
      let x1 = -Infinity;
      let z0 = Infinity;
      let z1 = -Infinity;
      for (const s of run.course.supports) {
         x0 = Math.min(x0, s.cx - s.hw);
         x1 = Math.max(x1, s.cx + s.hw);
         z0 = Math.min(z0, s.cz - s.hd);
         z1 = Math.max(z1, s.cz + s.hd);
      }
      return { w: x1 - x0 + 60, d: z1 - z0 + 60, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, foam: { minX: x0 - 2, minZ: z0 - 2, sizeX: x1 - x0 + 4, sizeZ: z1 - z0 + 4 } as FoamBox };
   }, [run]);
   const mask = useMemo(() => foamMaskTexture(lite ? 512 : 1024), [lite]);
   const surfaceMat = useMemo(() => waterSurfaceMaterial(normal, { lite, storm, foamMap: mask.texture, foamBox: box.foam, opacity: 0.82 }), [normal, lite, storm, mask, box]);
   const bodyMat = useMemo(() => waterBodyMaterial(), []);
   useEffect(() => () => {
      surfaceMat.dispose();
      bodyMat.dispose();
      mask.texture.dispose();
   }, [surfaceMat, bodyMat, mask]);
   const drawnAt = useRef(Number.NaN);
   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const live = tideY(run, visMs(clock));
      // before it starts it waits far below, out of sight
      const y = Number.isFinite(live) ? live : run.course.tide.y0 - 4;
      g.position.y = y;
      surfaceMat.uniforms.uTime.value = time.now;
      bodyMat.uniforms.uSurface.value = y + 0.02;
      if (!(Math.abs(y - drawnAt.current) < FOAM_STEP)) {
         drawnAt.current = y;
         drawFoamMask(mask.ctx, box.foam, run.course.supports, y);
         mask.texture.needsUpdate = true;
      }
      // the rising tide's heartbeat: the foam swells a little on each beat
      const beat = Number.isFinite(live) ? Math.pow(Math.abs(Math.sin(time.now * 2.6)), 6) : 0;
      surfaceMat.uniforms.uOpacity.value = 0.82 + 0.06 * beat;
   });
   const segs = lite ? 1 : 64;
   return (
      <group ref={group} position={[box.cx, run.course.tide.y0, box.cz]}>
         <mesh position={[0, -6, 0]} material={bodyMat} renderOrder={2}>
            <boxGeometry args={[box.w, 12, box.d]} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} material={surfaceMat} renderOrder={3}>
            <planeGeometry args={[box.w, box.d, segs, segs]} />
         </mesh>
      </group>
   );
}

/** Bubbles rising round the hero while it swims (the water is see-through, so they show under it). */
function SwimBubbles({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const juice = useJuice();
   const emitter = useMemo(createJuiceEmitter, []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const time = useGameTime();
   useFrame(() => {
      const h = run.hero;
      if (!h.swim || h.state !== "play") return;
      const top = waterLevelAt(run, h.x, h.z, visMs(clock));
      if (!Number.isFinite(top)) return;
      // from the feet up to just under the surface, wobbling round the body
      const k = 0.5 + 0.5 * Math.sin(time.now * 7.3);
      at.x = h.x + Math.sin(time.now * 11.1) * 0.35;
      at.z = h.z + Math.cos(time.now * 9.7) * 0.35;
      at.y = Math.min(top - 0.12, h.y + 0.2 + k * 0.8);
      const moving = Math.hypot(h.vx, h.vz) > 0.5;
      juice.stream("aura", at, moving ? 26 : 12, emitter, { color: "#d9f7ff", vy: 0.9 });
   });
   return null;
}

/** A gentle teal shift of the picture while the camera is under the tide or a chamber's surface. */
function UnderwaterTint({ run, clock }: { run: RuinRun; clock: VisualClock }) {
   const camera = useThree((s) => s.camera);
   const mesh = useRef<Mesh>(null);
   const mat = useRef<ShaderMaterial>(null);
   const k = useRef(0);
   const color = useMemo(() => new Color(WATER.under), []);
   const uniforms = useMemo(() => ({ uColor: { value: color }, uAmount: { value: 0 }, uTime: { value: 0 } }), [color]);
   const time = useGameTime();
   useFrame((_s, delta) => {
      const top = waterLevelAt(run, camera.position.x, camera.position.z, visMs(clock));
      const under = Number.isFinite(top) && camera.position.y < top - 0.02;
      k.current += ((under ? 1 : 0) - k.current) * (1 - Math.exp(-6 * Math.min(0.1, delta)));
      uniforms.uAmount.value = k.current;
      uniforms.uTime.value = time.now;
      if (mesh.current) mesh.current.visible = k.current > 0.01;
   });
   return (
      <mesh ref={mesh} frustumCulled={false} renderOrder={1000} visible={false}>
         <planeGeometry args={[2, 2]} />
         <shaderMaterial
            ref={mat}
            uniforms={uniforms}
            transparent
            depthTest={false}
            depthWrite={false}
            vertexShader={/* glsl */ `
               varying vec2 vUv;
               void main() {
                  vUv = uv;
                  gl_Position = vec4(position.xy, 0.0, 1.0);
               }
            `}
            fragmentShader={/* glsl */ `
               uniform vec3 uColor;
               uniform float uAmount;
               uniform float uTime;
               varying vec2 vUv;
               void main() {
                  // lighter towards the surface above, a slow caustic shimmer
                  float shimmer = 0.04 * sin(vUv.x * 18.0 + uTime * 1.7) * sin(vUv.y * 13.0 - uTime * 1.3);
                  vec3 col = uColor * (0.75 + 0.5 * vUv.y) + shimmer;
                  gl_FragColor = vec4(col, uAmount * (0.38 + 0.12 * (1.0 - vUv.y)));
                  #include <colorspace_fragment>
               }
            `}
         />
      </mesh>
   );
}

export default function Water({ run, clock, storm }: { run: RuinRun; clock: VisualClock; storm: boolean }) {
   const { water } = useQuality();
   // phones (a coarse pointer: "reduced") and slow devices ("flat"): no swell, one ripple layer, a smaller foam mask
   const lite = water !== "full";
   const normal = useMemo(() => rippleNormalTexture(lite ? 64 : 128), [lite]);
   useEffect(() => () => normal.dispose(), [normal]);
   return (
      <>
         {run.course.zones.map((_, zi) => (
            <Chamber key={zi} run={run} zi={zi} clock={clock} normal={normal} lite={lite} storm={storm} />
         ))}
         <Tide run={run} clock={clock} normal={normal} lite={lite} storm={storm} />
         <SwimBubbles run={run} clock={clock} />
         <UnderwaterTint run={run} clock={clock} />
      </>
   );
}
