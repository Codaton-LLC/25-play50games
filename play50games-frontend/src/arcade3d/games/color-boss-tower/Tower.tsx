"use client";

// The tower: its stone wall (drawn from inside only, so a camera turned out past it sees through),
// the spiral of ledges (m2TowerLedgePlatform, one instanced pool with the skip ledges; level 3's
// crumble shakes and reddens, then the ledge drops away until it reforms), the claws on the wall
// (m2CoreClawHolder, each with its colour core: dim while dormant, blazing when charged, grey when
// spent), the prism cannons on the ledges' inner edges aimed at the shaft (m2PrismCannon), the hazard
// orbs rolling down the spiral (m2HazardOrb), the orbs, the secrets (a ghost panel, a cracked window,
// a high niche), the checkpoint beacons, the crown of dark spires (m2DarkTowerBg) and the shaft's glow.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Matrix4, Quaternion, RepeatWrapping, Vector3, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import { ASSETS, CANNON_R, CLAW_H, CLAW_R, LEDGE_R, LEDGE_SCALE, LEDGE_THICK, SKIP_SCALE } from "./assets";

export { CANNON_R, CLAW_R, LEDGE_R };
import { R_PATH, R_WALL } from "./levels";
import { CRUMBLE_MS, HORB_R, horbY, ledgeSolid, type CbtRun } from "./rules";
import { COLORS, LOOKS, TAG_HEX, type TowerLook } from "./look";

const UP = new Vector3(0, 1, 0);
const q = new Quaternion();
const p = new Vector3();
const sc = new Vector3();
const CRUMBLE_TINT = new Color("#fca5a5");

/** A point on a circle of radius r at arc angle th (x = sin, z = cos), height y. */
export function ringPoint(th: number, r: number, y: number, out: { x: number; y: number; z: number }) {
   out.x = Math.sin(th) * r;
   out.y = y;
   out.z = Math.cos(th) * r;
   return out;
}


function Ledges({ run }: { run: CbtRun }) {
   const t = run.tower;
   const time = useGameTime();
   const n = t.la.length;
   const update = useMemo(
      () => (i: number, m: Matrix4, color: Color) => {
         if (i < n) {
            if (!ledgeSolid(run, i)) return false;
            const th = t.la[i] / R_PATH;
            let y = t.ly[i] - LEDGE_THICK;
            const touched = run.ledgeTouched[i];
            if (t.spec.crumbling && touched !== Infinity && run.simMs - touched < CRUMBLE_MS) {
               const k = (run.simMs - touched) / CRUMBLE_MS;
               y += Math.sin(time.now * 60 + i) * 0.04 * k;
               color.lerp(CRUMBLE_TINT, k);
            }
            ringPoint(th, LEDGE_R, y, p);
            q.setFromAxisAngle(UP, th);
            sc.set(LEDGE_SCALE.x, LEDGE_SCALE.y, LEDGE_SCALE.z);
            m.compose(p, q, sc);
            return true;
         }
         const k = i - n;
         const th = t.skipA[k] / R_PATH;
         ringPoint(th, R_WALL - 0.8, t.skipY[k] - 0.4, p);
         q.setFromAxisAngle(UP, th);
         sc.set(SKIP_SCALE.x, SKIP_SCALE.y, SKIP_SCALE.z);
         m.compose(p, q, sc);
         return true;
      },
      [run, t, n, time],
   );
   return <DynamicInstancedModel asset={ASSETS.ledge} count={n + t.skipA.length} update={update} />;
}

