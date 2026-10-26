"use client";

// The tank's surroundings: a sand bed (grain, ripples, pebbles, soft patches) with drifting caustics,
// a faint water tint under the surface, and the aquarium hall round the tank (a dark tiled floor
// reaching past the fog, a low plinth under the glass and a dim back wall). Cosmetic only.
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, RepeatWrapping, type CanvasTexture } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Instanced, useCanvasTexture, type InstanceSpot } from "@/arcade3d/core/render";
import type { AquariumLevel } from "./levels";
import { GLASS_H, HALL, SAND_TILE_M, hallSpots, sandTint, waterTint } from "./looks";

/** A 4 m square of sand: warm base, fine grain, wind ripples, soft darker patches, a few pebbles and shells. */
function drawSand(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#f2dcb2";
   ctx.fillRect(0, 0, w, h);
   let seed = 7;
   const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
   // soft patches (tiled: drawn wrapped)
   for (let i = 0; i < 9; i++) {
      const x = rnd() * w, y = rnd() * h, r = 40 + rnd() * 90;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
         const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
         g.addColorStop(0, i % 3 ? "rgba(196,160,110,0.22)" : "rgba(255,240,210,0.25)");
         g.addColorStop(1, "rgba(196,160,110,0)");
         ctx.fillStyle = g;
         ctx.fillRect(x + ox - r, y + oy - r, 2 * r, 2 * r);
      }
   }
   // ripples: gentle wavy bands across the bed
   ctx.lineWidth = 3;
   for (let k = 0; k < 14; k++) {
      ctx.strokeStyle = k % 2 ? "rgba(170,135,90,0.16)" : "rgba(255,245,225,0.18)";
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
         const y = (k / 14) * h + Math.sin((x / w) * Math.PI * 4 + k) * 6;
         if (x === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      }
      ctx.stroke();
   }
   // grain
   for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(120,90,50,0.22)" : "rgba(255,255,240,0.28)";
      ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
   }
   // pebbles and shells
   for (let i = 0; i < 16; i++) {
      const x = rnd() * w, y = rnd() * h;
      const shell = i % 4 === 0;
      ctx.fillStyle = shell ? "#fff1e6" : ["#a8a29e", "#78716c", "#d6d3d1"][i % 3];
      ctx.beginPath();
      ctx.ellipse(x, y, shell ? 6 : 3 + rnd() * 4, shell ? 4 : 2 + rnd() * 3, rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(60,40,20,0.18)";
      ctx.beginPath();
      ctx.ellipse(x + 1.5, y + 1.5, 4, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
   }
}

/** Caustic light: soft bright cells, drawn on black for additive blending. */
function drawCaustics(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#000";
   ctx.fillRect(0, 0, w, h);
   let seed = 3;
   const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
   ctx.lineWidth = 2.5;
   ctx.strokeStyle = "rgba(200,245,255,0.55)";
   for (let i = 0; i < 40; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = 14 + rnd() * 22;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
         ctx.beginPath();
         for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 6) {
            const rr = r * (0.75 + 0.25 * Math.sin(a * 3 + i));
            const x = cx + ox + Math.cos(a) * rr, y = cy + oy + Math.sin(a) * rr;
            if (a === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
         ctx.stroke();
      }
   }
}

/** Hall floor: dark stone tiles with lighter grout, 2 x 2 tiles per texture. */
function drawHall(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#334155";
   ctx.fillRect(0, 0, w, h);
   const t = w / 2;
   for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? "#1e293b" : "#243244";
      ctx.fillRect(i * t + 3, j * t + 3, t - 6, t - 6);
   }
}

const wrap = (map: CanvasTexture, rx: number, ry: number) => {
   map.wrapS = RepeatWrapping;
   map.wrapT = RepeatWrapping;
   map.repeat.set(rx, ry);
   map.needsUpdate = true;
};

export function TankSurroundings({ level }: { level: AquariumLevel }) {
   const time = useGameTime();
   const sand = useCanvasTexture(512, 512, drawSand);
   const caustics = useCanvasTexture(256, 256, drawCaustics);
   const hall = useCanvasTexture(128, 128, drawHall);
   const hallSize = level.width + HALL.reach * 2;
   useMemo(() => wrap(sand, level.width / SAND_TILE_M, level.depth / SAND_TILE_M), [sand, level.width, level.depth]);
   useMemo(() => wrap(caustics, level.width / 6, level.depth / 6), [caustics, level.width, level.depth]);
   useMemo(() => wrap(hall, hallSize / HALL.tile, hallSize / HALL.tile), [hall, hallSize]);
   const plinth = useMemo(() => hallSpots(level), [level]);
   const night = level.lighting === "night";
   useFrame(() => {
      // the caustics drift slowly (game clock: frozen while paused)
      caustics.offset.set(time.now * 0.018, Math.sin(time.now * 0.21) * 0.08);
   }, FRAME_PRIORITY.visuals);
   return (
      <>
         {/* the hall floor, past the fog in every direction */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]}>
            <planeGeometry args={[hallSize, hallSize]} />
            <meshStandardMaterial map={hall} roughness={0.7} metalness={0.1} />
         </mesh>
         {/* the sand bed and its caustics */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
            <planeGeometry args={[level.width, level.depth]} />
            <meshStandardMaterial map={sand} color={sandTint(level)} emissive="#0c4a6e" emissiveIntensity={night ? 0.55 : 0} roughness={0.95} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, 0]}>
            <planeGeometry args={[level.width, level.depth]} />
            <meshBasicMaterial map={caustics} transparent opacity={night ? 0.35 : 0.22} blending={AdditiveBlending} depthWrite={false} />
         </mesh>
         {/* a faint tint under the water surface */}
         <mesh rotation-x={-Math.PI / 2} position={[0, GLASS_H - 0.05, 0]} renderOrder={2}>
            <planeGeometry args={[level.width, level.depth]} />
            <meshBasicMaterial color={waterTint(level)} transparent opacity={0.1} depthWrite={false} />
         </mesh>
         {/* the plinth under the glass and the dim back wall of the hall */}
         <Instanced spots={plinth} name="hall-plinth">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1f2937" emissive="#0e7490" emissiveIntensity={night ? 0.25 : 0} roughness={0.6} />
         </Instanced>
      </>
   );
}
