"use client";

// Stadium, goal, and the stand-ins of the ball and the two footballers, drawn while their GLBs are
// missing or broken; the footballers stand on y = 0. The goal opening is x = -3.66..3.66, y = 0..2.44
// on the plane z = 0, with the frame outside it and the net back to z = -1.5.
import { useEffect, useMemo, type ReactNode } from "react";
import { BufferGeometry, Float32BufferAttribute, type Texture } from "three";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { BALL_RADIUS } from "./assets";
import { Decor } from "./Decor";
import { COLORS } from "./looks";
import { Terrain } from "./Terrain";

export { COLORS };

export const GOAL = { halfWidth: 3.66, height: 2.44, depth: 1.5, post: 0.06 } as const;

// ---------- goal and net ----------

type P3 = [number, number, number];

/** Lines across a four-cornered face (a-b-c-d in order), nu across and nv up. */
function pushQuadGrid(out: number[], a: P3, b: P3, c: P3, d: P3, nu: number, nv: number) {
   const lerp = (p: P3, q: P3, t: number): P3 => [
      p[0] + (q[0] - p[0]) * t,
      p[1] + (q[1] - p[1]) * t,
      p[2] + (q[2] - p[2]) * t,
   ];
   for (let i = 0; i <= nu; i++) {
      const t = i / nu;
      out.push(...lerp(a, b, t), ...lerp(d, c, t));
   }
   for (let j = 0; j <= nv; j++) {
      const t = j / nv;
      out.push(...lerp(a, d, t), ...lerp(b, c, t));
   }
}

function useNetGeometry(): BufferGeometry {
   const geometry = useMemo(() => {
      const x = GOAL.halfWidth + GOAL.post;
      const top = GOAL.height + GOAL.post;
      const back = -GOAL.depth;
      const backTop = top - 0.5;
      const lines: number[] = [];
      pushQuadGrid(lines, [-x, 0, back], [x, 0, back], [x, backTop, back], [-x, backTop, back], 36, 11);
      pushQuadGrid(lines, [-x, top, 0], [x, top, 0], [x, backTop, back], [-x, backTop, back], 36, 7);
      for (const side of [-1, 1]) {
         pushQuadGrid(lines, [side * x, 0, 0], [side * x, 0, back], [side * x, backTop, back], [side * x, top, 0], 7, 12);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(lines, 3));
      return g;
   }, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return geometry;
}

/**
 * Modern tournament goal: crisp white round posts, bevelled corner joints,
 * rear net support stanchions, and clean ground frame anchors.
 */
export function Goal() {
   const net = useNetGeometry();
   const x = GOAL.halfWidth + GOAL.post;
   const top = GOAL.height + GOAL.post;
   const r = GOAL.post;
   const stanchionRadius = 0.035;

   return (
      <group name="goal">
         {/* Vertical upright posts */}
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * x, top / 2, 0]}>
               <cylinderGeometry args={[r, r, top, 16]} />
               <meshStandardMaterial color={COLORS.frame} roughness={0.25} />
            </mesh>
         ))}

         {/* Ground anchor sockets at post bases */}
         {[-1, 1].map((side) => (
            <mesh key={`socket-${side}`} position={[side * x, 0.05, 0]}>
               <cylinderGeometry args={[r * 1.25, r * 1.35, 0.1, 16]} />
               <meshStandardMaterial color={COLORS.frameAnchor} roughness={0.6} metalness={0.4} />
            </mesh>
         ))}

         {/* Horizontal crossbar */}
         <mesh position={[0, top, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[r, r, 2 * x, 16]} />
            <meshStandardMaterial color={COLORS.frame} roughness={0.25} />
         </mesh>

         {/* Rounded elbow corner joints */}
         {[-1, 1].map((side) => (
            <mesh key={`corner-${side}`} position={[side * x, top, 0]}>
               <sphereGeometry args={[r, 16, 12]} />
               <meshStandardMaterial color={COLORS.frameJoint} roughness={0.25} />
            </mesh>
         ))}

         {/* Angled rear stanchion struts supporting the net */}
         {[-1, 1].map((side) => (
            <mesh
               key={`strut-${side}`}
               position={[side * x, top / 2, -GOAL.depth / 2]}
               rotation-x={Math.atan2(GOAL.depth, top)}
            >
               <cylinderGeometry args={[stanchionRadius, stanchionRadius, Math.hypot(GOAL.depth, top), 8]} />
               <meshStandardMaterial color={COLORS.frameSupport} roughness={0.5} metalness={0.5} />
            </mesh>
         ))}

         {/* Ground net border bars */}
         <mesh position={[0, 0.02, -GOAL.depth]}>
            <boxGeometry args={[2 * x, 0.04, 0.04]} />
            <meshStandardMaterial color={COLORS.frameSupport} roughness={0.6} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={`side-bar-${side}`} position={[side * x, 0.02, -GOAL.depth / 2]}>
               <boxGeometry args={[0.04, 0.04, GOAL.depth]} />
               <meshStandardMaterial color={COLORS.frameSupport} roughness={0.6} />
            </mesh>
         ))}

         {/* Goal net mesh */}
         <lineSegments geometry={net}>
            <lineBasicMaterial color={COLORS.net} transparent opacity={0.4} depthWrite={false} />
         </lineSegments>
      </group>
   );
}

// ---------- stadium composite wrapper ----------

export function Stadium() {
   return (
      <group name="stadium">
         <Terrain />
         <Decor />
      </group>
   );
}

// ---------- ball ----------

