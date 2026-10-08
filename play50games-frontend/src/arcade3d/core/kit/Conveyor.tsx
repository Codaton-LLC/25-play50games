"use client";

// A conveyor belt along a core/path Path: a strip with a scrolling canvas texture (chevrons) on a
// darker frame. Two draw calls, no allocation per frame.
//
//    const BELT = createPath([{ x: -6, y: 0.6, z: 0 }, { x: 6, y: 0.6, z: 0 }]);
//    <Conveyor path={BELT} width={1.2} speed={run.beltSpeed} />
//    useRunFrame((_, dt) => advance(bag.rider, run.beltSpeed * dt));   // riders: path.ts advance
//
// The texture moves by `speed` m per second of play time (useGameTime().play), exactly like riders
// advanced by speed * dt in useRunFrame: still during the countdown, the pause and after the end.
// The belt's top is at the path's y + `lift`.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, RepeatWrapping } from "three";
import type { Path } from "../path";
import { useGameTime } from "../gameTime";
import { FRAME_PRIORITY } from "../frameLoop";
import { useCanvasTexture } from "../render/useCanvasTexture";
import { beltData } from "./kitGeometry";

export interface ConveyorProps {
   path: Path;
   /** belt width, m (default 1) */
   width?: number;
   /** m per second along the path (negative runs backwards); read every frame */
   speed?: number;
   /** m of belt per texture repeat (default 0.6) */
   tile?: number;
   /** the belt's height above the path (default 0.02) */
   lift?: number;
   /** belt colour and chevron colour */
   color?: string;
   stripe?: string;
   /** the frame under the belt (default true), a little wider, in `frameColor` */
   frame?: boolean;
   frameColor?: string;
}

function stripGeometry(path: Path, width: number, tile: number, lift: number): BufferGeometry {
   const data = beltData(path, width, 0.25, tile, lift);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
   geometry.setAttribute("normal", new BufferAttribute(data.normals, 3));
   geometry.setAttribute("uv", new BufferAttribute(data.uvs, 2));
   geometry.setIndex(data.index);
   geometry.computeBoundingSphere();
   return geometry;
}

export function Conveyor({
   path,
   width = 1,
   speed = 1,
   tile = 0.6,
   lift = 0.02,
   color = "#334155",
   stripe = "#94a3b8",
   frame = true,
   frameColor = "#1e293b",
}: ConveyorProps) {
   const time = useGameTime();
   const draw = useCallback(
      (ctx: CanvasRenderingContext2D, w: number, h: number) => {
         ctx.fillStyle = color;
         ctx.fillRect(0, 0, w, h);
         // one chevron per repeat, pointing along +v (the travel direction), plus belt seams
         ctx.strokeStyle = stripe;
         ctx.lineWidth = w * 0.09;
         ctx.lineCap = "round";
         ctx.beginPath();
         ctx.moveTo(w * 0.2, h * 0.3);
         ctx.lineTo(w * 0.5, h * 0.62);
         ctx.lineTo(w * 0.8, h * 0.3);
         ctx.stroke();
         ctx.fillStyle = "rgba(0,0,0,0.25)";
         ctx.fillRect(0, h * 0.96, w, h * 0.04);
      },
      [color, stripe]
   );
   const texture = useCanvasTexture(64, 64, draw);
   useEffect(() => {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.needsUpdate = true;
   }, [texture]);

   const belt = useMemo(() => stripGeometry(path, width, tile, lift), [path, width, tile, lift]);
   const under = useMemo(() => (frame ? stripGeometry(path, width + 0.16, tile, lift - 0.03) : null), [path, width, tile, lift, frame]);
   useEffect(() => () => belt.dispose(), [belt]);
   useEffect(() => () => under?.dispose(), [under]);

   const live = useRef({ speed, tile, play: time.play });
   live.current.speed = speed;
   live.current.tile = tile;
   useFrame(() => {
      const l = live.current;
      const played = time.play - l.play;
      l.play = time.play;
      // a new run restarts the play clock: no jump backwards
      if (played <= 0) return;
      let y = texture.offset.y - (l.speed / l.tile) * played;
      y -= Math.floor(y);
      texture.offset.y = y;
   }, FRAME_PRIORITY.visuals);

   return (
      <group name="kit-conveyor">
         <mesh geometry={belt} receiveShadow>
            <meshStandardMaterial map={texture} roughness={0.85} />
         </mesh>
         {under && (
            <mesh geometry={under}>
               <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.3} />
            </mesh>
         )}
      </group>
   );
}
