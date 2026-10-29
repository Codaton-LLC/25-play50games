"use client";

// Each side room dressed as the level's room (levels.ts `rooms`): its own floor (library parquet with a
// green rug, kitchen checker tiles, attic boards with rafter shadows), its furniture (rules.ts
// ROOM_FURNITURE: bookshelves, a kitchen island, counter and stove, attic trunks and crates, the same
// boxes the hunter walks round), and small touches (copper pots, cobwebs, dust, the attic's rafters).
// The living room is today's room and draws nothing here. Visual only.
import { useEffect, useMemo } from "react";
import { RepeatWrapping, type CanvasTexture } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import type { GhostLevel, RoomKind } from "./levels";
import { ROOMS, roomFurniture } from "./rules";

const TONES = {
   libraryWood: "#5a3a22",
   libraryWoodDark: "#3e2716",
   rug: "#1f5f4a",
   rugBorder: "#c9a227",
   tileA: "#e8e2d0",
   tileB: "#3f6f7a",
   atticBoard: "#7a6650",
   atticGap: "#3a2e24",
   rafterShadow: "#2a221b",
   copper: "#c2703d",
   dust: "#f5efe0",
   rafter: "#4a3826",
} as const;

/** The drawn height (m) of each furniture kind (low enough that the tilted camera sees over it). */
const HEIGHT: Record<string, number> = { shelf: 1.3, shelfWall: 1.3, island: 0.85, counter: 1.0, stove: 1.0, trunk: 0.62, crate: 0.75 };
/** Which GLB draws each furniture kind. */
const ASSET_OF = { shelf: "bookshelf", shelfWall: "bookshelf", island: "table", counter: "counter", stove: "stove", trunk: "trunkBox", crate: "crate" } as const;

function useFloor(kind: Exclude<RoomKind, "living">): CanvasTexture {
   const draw = useMemo<CanvasDraw>(() => (ctx, w, h) => {
      if (kind === "kitchen") {
         const n = 8;
         for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
            ctx.fillStyle = (i + j) % 2 ? TONES.tileA : TONES.tileB;
            ctx.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
         }
         ctx.strokeStyle = "rgba(0,0,0,0.18)";
         ctx.lineWidth = 2;
         for (let i = 0; i <= n; i++) {
            ctx.beginPath(); ctx.moveTo((i * w) / n, 0); ctx.lineTo((i * w) / n, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, (i * h) / n); ctx.lineTo(w, (i * h) / n); ctx.stroke();
         }
         return;
      }
      // boards: library parquet (warm, dark) or attic planks (grey-brown, wide gaps)
      const attic = kind === "attic";
      ctx.fillStyle = attic ? TONES.atticBoard : TONES.libraryWood;
      ctx.fillRect(0, 0, w, h);
      const rows = attic ? 10 : 16;
      for (let r = 0; r < rows; r++) {
         const y = (r * h) / rows;
         ctx.fillStyle = attic ? TONES.atticGap : TONES.libraryWoodDark;
         ctx.fillRect(0, y, w, attic ? 3 : 2);
         ctx.globalAlpha = 0.12;
         ctx.fillStyle = r % 2 ? "#ffffff" : "#000000";
         ctx.fillRect(0, y + 3, w, h / rows - 4);
         ctx.globalAlpha = 1;
         const off = (r * 37) % 64;
         for (let x = off; x < w; x += attic ? 128 : 64) {
            ctx.fillStyle = attic ? TONES.atticGap : TONES.libraryWoodDark;
            ctx.fillRect(x, y, 2, h / rows);
         }
      }
      if (attic) {
         // the rafters' shadows across the boards
         ctx.globalAlpha = 0.35;
         ctx.fillStyle = TONES.rafterShadow;
         for (let x = 20; x < w; x += 64) ctx.fillRect(x, 0, 14, h);
         ctx.globalAlpha = 1;
      }
   }, [kind]);
   const texture = useCanvasTexture(256, 256, draw);
   useEffect(() => {
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.repeat.set(kind === "kitchen" ? 2.7 : 2, kind === "kitchen" ? 2.45 : 2);
      texture.needsUpdate = true;
   }, [texture, kind]);
   return texture;
}

function RoomFloors({ kind, rooms }: { kind: Exclude<RoomKind, "living">; rooms: readonly number[] }) {
   const texture = useFloor(kind);
   return (
      <group>
         {rooms.map((i) => {
            const r = ROOMS[i];
            return (
               <group key={i}>
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[r.side * 8.5, 0.005, r.north * 5]}>
                     <planeGeometry args={[10.8, 9.8]} />
                     <meshStandardMaterial map={texture} color="#ffffff" roughness={kind === "kitchen" ? 0.35 : 0.85} />
                  </mesh>
                  {kind === "library" && (
                     <group position={[r.side * 8.6, 0.008, r.north * 5.2]}>
                        <mesh rotation={[-Math.PI / 2, 0, 0]}>
                           <planeGeometry args={[5.4, 3.6]} />
                           <meshStandardMaterial color={TONES.rugBorder} roughness={0.95} />
                        </mesh>
                        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
                           <planeGeometry args={[5.0, 3.2]} />
                           <meshStandardMaterial color={TONES.rug} roughness={0.95} />
                        </mesh>
                     </group>
                  )}
               </group>
            );
         })}
      </group>
   );
}