/** The football's texture: white, with nine black pentagons (ball.test.ts draws it on a recording context). */
export function drawBall(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#f8fafc";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "#111827";
   const spots: Array<[number, number]> = [
      [0.1, 0.5], [0.3, 0.2], [0.3, 0.8], [0.5, 0.5], [0.7, 0.2], [0.7, 0.8], [0.9, 0.5], [0.5, 0.02], [0.5, 0.98],
   ];
   for (const [u, v] of spots) {
      ctx.beginPath();
      const cx = u * w;
      const cy = v * h;
      for (let k = 0; k < 5; k++) {
         const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
         const px = cx + Math.cos(a) * w * 0.055;
         const py = cy + Math.sin(a) * h * 0.11;
         if (k === 0) ctx.moveTo(px, py);
         else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
   }
}

/** The stand-in ball's mesh: radius BALL_RADIUS, centred on the group origin. Hook-free (ball.test.ts reads its sphere). */
export function BallMesh({ map }: { map: Texture | null }) {
   return (
      <mesh name="ball">
         <sphereGeometry args={[BALL_RADIUS, 20, 14]} />
         <meshStandardMaterial map={map} roughness={0.5} />
      </mesh>
   );
}

/** The football Scene.tsx draws in the ball's spin group: BallMesh with black panels painted on a canvas. */
export function BallPrimitive() {
   const map = useCanvasTexture(256, 128, drawBall);
   return <BallMesh map={map} />;
}

// ---------- footballers ----------

interface Kit {
   shirt: string;
   shorts: string;
   socks: string;
   boots: string;
   hands: string;
   handSize: number;
   armSpread: number;
}

/** About 1.75 tall on y = 0, facing +z. */
function Footballer({ kit, children }: { kit: Kit; children?: ReactNode }) {
   return (
      <group>
         {[-1, 1].map((side) => (
            <group key={side}>
               <mesh position={[side * 0.11, 0.05, 0.04]}>
                  <boxGeometry args={[0.12, 0.1, 0.27]} />
                  <meshStandardMaterial color={kit.boots} roughness={0.5} />
               </mesh>
               <mesh position={[side * 0.11, 0.43, 0]}>
                  <capsuleGeometry args={[0.075, 0.56, 4, 10]} />
                  <meshStandardMaterial color={kit.socks} />
               </mesh>
               <mesh position={[side * 0.33, 1.2, 0]} rotation-z={side * kit.armSpread}>
                  <capsuleGeometry args={[0.062, 0.44, 4, 10]} />
                  <meshStandardMaterial color={kit.shirt} />
               </mesh>
               <mesh position={[side * (0.33 + Math.sin(kit.armSpread) * 0.3), 1.2 - Math.cos(kit.armSpread) * 0.3, 0]}>
                  <sphereGeometry args={[kit.handSize, 12, 10]} />
                  <meshStandardMaterial color={kit.hands} />
               </mesh>
            </group>
         ))}
         <mesh position={[0, 0.84, 0]}>
            <boxGeometry args={[0.42, 0.24, 0.27]} />
            <meshStandardMaterial color={kit.shorts} />
         </mesh>
         <mesh position={[0, 1.2, 0]} scale={[1.12, 1, 0.75]}>
            <capsuleGeometry args={[0.2, 0.3, 6, 14]} />
            <meshStandardMaterial color={kit.shirt} />
         </mesh>
         <mesh position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.135, 18, 14]} />
            <meshStandardMaterial color={COLORS.skin} />
         </mesh>
         <mesh position={[0, 1.66, -0.02]} scale={[1.05, 0.75, 1.05]}>
            <sphereGeometry args={[0.135, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.hair} />
         </mesh>
         {children}
      </group>
   );
}

const STRIKER_KIT: Kit = {
   shirt: COLORS.strikerKit,
   shorts: COLORS.strikerShorts,
   socks: COLORS.strikerSocks,
   boots: COLORS.strikerBoots,
   hands: COLORS.skin,
   handSize: 0.055,
   armSpread: 0.18,
};

const KEEPER_KIT: Kit = {
   shirt: COLORS.keeperKit,
   shorts: COLORS.keeperShorts,
   socks: COLORS.keeperSocks,
   boots: COLORS.keeperBoots,
   hands: COLORS.gloves,
   handSize: 0.1,
   armSpread: 0.95,
};

function drawNumber(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   ctx.fillStyle = "#f8fafc";
   ctx.font = `900 ${Math.round(h * 0.86)}px system-ui, sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText("10", w / 2, h * 0.54);
}

/** 1.75 tall on y = 0, facing -z (towards the goal). The camera sees the number 10 on the back. */
export function StrikerPrimitive() {
   const number = useCanvasTexture(128, 128, drawNumber);
   return (
      <group name="striker-primitive" rotation-y={Math.PI}>
         <Footballer kit={STRIKER_KIT}>
            <mesh position={[0, 1.24, -0.172]} rotation-y={Math.PI}>
               <planeGeometry args={[0.26, 0.26]} />
               <meshBasicMaterial map={number} transparent depthWrite={false} />
            </mesh>
         </Footballer>
      </group>
   );
}

/** 1.85 tall on y = 0, facing +z (towards the striker), arms out and gloves up. */
export function KeeperPrimitive() {
   return (
      <group name="keeper-primitive" scale={1.85 / 1.75}>
         <Footballer kit={KEEPER_KIT}>
            {[-1, 1].map((side) => (
               <mesh key={side} position={[side * 0.05, 1.62, 0.125]}>
                  <sphereGeometry args={[0.022, 8, 6]} />
                  <meshBasicMaterial color={COLORS.eye} />
               </mesh>
            ))}
         </Footballer>
      </group>
   );
}
