"use client";

// The Martian sky: the haze dome (core SkyDome: the horizon colour is the fog's), the sun (blue-haloed at
// sunset), Earth and the two moons as camera-facing discs, stars at night, and L4's dust storm streaks.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Euler, Quaternion, Vector3, type Group, type Matrix4, type Mesh } from "three";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import type { MarsLevel } from "./levels";
import { COLORS, SKY, SKY_BODIES, type SkyBody } from "./looks";

const SKY_R = 150;

function drawSun(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.08, "rgba(255,255,255,1)");
   g.addColorStop(0.13, "rgba(255,255,255,0.65)");
   g.addColorStop(0.35, "rgba(255,255,255,0.18)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
}

function drawEarth(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cx = w / 2;
   const r = w * 0.22;
   const halo = ctx.createRadialGradient(cx, cx, r * 0.9, cx, cx, w / 2);
   halo.addColorStop(0, "rgba(147,197,253,0.55)");
   halo.addColorStop(1, "rgba(147,197,253,0)");
   ctx.fillStyle = halo;
   ctx.fillRect(0, 0, w, h);
   const body = ctx.createRadialGradient(cx - r * 0.35, cx - r * 0.35, r * 0.1, cx, cx, r);
   body.addColorStop(0, "#bfe3ff");
   body.addColorStop(0.55, "#3b82f6");
   body.addColorStop(1, "#1e3a8a");
   ctx.fillStyle = body;
   ctx.beginPath();
   ctx.arc(cx, cx, r, 0, Math.PI * 2);
   ctx.fill();
   // continents and clouds
   ctx.save();
   ctx.clip();
   ctx.fillStyle = "rgba(74,160,90,0.8)";
   ctx.beginPath();
   ctx.ellipse(cx - r * 0.25, cx + r * 0.1, r * 0.35, r * 0.22, 0.6, 0, Math.PI * 2);
   ctx.fill();
   ctx.beginPath();
   ctx.ellipse(cx + r * 0.35, cx - r * 0.3, r * 0.22, r * 0.3, -0.4, 0, Math.PI * 2);
   ctx.fill();
   ctx.strokeStyle = "rgba(255,255,255,0.85)";
   ctx.lineWidth = r * 0.09;
   for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - 1.5) * r * 0.3, cx + (i % 2 ? -1 : 1) * r * 0.25, r * 0.35, 0.2 + i, 1.4 + i);
      ctx.stroke();
   }
   // the night side
   const night = ctx.createLinearGradient(cx - r, cx - r, cx + r, cx + r);
   night.addColorStop(0.45, "rgba(0,0,20,0)");
   night.addColorStop(1, "rgba(0,0,20,0.75)");
   ctx.fillStyle = night;
   ctx.fillRect(0, 0, w, h);
   ctx.restore();
}

function drawMoon(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cx = w / 2;
   ctx.save();
   ctx.translate(cx, cx);
   ctx.scale(1, 0.78);
   const body = ctx.createRadialGradient(-w * 0.12, -w * 0.12, w * 0.02, 0, 0, w * 0.42);
   body.addColorStop(0, "#f1ece6");
   body.addColorStop(0.7, "#a59d94");
   body.addColorStop(1, "#5f5852");
   ctx.fillStyle = body;
   ctx.beginPath();
   ctx.arc(0, 0, w * 0.42, 0, Math.PI * 2);
   ctx.fill();
   ctx.fillStyle = "rgba(70,62,56,0.45)";
   for (const [x, y, r] of [[-0.12, 0.05, 0.08], [0.15, -0.1, 0.06], [0.05, 0.18, 0.05], [-0.2, -0.18, 0.04]]) {
      ctx.beginPath();
      ctx.arc(x * w, y * w, r * w, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.restore();
   void h;
}

function Body({ body, map }: { body: SkyBody; map: import("three").Texture }) {
   const ref = useRef<Mesh>(null);
   const camera = useThree((s) => s.camera);
   const dir = useMemo(() => new Vector3(...body.dir).normalize().multiplyScalar(SKY_R), [body]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      m.position.copy(dir);
      m.quaternion.copy(camera.quaternion);
   }, FRAME_PRIORITY.visuals);
   const scale = body.kind === "sun" ? body.size * 2.4 : body.kind === "earth" ? body.size * 2.2 : body.size;
   return (
      <mesh ref={ref} scale={scale} renderOrder={-999} frustumCulled={false}>
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial
            map={map}
            color={body.color}
            transparent
            opacity={body.opacity}
            depthWrite={false}
            fog={false}
            blending={body.kind === "moon" ? undefined : AdditiveBlending}
            toneMapped={false}
         />
      </mesh>
   );
}

export function MarsSky({ id, level }: { id: LevelId; level: MarsLevel }) {
   const group = useRef<Group>(null);
   const camera = useThree((s) => s.camera);
   const quality = useQuality();
   const sun = useCanvasTexture(256, 256, drawSun);
   const earth = useCanvasTexture(256, 256, drawEarth);
   const moon = useCanvasTexture(128, 128, drawMoon);
   const sky = SKY[id];
   useFrame(() => {
      group.current?.position.copy(camera.position);
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         <SkyDome top={sky.top} bottom={sky.bottom} exponent={sky.exponent} offset={0.02} />
         {level.lighting === "night" && <Starfield count={scaledCount(1100, quality.decor)} seed={43} upperOnly />}
         <group ref={group}>
            {SKY_BODIES[id].map((b, i) => (
               <Body key={i} body={b} map={b.kind === "sun" ? sun : b.kind === "earth" ? earth : moon} />
            ))}
         </group>
      </>
   );
}

// ---------- the dust storm (L4): streaks blowing past the camera, thicker as the clock runs down ----------

const BOX = { x: 40, y: 12, z: 40 };
const WIND = new Vector3(9, -0.6, 3.5);
const P = new Vector3();
const S = new Vector3();
const STREAK_Q = new Quaternion().setFromEuler(new Euler(0, -Math.atan2(WIND.z, WIND.x), 0));

export function DustStorm({ share }: { share: { value: number } }) {
   const quality = useQuality();
   const camera = useThree((s) => s.camera);
   const count = scaledCount(260, quality.decor);
   const parts = useMemo(() => {
      let seed = 99;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      return Array.from({ length: count }, () => ({ x: rnd() * BOX.x, y: rnd() * BOX.y, z: rnd() * BOX.z, s: 0.6 + rnd() * 1.2, k: rnd() }));
   }, [count]);
   const update = (i: number, m: Matrix4) => {
      const p = parts[i];
      if (!p || p.k > 0.25 + 0.75 * share.value) return false;
      const wrap = (v: number, n: number) => ((v % n) + n) % n;
      P.set(
         camera.position.x - BOX.x / 2 + wrap(p.x - camera.position.x, BOX.x),
         Math.max(0.2, camera.position.y - 5 + wrap(p.y, BOX.y)),
         camera.position.z - BOX.z / 2 + wrap(p.z - camera.position.z, BOX.z)
      );
      S.set(p.s * 2.2, p.s * 0.06, p.s * 0.06);
      m.compose(P, STREAK_Q, S);
   };
   useFrame((_s, dt) => {
      const d = Math.min(dt, 0.1);
      for (const p of parts) {
         p.x += WIND.x * d * (0.8 + p.s * 0.3);
         p.y += WIND.y * d;
         p.z += WIND.z * d * (0.8 + p.s * 0.3);
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   return (
      <DynamicInstanced count={count} update={update} name="dust-storm">
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial color={COLORS.dust} transparent opacity={0.45} depthWrite={false} />
      </DynamicInstanced>
   );
}