export default function RoomDressing({ level }: { level: GhostLevel }) {
   const groups = useMemo(() => {
      const byAsset: Record<string, InstanceSpot[]> = {};
      const pots: InstanceSpot[] = [];
      const webs: InstanceSpot[] = [];
      const dust: InstanceSpot[] = [];
      const rafters: InstanceSpot[] = [];
      level.rooms.forEach((kind, i) => {
         const r = ROOMS[i];
         for (const f of roomFurniture(i, kind)) {
            const w = f.box.max.x - f.box.min.x, d = f.box.max.z - f.box.min.z;
            const along = d > w;
            // face into the room: shelves on the outer wall turn to the hall, wall pieces to the middle
            const rotY = along ? -r.side * Math.PI / 2 : r.north > 0 && Math.abs(f.z) > 8 ? Math.PI : 0;
            const key = ASSET_OF[f.kind as keyof typeof ASSET_OF];
            (byAsset[key] ??= []).push({ x: f.x, y: 0, z: f.z, rotY, sx: along ? d : w, sy: HEIGHT[f.kind] ?? 1, sz: along ? w : d });
            if (f.kind === "island") for (let k = -1; k <= 1; k++) pots.push({ x: f.x + 0.1 * k, y: 0.9, z: f.z + 0.7 * k, scale: 1 });
         }
         if (kind === "attic") {
            // cobwebs in the far corners, dust in the air, rafters sloping down the outer wall
            // (webs only on the far, north walls: the camera looks at them, not at their backs)
            if (r.north < 0) {
               webs.push({ x: r.side * 13.2, y: 0.9, z: -9.85, rotY: 0, sx: 1.2, sy: 1.1, sz: 0.1 });
               webs.push({ x: r.side * 4.0, y: 1.0, z: -9.85, rotY: 0, sx: 1.0, sy: 0.9, sz: 0.1 });
            }
            for (let k = 0; k < 9; k++) dust.push({ x: r.side * (4.5 + ((k * 3.7) % 8.5)), y: 0.6 + ((k * 0.37) % 1.4), z: r.north * (1.2 + ((k * 2.3) % 8)), scale: 0.05 + (k % 3) * 0.02 });
            for (let k = 0; k < 4; k++) rafters.push({ x: r.side * 13.4, y: 1.6, z: r.north * (1.5 + k * 2.4), rotY: 0, sx: 0.16, sy: 1.6, sz: 0.16 });
         }
      });
      return { byAsset, pots, webs, dust, rafters };
   }, [level]);
   const floorRooms = (kind: RoomKind) => level.rooms.flatMap((k, i) => (k === kind ? [i] : []));
   const box = (color: string) => (spots: InstanceSpot[]) => (
      <Instanced spots={spots}>
         <boxGeometry />
         <meshStandardMaterial color={color} roughness={0.8} />
      </Instanced>
   );
   return (
      <group name="room-dressing">
         {(["library", "kitchen", "attic"] as const).map((kind) => (floorRooms(kind).length ? <RoomFloors key={kind} kind={kind} rooms={floorRooms(kind)} /> : null))}
         {Object.entries(groups.byAsset).map(([key, spots]) => (
            <InstancedModel key={key} asset={ASSETS[key as keyof typeof ASSETS]} spots={spots} fallback={box("#6b4a2e")(spots.map((s) => ({ ...s, y: (s.sy ?? 1) / 2 })))} />
         ))}
         {groups.pots.length > 0 && (
            <Instanced spots={groups.pots}>
               <cylinderGeometry args={[0.16, 0.13, 0.2, 10]} />
               <meshStandardMaterial color={TONES.copper} metalness={0.6} roughness={0.35} />
            </Instanced>
         )}
         {groups.webs.length > 0 && <InstancedModel asset={ASSETS.web} spots={groups.webs} fallback={null} />}
         {groups.dust.length > 0 && (
            <Instanced spots={groups.dust}>
               <sphereGeometry args={[1, 6, 4]} />
               <meshBasicMaterial color={TONES.dust} transparent opacity={0.55} depthWrite={false} />
            </Instanced>
         )}
         {groups.rafters.length > 0 && (
            <Instanced spots={groups.rafters}>
               <boxGeometry />
               <meshStandardMaterial color={TONES.rafter} roughness={0.9} />
            </Instanced>
         )}
      </group>
   );
}
