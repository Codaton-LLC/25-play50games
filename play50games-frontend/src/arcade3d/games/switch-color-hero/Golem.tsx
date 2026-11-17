"use client";

// Chroma (level 5): ice-peak-jumper's crystal golem, recoloured every frame to the colour he will throw
// (the per-copy tint of DynamicInstancedModel), running ahead down the arena. He glows and his core
// pulses while he is open; he flashes white on a hit and winds up (leans back) in the telegraph. Visual
// only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Matrix4, Quaternion, Vector3, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { PALETTE } from "./track";
import type { SwitchRun } from "./rules";

const HEIGHT = 4.6;
const P = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const E = new Euler();
const WHITE = new Color("#ffffff");

export default function Golem({ run }: { run: SwitchRun }) {
   const time = useGameTime();
   const core = useRef<Mesh>(null);
   const tint = useMemo(() => new Color(), []);
   const update = useMemo(
      () => (_i: number, m: Matrix4, c: Color) => {
         const b = run.boss;
         const g = run.golem;
         if (!b || !g.visible || !run.inArena) return false;
         const lean = b.step === "telegraph" ? -0.25 : b.step === "attack" ? 0.2 : 0;
         E.set(lean, 0, Math.sin(time.now * 6) * 0.05);
         Q.setFromEuler(E);
         P.set(Math.sin(time.now * 0.9) * 1.2, 0.3 + Math.abs(Math.sin(time.now * 5)) * 0.25, g.z);
         const s = fit(GLB_SIZE.chroma.y, HEIGHT);
         S.set(s, s, s);
         m.compose(P, Q, S);
         tint.set(PALETTE[g.color].hex);
         if (b.flashMs > 0) tint.lerp(WHITE, 0.7);
         c.copy(tint);
      },
      [run, time, tint],
   );
   useFrame(() => {
      const m = core.current;
      const b = run.boss;
      if (!m || !b) return;
      m.visible = run.inArena && run.golem.visible;
      m.position.set(Math.sin(time.now * 0.9) * 1.2, HEIGHT * 0.55, run.golem.z - 0.6);
      const open = b.step === "vulnerable";
      const mat = m.material as MeshBasicMaterial;
      mat.color.set(PALETTE[run.golem.color].hex);
      mat.opacity = open ? 0.6 + 0.35 * Math.sin(time.now * 10) : 0.25;
      m.scale.setScalar(open ? 1.25 : 0.9);
   });
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.chroma} count={1} update={update} tinted />
         <mesh ref={core} visible={false}>
            <sphereGeometry args={[0.8, 20, 14]} />
            <meshBasicMaterial transparent opacity={0.4} toneMapped={false} depthWrite={false} />
         </mesh>
      </>
   );
}