function HazardOrbs({ run }: { run: CbtRun }) {
   const pool = 6;
   const update = useMemo(
      () => (i: number, m: Matrix4) => {
         let k = -1;
         for (let j = 0, seen = 0; j < run.horbs.length; j++) {
            if (!run.horbs[j].alive) continue;
            if (seen === i) {
               k = j;
               break;
            }
            seen += 1;
         }
         if (k < 0) return false;
         const o = run.horbs[k];
         const th = o.s / R_PATH;
         ringPoint(th, R_PATH, horbY(o.s), p);
         // it rolls down the spiral: about the radial axis, backwards with its travel
         q.setFromAxisAngle(sc.set(Math.sin(th), 0, Math.cos(th)), -o.s / HORB_R);
         m.compose(p, q, sc.set(1, 1, 1));
         return true;
      },
      [run],
   );
   if (!run.tower.spec.hazardOrbs) return null;
   return <DynamicInstancedModel asset={ASSETS.horb} count={pool} update={update} />;
}

/** One claw: the holder on the wall and its colour core. */
function Claw({ run, index }: { run: CbtRun; index: number }) {
   const cl = run.claws[index];
   const core = useRef<Mesh>(null);
   const time = useGameTime();
   const th = cl.a / R_PATH;
   const pos = ringPoint(th, CLAW_R, cl.y - CLAW_H, { x: 0, y: 0, z: 0 });
   const hex = TAG_HEX[cl.colour];
   useFrame(() => {
      const c = core.current;
      if (!c) return;
      const mat = c.material as MeshStandardMaterial;
      const state = cl.chargedAt;
      if (state === -2) {
         mat.color.set("#6b7280");
         mat.emissiveIntensity = 0.05;
         c.scale.setScalar(0.8);
      } else if (state >= 0) {
         mat.color.set(hex);
         mat.emissiveIntensity = 2.2 + Math.sin(time.now * 10) * 0.6;
         c.scale.setScalar(1.15);
      } else {
         mat.color.set(hex);
         mat.emissiveIntensity = 0.45 + Math.sin(time.now * 2.5 + index) * 0.2;
         c.scale.setScalar(1);
      }
   }, FRAME_PRIORITY.visuals);
   return (
      <group position={[pos.x, pos.y, pos.z]} rotation-y={th + Math.PI}>
         <Model asset={ASSETS.claw} />
         {/* the colour core on top of the holder, and a ring of its colour round the base */}
         <mesh ref={core} position={[0, CLAW_H + 0.4, 0]}>
            <icosahedronGeometry args={[0.42, 1]} />
            <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.5} roughness={0.25} toneMapped={false} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.04, 0]}>
            <ringGeometry args={[0.62, 0.82, 28]} />
            <meshBasicMaterial color={hex} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** One prism cannon on the claw's ledge, aimed into the shaft; it glows its colour while charged. */
function Cannon({ run, index }: { run: CbtRun; index: number }) {
   const cl = run.claws[index];
   const t = run.tower;
   const glow = useRef<Mesh>(null);
   const th = (cl.a + 1.4) / R_PATH;
   const pos = ringPoint(th, CANNON_R, t.ly[cl.ledge], { x: 0, y: 0, z: 0 });
   const hex = TAG_HEX[cl.colour];
   useFrame(() => {
      const g = glow.current;
      if (!g) return;
      const on = cl.chargedAt >= 0;
      g.visible = on;
   }, FRAME_PRIORITY.visuals);
   return (
      <group position={[pos.x, pos.y, pos.z]} rotation-y={th + Math.PI}>
         <Model asset={ASSETS.cannon} />
         <mesh ref={glow} position={[0, 0.85, 0.7]}>
            <sphereGeometry args={[0.28, 14, 10]} />
            <meshBasicMaterial color={hex} toneMapped={false} />
         </mesh>
      </group>
   );
}

/** Where cannon `c` fires from (for the Scene's beam). */
export function cannonMuzzle(run: CbtRun, c: number, out: { x: number; y: number; z: number }) {
   const cl = run.claws[c];
   const th = (cl.a + 1.4) / R_PATH;
   return ringPoint(th, CANNON_R - 0.9, run.tower.ly[cl.ledge] + 0.85, out);
}

