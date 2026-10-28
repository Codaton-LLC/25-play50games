"use client";

// The wave, drawn from the rules (waveLook.ts has the shaders): the open sea, the wave's face (one
// opaque deformed plane that travels with the rider, its height the rules' profile, whitewater behind
// the curl), the curl's pitching lip at the rules' curl front (level 5's barrel throws it over the
// rider), the sky dome, and a white spray stream off the curl. The colour comes back from chalk grey
// as the orbs are taken (look.ts restoreAmount). Phones ("flat" water quality) get the same wave with a
// smaller swell and one ripple layer.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Mesh } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality } from "@/arcade3d/core/quality";
import { createJuiceEmitter, useJuice } from "@/arcade3d/menu2/juice";
import { FACE_W } from "./waves";
import { LOOKS, restoreAmount } from "./look";
import { bossAlive, type SurfRun } from "./rules";
import { CURL_LEN, WAVE_X0, WAVE_X1, curlMaterial, rippleNormalTexture, seaMaterial, skyMaterial, waveMaterial } from "./waveLook";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

/** The wave mesh's reach along the ride round the rider: far ahead, a little behind (m). */
export const WAVE_AHEAD = 190;
export const WAVE_BEHIND = 70;

/** Level 5's barrel (phase 3): the lip is thrown over the rider from this far ahead of them (visual only). */
export const BARREL_AHEAD = 14;

export function Wave({ run, clock, view }: { run: SurfRun; clock: VisualClock; view?: { z: number } }) {
   const time = useGameTime();
   const quality = useQuality();
   const lite = quality.water === "flat";
   const look = LOOKS[run.level];
   const camera = useThree((s) => s.camera);
   const normal = useMemo(() => rippleNormalTexture(lite ? 64 : 128), [lite]);
   const wave = useMemo(() => waveMaterial(normal, { look, H: run.course.H, lite }), [normal, look, run.course.H, lite]);
   const curl = useMemo(() => curlMaterial(normal, { look, H: run.course.H, lite }), [normal, look, run.course.H, lite]);
   const sea = useMemo(() => seaMaterial(normal, look), [normal, look]);
   const sky = useMemo(() => skyMaterial(look), [look]);
   useEffect(
      () => () => {
         wave.dispose();
         curl.dispose();
         sea.dispose();
         sky.dispose();
         normal.dispose();
      },
      [wave, curl, sea, sky, normal],
   );
   const waveMesh = useRef<Mesh>(null);
   const curlMesh = useRef<Mesh>(null);
   const seaMesh = useRef<Mesh>(null);
   const skyMesh = useRef<Mesh>(null);
   const restore = useRef(restoreAmount(0, run.course.mainOrbs));
   const barrel = useRef(0);
   const juice = useJuice();
   const spray = useMemo(createJuiceEmitter, []);
   const lipSpray = useMemo(createJuiceEmitter, []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const xSegs = lite ? 30 : 48;
   const zSegs = lite ? 120 : 200;

   useFrame((_s, delta) => {
      const h = run.hero;
      const z = view ? view.z : h.z;
      const t = time.now;
      const dt = Math.min(0.1, delta);
      // the colour returns with the orbs
      const want = restoreAmount(run.mainOrbs, run.course.mainOrbs);
      restore.current += (want - restore.current) * (1 - Math.exp(-2 * dt));
      // level 5's last phase: the barrel
      const b = run.boss;
      const inBarrel = !!b && run.bossOn && b.phase === 2 && bossAlive(run) ? 1 : 0;
      barrel.current += (inBarrel - barrel.current) * (1 - Math.exp(-1.5 * dt));
      const anchor = Math.round(z / 4) * 4;
      if (waveMesh.current) waveMesh.current.position.z = anchor + (WAVE_BEHIND - WAVE_AHEAD) / 2;
      const u = wave.uniforms;
      u.uTime.value = t;
      u.uCurlZ.value = run.curlZ;
      u.uHeroZ.value = h.z;
      u.uRestore.value = restore.current;
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      u.uBand.value = h.grounded && h.pumpArmed ? 0.75 + 0.25 * pulse : 0.32;
      const cu = curl.uniforms;
      cu.uTime.value = t;
      // the barrel throws the lip over the rider (visual only: the rules' curl stays behind)
      cu.uCurlZ.value = barrel.current > 0.01 ? Math.min(run.curlZ, run.curlZ + (h.z - BARREL_AHEAD - run.curlZ) * barrel.current) : run.curlZ;
      cu.uBarrel.value = barrel.current;
      cu.uRestore.value = restore.current;
      sea.uniforms.uTime.value = t;
      sea.uniforms.uRestore.value = restore.current;
      if (seaMesh.current) seaMesh.current.position.set(Math.round(camera.position.x / 8) * 8, -0.04, Math.round(camera.position.z / 8) * 8);
      if (skyMesh.current) skyMesh.current.position.copy(camera.position);
      // spray off the curl's lip, and the whitewater's mist
      at.x = FACE_W - 2.5 + Math.sin(t * 7.1) * 1.5;
      at.y = run.course.H + 0.6;
      at.z = run.curlZ + 2;
      juice.stream("dust", at, lite ? 14 : 30, spray, { color: "#ffffff", vy: 2.5, vx: -2 });
      at.x = 3 + Math.sin(t * 5.3) * 2.5;
      at.y = 1.2;
      at.z = run.curlZ + 6;
      juice.stream("dust", at, lite ? 8 : 16, lipSpray, { color: "#f8fdff", vy: 1.5 });
   });

   const len = WAVE_AHEAD + WAVE_BEHIND;
   return (
      <group>
         <mesh ref={skyMesh} material={sky} renderOrder={-10} frustumCulled={false}>
            <sphereGeometry args={[400, 24, 12]} />
         </mesh>
         <mesh ref={seaMesh} rotation-x={-Math.PI / 2} material={sea}>
            <planeGeometry args={[900, 900, 1, 1]} />
         </mesh>
         <mesh ref={waveMesh} rotation-x={-Math.PI / 2} position={[(WAVE_X0 + WAVE_X1) / 2, 0, 0]} material={wave} frustumCulled={false}>
            <planeGeometry args={[WAVE_X1 - WAVE_X0, len, xSegs, zSegs]} />
         </mesh>
         <mesh ref={curlMesh} material={curl} frustumCulled={false}>
            <planeGeometry args={[1, 1, lite ? 16 : 28, lite ? 14 : 24]} />
         </mesh>
      </group>
   );
}

export { CURL_LEN };
