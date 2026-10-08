"use client";

// A cardboard parcel: a box with a tape band and a label, one draw call. Every parcel of one look
// shares one canvas texture and material (kit cache, disposed with the last parcel), so a pile of
// fifty costs one texture. Its origin is the bottom centre.
//
//    <Parcel position={[x, 0, z]} size={[0.5, 0.35, 0.4]} />
//    <Parcel size={[0.4, 0.3, 0.4]} color="#d6b48a" tape="#2563eb" />   // a "priority" parcel
import { forwardRef, useEffect, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import { BoxGeometry, CanvasTexture, MeshStandardMaterial, SRGBColorSpace, type Group } from "three";
import { createRefCache } from "../materials";

export interface ParcelProps extends Omit<GroupProps, "children"> {
   /** width, height, depth, m (default 0.5 x 0.35 x 0.4) */
   size?: readonly [number, number, number];
   /** cardboard (default kraft) and tape colours */
   color?: string;
   tape?: string;
   /** a white address label (default true) */
   label?: boolean;
}

interface ParcelLook {
   material: MeshStandardMaterial;
   texture: CanvasTexture;
}

const LOOKS = createRefCache<ParcelLook>((look) => {
   look.texture.dispose();
   look.material.dispose();
});

function drawParcel(color: string, tape: string, label: boolean): CanvasTexture {
   const canvas = document.createElement("canvas");
   canvas.width = 128;
   canvas.height = 128;
   const ctx = canvas.getContext("2d");
   if (ctx) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 128, 128);
      // a little card grain
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      for (let y = 0; y < 128; y += 6) ctx.fillRect(0, y, 128, 2);
      // the tape band down the middle of every face
      ctx.fillStyle = tape;
      ctx.fillRect(52, 0, 24, 128);
      if (label) {
         ctx.fillStyle = "#f8fafc";
         ctx.fillRect(84, 70, 36, 26);
         ctx.fillStyle = "#94a3b8";
         for (let i = 0; i < 3; i++) ctx.fillRect(88, 76 + i * 6, 26 - i * 6, 2);
      }
   }
   const texture = new CanvasTexture(canvas);
   texture.colorSpace = SRGBColorSpace;
   return texture;
}

export const Parcel = forwardRef<Group, ParcelProps>(function Parcel({ size = [0.5, 0.35, 0.4], color = "#c8a274", tape = "#a16207", label = true, ...group }, ref) {
   const key = `${color}|${tape}|${label ? 1 : 0}`;
   const look = useMemo(
      () =>
         LOOKS.get(key, () => {
            const texture = drawParcel(color, tape, label);
            return { texture, material: new MeshStandardMaterial({ map: texture, roughness: 0.9 }) };
         }),
      [key, color, tape, label]
   );
   useEffect(() => {
      LOOKS.retain(key, look);
      return () => LOOKS.release(key);
   }, [key, look]);
   const [w, h, d] = size;
   const geometry = useMemo(() => new BoxGeometry(w, h, d).translate(0, h / 2, 0), [w, h, d]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <group ref={ref} {...group} name="kit-parcel">
         <mesh geometry={geometry} material={look.material} castShadow receiveShadow />
      </group>
   );
});