function Orbs({ run }: { run: CbtRun }) {
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      run.tower.orbs.forEach((o, k) => {
         const g = refs.current[k];
         if (!g) return;
         g.visible = !run.orbTaken[k];
         g.rotation.y = time.now * 1.6 + k;
         g.position.y = o.y + 0.15 + Math.sin(time.now * 2.4 + k) * 0.12;
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         {run.tower.orbs.map((o, k) => {
            const pt = ringPoint(o.a / R_PATH, R_PATH, o.y, { x: 0, y: 0, z: 0 });
            return (
               <group
                  key={k}
                  ref={(g) => {
                     refs.current[k] = g;
                  }}
                  position={[pt.x, pt.y, pt.z]}
               >
                  <Model asset={ASSETS.orb} />
               </group>
            );
         })}
      </>
   );
}

function Secrets({ run }: { run: CbtRun }) {
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      run.tower.secrets.forEach((_, k) => {
         const g = refs.current[k];
         if (g) {
            g.visible = !run.secrets.found[k];
            g.rotation.y = time.now * 2;
         }
      });
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         {run.tower.secrets.map((s, k) => {
            const th = s.a / R_PATH;
            const at = ringPoint(th, R_PATH + 0.6, s.y, { x: 0, y: 0, z: 0 });
            const wall = ringPoint(th, R_WALL - 0.12, s.y, { x: 0, y: 0, z: 0 });
            const color = s.kind === "crackedWindow" ? COLORS.shard : COLORS.sticker;
            return (
               <group key={k}>
                  {s.kind === "ghostNiche" ? (
                     <mesh position={[wall.x, wall.y, wall.z]} rotation-y={th}>
                        <planeGeometry args={[1.6, 2]} />
                        <meshStandardMaterial color={TAG_HEX.purple} emissive={TAG_HEX.purple} emissiveIntensity={0.6} transparent opacity={0.45} side={BackSide} depthWrite={false} />
                     </mesh>
                  ) : null}
                  {s.kind === "crackedWindow" ? (
                     <mesh position={[wall.x, wall.y, wall.z]} rotation-y={th}>
                        <planeGeometry args={[1.4, 1.8]} />
                        <meshStandardMaterial color="#bfdbfe" emissive="#93c5fd" emissiveIntensity={0.35} transparent opacity={0.6} side={BackSide} />
                     </mesh>
                  ) : null}
                  <group
                     ref={(g) => {
                        refs.current[k] = g;
                     }}
                     position={[at.x, at.y, at.z]}
                  >
                     <mesh>
                        <octahedronGeometry args={[0.28, 0]} />
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} toneMapped={false} />
                     </mesh>
                  </group>
               </group>
            );
         })}
      </>
   );
}

/** The wall's stone courses with glowing cracks (one canvas, repeated round and up the tower). */
function drawWall(look: TowerLook) {
   return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = look.wall;
      ctx.fillRect(0, 0, w, h);
      const rows = 8;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
         const off = (r % 2) * 0.5;
         for (let c = -1; c < 5; c++) {
            const x = (c + off) * (w / 4);
            const shade = 0.82 + (((r * 7 + c * 13) % 9) / 9) * 0.3;
            ctx.fillStyle = `rgba(0,0,0,${(1 - shade) * 0.9 + 0.04})`;
            ctx.fillRect(x + 3, r * rh + 3, w / 4 - 6, rh - 6);
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.fillRect(x + 3, r * rh + 3, w / 4 - 6, 4);
         }
         ctx.fillStyle = "rgba(0,0,0,0.45)";
         ctx.fillRect(0, r * rh, w, 3);
      }
      // glowing cracks
      ctx.strokeStyle = look.crackGlow;
      ctx.globalAlpha = 0.35 + look.crack * 0.6;
      ctx.lineWidth = 3;
      ctx.shadowColor = look.crackGlow;
      ctx.shadowBlur = 10;
      const n = Math.round(2 + look.crack * 5);
      for (let k = 0; k < n; k++) {
         let x = ((k * 0.37 + 0.11) % 1) * w;
         let y = ((k * 0.61 + 0.2) % 1) * h;
         ctx.beginPath();
         ctx.moveTo(x, y);
         for (let s2 = 0; s2 < 6; s2++) {
            x += Math.sin(k * 3 + s2 * 1.7) * 26;
            y += 28 + (s2 % 3) * 8;
            ctx.lineTo(x, y);
         }
         ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
   };
}

