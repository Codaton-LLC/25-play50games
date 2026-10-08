"use client";

// Stadium, goal, and the stand-ins of the ball and the two footballers, drawn while their GLBs are
// missing or broken; the footballers stand on y = 0. The goal opening is x = -3.66..3.66, y = 0..2.44
// on the plane z = 0, with the frame outside it and the net back to z = -1.5.
import { useEffect, useMemo, type ReactNode } from "react";
import { BufferGeometry, Float32BufferAttribute, type Texture } from "three";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { BALL_RADIUS } from "./assets";

export const COLORS = {
   sky: "#0b1226",
   grass: "#1f7a3a",
   grassLight: "#24894a",
   line: "#e2f3e8",
   stand: "#1e293b",
   standEdge: "#334155",
   board: "#0f172a",
   boardText: "#2b3a52",
   boardTextAlt: "#334460",
   frame: "#f8fafc",
   net: "#e2e8f0",
   skin: "#e8b48f",
   hair: "#3f2a1d",
   strikerKit: "#2563eb",
   strikerShorts: "#1e3a8a",
   strikerSocks: "#1d4ed8",
   strikerBoots: "#f8fafc",
   keeperKit: "#16a34a",
   keeperShorts: "#14532d",
   keeperSocks: "#15803d",
   keeperBoots: "#0f172a",
   gloves: "#facc15",
   eye: "#0f172a",
} as const;

export const GOAL = { halfWidth: 3.66, height: 2.44, depth: 1.5, post: 0.06 } as const;

// ---------- pitch and stadium ----------

const PITCH_W = 60;
const PITCH_D = 50;
const PITCH_Z0 = -15;

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const sx = w / PITCH_W;
   const sz = h / PITCH_D;
   const px = (x: number) => (x + PITCH_W / 2) * sx;
   const pz = (z: number) => (z - PITCH_Z0) * sz;
   for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? COLORS.grass : COLORS.grassLight;
      ctx.fillRect(0, (i * h) / 10, w, h / 10 + 1);
   }
   ctx.strokeStyle = COLORS.line;
   ctx.lineWidth = Math.max(2, 0.12 * sx);
   ctx.beginPath();
   ctx.moveTo(0, pz(0));
   ctx.lineTo(w, pz(0));
   ctx.strokeRect(px(-9.16), pz(0), 18.32 * sx, 5.5 * sz);
   ctx.strokeRect(px(-20.16), pz(0), 40.32 * sx, 16.5 * sz);
   ctx.stroke();
   ctx.beginPath();
   ctx.ellipse(px(0), pz(11), 9.15 * sx, 9.15 * sz, 0, Math.asin(5.5 / 9.15), Math.PI - Math.asin(5.5 / 9.15));
   ctx.stroke();
   ctx.fillStyle = COLORS.line;
   ctx.beginPath();
   ctx.ellipse(px(0), pz(11), 0.2 * sx, 0.2 * sz, 0, 0, Math.PI * 2);
   ctx.fill();
}

function drawCrowd(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.stand;
   ctx.fillRect(0, 0, w, h);
   const palette = ["#f472b6", "#60a5fa", "#facc15", "#f8fafc", "#4ade80", "#a78bfa", "#fb923c"];
   let seed = 5155;
   const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
   };
   for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 96; col++) {
         if (next() < 0.18) continue;
         ctx.fillStyle = palette[Math.floor(next() * palette.length)];
         ctx.globalAlpha = 0.45 + next() * 0.45;
         const x = (col + 0.5 + (row % 2) * 0.5) * (w / 96);
         const y = (row + 0.5) * (h / 16);
         ctx.beginPath();
         ctx.arc(x, y, w / 96 / 3, 0, Math.PI * 2);
         ctx.fill();
      }
   }
   ctx.globalAlpha = 1;
   // The lowest rows show through the top of the net: fade them into the stand so the top zones read.
   const fade = ctx.createLinearGradient(0, h * 0.62, 0, h);
   fade.addColorStop(0, "rgba(30, 41, 59, 0)");
   fade.addColorStop(1, "rgba(30, 41, 59, 0.9)");
   ctx.fillStyle = fade;
   ctx.fillRect(0, h * 0.62, w, h * 0.38);
}

