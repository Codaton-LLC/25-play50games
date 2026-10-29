"use client";

// Flipframe (level 5): a 3 x 3 giant of neon cubes (m2NeonCube, its blocks in sets A and B: a block of
// the hologram set shows as wire), its core (m2FlipframeCore) riding a sentry drone (m2NeonSentryDrone)
// in the middle. P1: it rears up on its tell and slams down (the stomp hits the set it locked, shown by
// the glyph over its head). P2: the core leaves the frame and hovers over the hologram cube it picked,
// dropping onto it while it is open. P3 Overdrive: the frame shudders and the core sits over the tower
// top. A hit flashes it; the defeat drops the blocks into the void and the core spins away.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, CORE_SCALE, CUBE_STRETCH, DRONE_SCALE } from "./assets";
import { COLORS } from "./look";
import { cubePos, type NeonRun } from "./rules";

const P = new Vector3();
const Q = new Quaternion();
const S = new Vector3();
const CP = { x: 0, z: 0 };
const TA = new Color(COLORS.a).lerp(new Color("#ffffff"), 0.3);
const TB = new Color(COLORS.b).lerp(new Color("#ffffff"), 0.3);
const DARK = new Color("#2e1065");
const X_AXIS = new Vector3(1, 0, 0);

/** The frame's lift (m) and shake for this boss step. */
function frameMotion(run: NeonRun, now: number): { lift: number; shake: number; fall: number } {
   const b = run.boss!;
   if (b.defeatMs >= 0) return { lift: 0, shake: 0, fall: b.defeatMs / 1000 };
   if (!run.bossAwake) return { lift: 0, shake: 0, fall: 0 };
   if (b.phase === 0 && b.step === "telegraph") return { lift: Math.min(1, b.stepMs / 700) * 1.6, shake: 0.03, fall: 0 };
   if (b.phase === 0 && b.step === "attack") return { lift: 1.6 * (1 - Math.min(1, b.stepMs / 150)), shake: 0.15, fall: 0 };
   if (b.phase === 2) return { lift: 0.4 + Math.sin(now * 3) * 0.2, shake: 0.06, fall: 0 };
   return { lift: Math.sin(now * 1.2) * 0.15, shake: 0, fall: 0 };
}

export function Flipframe({ run }: { run: NeonRun }) {
   const time = useGameTime();
   const core = useRef<Group>(null);
   const aura = useRef<Mesh>(null);
   const glyphA = useRef<Mesh>(null);
   const glyphB = useRef<Mesh>(null);
   const spec = run.course.boss;
   useFrame(() => {
      const b = run.boss;
      const g = core.current;
      if (!b || !spec || !g) return;
      const now = time.now;
      const m = frameMotion(run, now);
      // where the core is: in the frame, over the picked cube (P2), over the tower top (P3)
      let x = spec.x;
      let y = 3 + m.lift;
      let z = spec.z + 1.2;
      if (run.bossAwake && b.phase === 1 && run.coreCube >= 0 && b.step !== "transition") {
         const c = run.course.cubes[run.coreCube];
         cubePos(run, c, CP);
         x = CP.x;
         z = CP.z;
         y = c.top + (b.step === "vulnerable" ? 1.1 : 2.6) + Math.sin(now * 4) * 0.1;
      } else if (run.bossAwake && b.phase === 2) {
         const t = run.course.cubes[spec.towerTop];
         x = t.x;
         z = t.z;
         y = t.top + 1.6 + Math.sin(now * 4) * 0.1;
      }
      if (b.defeatMs >= 0) {
         y += m.fall * 3;
         g.rotation.y = now * 12;
         g.scale.setScalar(Math.max(0.01, 1 - m.fall / 2.4));
      } else {
         g.rotation.y = Math.sin(now * 0.8) * 0.3;
         g.scale.setScalar(1);
      }
      g.position.lerp(P.set(x, y, z), 0.15);
      g.visible = b.step !== "done";
      const a = aura.current;
      if (a) {
         a.visible = b.flashMs > 0 || b.step === "vulnerable";
         a.position.copy(g.position).y += 0.9;
         a.scale.setScalar(b.flashMs > 0 ? 1.8 : 1.3 + Math.sin(now * 6) * 0.06);
      }
      // P1: the set it will stomp, over its head (a square for A, a triangle for B)
      const show = run.bossAwake && b.phase === 0 && (b.step === "telegraph" || b.step === "attack");
      for (const [ref, set] of [[glyphA, "A"], [glyphB, "B"]] as const) {
         const gl = ref.current;
         if (!gl) continue;
         gl.visible = show && run.stompSet === set;
         gl.position.set(spec.x, 8.4 + m.lift, spec.z + 1);
      }
   });
   if (!spec || !run.boss) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.cube}
            count={9}
            name="flipframe-blocks"
            update={(i, mx: Matrix4, color?: Color) => {
               const b = run.boss!;
               if (b.step === "done") return false;
               const m = frameMotion(run, time.now);
               const col = (i % 3) - 1;
               const row = Math.floor(i / 3);
               // the middle block is the core's socket: empty
               if (i === 4) return false;
               const set = (i + run.level) % 2 === 0 ? "A" : "B";
               const sh = m.shake * Math.sin(time.now * 40 + i);
               const fallY = m.fall > 0 ? -m.fall * m.fall * (6 + i) : 0;
               P.set(spec.x + col * 2 + sh, row * 2 + m.lift + fallY, spec.z);
               Q.setFromAxisAngle(X_AXIS, m.fall * (i % 2 ? 1.5 : -1.2));
               S.set(CUBE_STRETCH[0], CUBE_STRETCH[1], CUBE_STRETCH[2]);
               mx.compose(P, Q, S);
               color?.copy(set === run.solid ? (set === "A" ? TA : TB) : DARK);
            }}
         />
         <group ref={core}>
            <Model asset={ASSETS.core} scale={CORE_SCALE} position={[0, 0, 0]} />
            <Model asset={ASSETS.drone} scale={DRONE_SCALE} position={[0, -0.75, 0]} tint="#c084fc" />
         </group>
         <mesh ref={aura} visible={false}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshBasicMaterial color="#f0abfc" transparent opacity={0.25} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={glyphA} visible={false} rotation-z={Math.PI / 4}>
            <circleGeometry args={[0.9, 4]} />
            <meshBasicMaterial color={COLORS.a} side={2} toneMapped={false} />
         </mesh>
         <mesh ref={glyphB} visible={false} rotation-z={Math.PI / 2}>
            <circleGeometry args={[1, 3]} />
            <meshBasicMaterial color={COLORS.b} side={2} toneMapped={false} />
         </mesh>
      </>
   );
}