export function Tower({ run }: { run: CbtRun }) {
   const spec = run.tower.spec;
   const look = LOOKS[spec.id];
   const top = run.tower.topY;
   const wallH = top + 10;
   const draw = useMemo(() => drawWall(look), [look]);
   const wallTex = useCanvasTexture(512, 512, draw);
   useMemo(() => {
      wallTex.wrapS = wallTex.wrapT = RepeatWrapping;
      wallTex.repeat.set(10, wallH / 5);
      wallTex.needsUpdate = true;
   }, [wallTex, wallH]);
   const spires = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 8; i++) {
         const th = (i / 8) * Math.PI * 2 + 0.2;
         out.push({ x: Math.sin(th) * (R_WALL + 0.8), y: wallH - 3.5, z: Math.cos(th) * (R_WALL + 0.8), rotY: th + Math.PI, scale: 0.6 + (i % 3) * 0.2 });
      }
      return out;
   }, [wallH]);
   const beacons = spec.checkpoints.filter((c) => c > 0);
   const time = useGameTime();
   const shaft = useRef<Mesh>(null);
   useFrame(() => {
      const s = shaft.current;
      if (s) (s.material as MeshStandardMaterial).emissiveIntensity = 1.1 + Math.sin(time.now * 1.7) * 0.25;
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         <hemisphereLight args={["#c7d2fe", look.background, 0.55]} />
         <pointLight position={[0, 1.5, 0]} color={look.shaftGlow} intensity={60} distance={40} decay={1.6} />
         <pointLight position={[0, top * 0.6, 0]} color={look.shaftGlow} intensity={40} distance={36} decay={1.6} />
         {/* the wall, inner face only */}
         <mesh position={[0, wallH / 2 - 2, 0]}>
            <cylinderGeometry args={[R_WALL, R_WALL, wallH, 64, 1, true]} />
            <meshStandardMaterial map={wallTex} roughness={0.92} side={BackSide} />
         </mesh>
         {/* the floor ring and the glowing shaft at the heart */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
            <ringGeometry args={[3.4, R_WALL, 64]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.95} />
         </mesh>
         <mesh ref={shaft} rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}>
            <circleGeometry args={[3.4, 48]} />
            <meshStandardMaterial color={COLORS.shaft} emissive={look.shaftGlow} emissiveIntensity={1.2} toneMapped={false} />
         </mesh>
         {/* the open top: the sky disc */}
         <mesh rotation-x={Math.PI / 2} position={[0, wallH + 6, 0]}>
            <circleGeometry args={[R_WALL + 6, 48]} />
            <meshBasicMaterial color={look.sky} transparent opacity={0.55} side={BackSide} />
         </mesh>
         <InstancedModel asset={ASSETS.spire} spots={spires} fallback={null} />
         <Ledges run={run} />
         <HazardOrbs run={run} />
         {run.claws.map((_, i) => (
            <Claw key={`c${i}`} run={run} index={i} />
         ))}
         {run.claws.map((_, i) => (
            <Cannon key={`k${i}`} run={run} index={i} />
         ))}
         <Orbs run={run} />
         <Secrets run={run} />
         {beacons.map((c) => {
            const pt = ringPoint(run.tower.la[c] / R_PATH, R_WALL - 0.7, run.tower.ly[c], { x: 0, y: 0, z: 0 });
            return (
               <group key={c} position={[pt.x, pt.y, pt.z]}>
                  <Model asset={ASSETS.beacon} />
               </group>
            );
         })}
      </>
   );
}
