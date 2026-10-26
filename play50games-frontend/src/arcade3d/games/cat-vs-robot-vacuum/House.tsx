"use client";

// The house around the play: room floors (wood planks or kitchen tiles, a patterned rug in each
// room), the hall's low walls with a baseboard and a cap, and the rest of the house outside the
// hall (a darker parquet and the outer walls on the far and side edges, never on the camera side).
// Every surface is a unit box placed by an instance spot; textures are drawn once on a canvas and
// shared, so the whole house is about ten draw calls whatever the level.
import { useMemo } from "react";
import { RepeatWrapping, type CanvasTexture } from "three";
import { Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { COLORS, floorSpots, outerWallSpots, rugSpots, wallSpots } from "./looks";
import { LEVELS } from "./levels";

function planks(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, dark: string, light: string) {
   const rows = 8;
   const rh = h / rows;
   for (let r = 0; r < rows; r++) {
      ctx.fillStyle = r % 2 ? base : light;
      ctx.fillRect(0, r * rh, w, rh);
      // staggered butt joints
      ctx.fillStyle = dark;
      const off = (r * 0.37) % 1;
      for (let k = 0; k < 3; k++) ctx.fillRect(((off + k / 3) % 1) * w, r * rh, 2, rh);
      ctx.fillRect(0, r * rh, w, 1.5);
      // grain
      ctx.globalAlpha = 0.12;
      for (let g = 0; g < 14; g++) ctx.fillRect(((g * 53 + r * 17) % w), r * rh + ((g * 7) % rh), 40 + (g % 5) * 12, 1);
      ctx.globalAlpha = 1;
   }
}

const drawWoodLight = (ctx: CanvasRenderingContext2D, w: number, h: number) => planks(ctx, w, h, COLORS.woodLight, COLORS.woodSeam, COLORS.woodLightAlt);
const drawWoodWarm = (ctx: CanvasRenderingContext2D, w: number, h: number) => planks(ctx, w, h, COLORS.woodWarm, COLORS.woodWarmSeam, COLORS.woodWarmAlt);
const drawParquet = (ctx: CanvasRenderingContext2D, w: number, h: number) => planks(ctx, w, h, COLORS.parquet, COLORS.parquetSeam, COLORS.parquetAlt);

function drawTiles(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const n = 4;
   const s = w / n;
   ctx.fillStyle = COLORS.grout;
   ctx.fillRect(0, 0, w, h);
   for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
         ctx.fillStyle = (i + j) % 2 ? COLORS.tileA : COLORS.tileB;
         ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      }
}

function drawRug(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.rugEdge;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.rug;
   ctx.fillRect(10, 10, w - 20, h - 20);
   ctx.fillStyle = COLORS.rugField;
   ctx.fillRect(22, 22, w - 44, h - 44);
   // a row of diamonds down the middle and a dotted inner border
   ctx.fillStyle = COLORS.rug;
   const cx = w / 2;
   for (let y = 50; y < h - 40; y += 56) {
      ctx.beginPath();
      ctx.moveTo(cx, y - 22);
      ctx.lineTo(cx + 22, y);
      ctx.lineTo(cx, y + 22);
      ctx.lineTo(cx - 22, y);
      ctx.closePath();
      ctx.fill();
   }
   ctx.fillStyle = COLORS.rugEdge;
   for (let y = 30; y < h - 30; y += 14) {
      ctx.fillRect(28, y, 4, 4);
      ctx.fillRect(w - 32, y, 4, 4);
   }
}

function repeat(map: CanvasTexture, x: number, y: number) {
   map.wrapS = RepeatWrapping;
   map.wrapT = RepeatWrapping;
   map.repeat.set(x, y);
   map.needsUpdate = true;
}

export function House({ id }: { id: LevelId }) {
   const level = LEVELS[id];
   const floors = useMemo(() => floorSpots(id), [id]);
   const rugs = useMemo(() => rugSpots(level), [level]);
   const walls = useMemo(() => wallSpots(level), [level]);
   const outer = useMemo(() => outerWallSpots(level), [level]);

   const woodLight = useCanvasTexture(256, 256, drawWoodLight);
   const woodWarm = useCanvasTexture(256, 256, drawWoodWarm);
   const tiles = useCanvasTexture(256, 256, drawTiles);
   const rug = useCanvasTexture(128, 256, drawRug);
   const parquet = useCanvasTexture(256, 256, drawParquet);
   // a room is 4.8 x 6 m: planks about 0.19 m wide, tiles 0.3 m
   useMemo(() => {
      repeat(woodLight, 2, 3.2);
      repeat(woodWarm, 2, 3.2);
      repeat(tiles, 4, 5);
      repeat(parquet, 90, 90);
   }, [woodLight, woodWarm, tiles, parquet]);

   return (
      <>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, (level.rooms * 6) / 2]}>
            <circleGeometry args={[120, 48]} />
            <meshStandardMaterial map={parquet} color={COLORS.outerTint} roughness={0.9} />
         </mesh>
         {floors.woodLight.length > 0 && (
            <Instanced spots={floors.woodLight} name="floor-wood">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial map={woodLight} roughness={0.75} />
            </Instanced>
         )}
         {floors.woodWarm.length > 0 && (
            <Instanced spots={floors.woodWarm} name="floor-wood-warm">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial map={woodWarm} roughness={0.75} />
            </Instanced>
         )}
         {floors.tile.length > 0 && (
            <Instanced spots={floors.tile} name="floor-tile">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial map={tiles} roughness={0.45} />
            </Instanced>
         )}
         <Instanced spots={rugs} name="rugs">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial map={rug} roughness={0.95} />
         </Instanced>
         <Instanced spots={walls.base} name="wall-base">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.baseboard} roughness={0.6} />
         </Instanced>
         <Instanced spots={walls.body} name="walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.85} />
         </Instanced>
         <Instanced spots={walls.cap} name="wall-cap">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.wallCap} roughness={0.55} />
         </Instanced>
         <Instanced spots={outer.body} name="outer-walls">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.outerWall} roughness={0.9} />
         </Instanced>
         <Instanced spots={outer.trim} name="outer-trim">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.baseboard} roughness={0.6} />
         </Instanced>
      </>
   );
}