/** Dark boards with low-contrast lettering: they sit behind the bottom zones and must not compete. */
function drawBoards(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.board;
   ctx.fillRect(0, 0, w, h);
   ctx.font = `800 ${Math.round(h * 0.5)}px system-ui, sans-serif`;
   ctx.textBaseline = "middle";
   ctx.textAlign = "center";
   const words = ["PLAY50", "3D ARCADE", "PLAY50", "3D ARCADE", "PLAY50", "3D ARCADE"];
   for (let i = 0; i < words.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? COLORS.boardText : COLORS.boardTextAlt;
      ctx.fillText(words[i], ((i + 0.5) * w) / words.length, h / 2);
   }
}

export function Stadium() {
   const pitch = useCanvasTexture(1024, 853, drawPitch);
   const crowd = useCanvasTexture(1024, 256, drawCrowd);
   const boards = useCanvasTexture(1024, 32, drawBoards);
   return (
      <group name="stadium">
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, PITCH_Z0 + PITCH_D / 2]}>
            <planeGeometry args={[PITCH_W, PITCH_D]} />
            <meshStandardMaterial map={pitch} roughness={0.95} />
         </mesh>
         <mesh position={[0, 0.4, -4.5]}>
            <planeGeometry args={[36, 0.8]} />
            <meshBasicMaterial map={boards} />
         </mesh>
         <mesh position={[0, 4.6, -13.2]} rotation-x={-0.5}>
            <planeGeometry args={[60, 10]} />
            <meshBasicMaterial map={crowd} />
         </mesh>
         <mesh position={[0, 0.6, -9]}>
            <boxGeometry args={[60, 1.2, 0.4]} />
            <meshStandardMaterial color={COLORS.standEdge} />
         </mesh>
         <mesh position={[0, 9.6, -16.5]}>
            <boxGeometry args={[60, 0.6, 1.2]} />
            <meshStandardMaterial color={COLORS.standEdge} />
         </mesh>
         {[-1, 1].map((side) => (
            <group key={side} position={[side * 19, 0, -12]}>
               <mesh position={[0, 7, 0]}>
                  <cylinderGeometry args={[0.18, 0.25, 14, 8]} />
                  <meshStandardMaterial color="#475569" />
               </mesh>
               <mesh position={[0, 14.4, 0.2]} rotation-x={0.35}>
                  <boxGeometry args={[3.2, 1.4, 0.3]} />
                  <meshBasicMaterial color="#fef9c3" />
               </mesh>
            </group>
         ))}
      </group>
   );
}

// ---------- goal and net ----------

type P3 = [number, number, number];

/** Lines across a four-cornered face (a-b-c-d in order), nu across and nv up. */
function pushQuadGrid(out: number[], a: P3, b: P3, c: P3, d: P3, nu: number, nv: number) {
   const lerp = (p: P3, q: P3, t: number): P3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
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

export function Goal() {
   const net = useNetGeometry();
   const x = GOAL.halfWidth + GOAL.post;
   const top = GOAL.height + GOAL.post;
   const r = GOAL.post;
   return (
      <group name="goal">
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * x, top / 2, 0]}>
               <cylinderGeometry args={[r, r, top + r, 12]} />
               <meshStandardMaterial color={COLORS.frame} roughness={0.35} />
            </mesh>
         ))}
         <mesh position={[0, top, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[r, r, 2 * x + 2 * r, 12]} />
            <meshStandardMaterial color={COLORS.frame} roughness={0.35} />
         </mesh>
         <mesh position={[0, 0.02, -GOAL.depth]}>
            <boxGeometry args={[2 * x, 0.04, 0.04]} />
            <meshStandardMaterial color={COLORS.frame} />
         </mesh>
         <lineSegments geometry={net}>
            <lineBasicMaterial color={COLORS.net} transparent opacity={0.45} depthWrite={false} />
         </lineSegments>
      </group>
   );
}

// ---------- ball ----------

function drawBall(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

/** The ball.glb fallback: BallMesh with black panels painted on a canvas. */
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
