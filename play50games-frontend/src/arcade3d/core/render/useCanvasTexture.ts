"use client";

// A texture drawn once with the 2D canvas API (floor markings, planks, labels, baked contact
// shadows): no image file to load, and it is disposed with the component.
//
//    const floor = useCanvasTexture(768, 512, drawFloor);   // drawFloor: a module-level function
//    <meshStandardMaterial map={floor} />
//
// Keep `draw` stable (module level or useCallback): a new function redraws the texture.
// Keep sizes within the texture budget (<= 1024 px).
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, SRGBColorSpace } from "three";

export type CanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

export function useCanvasTexture(width: number, height: number, draw: CanvasDraw): CanvasTexture {
   const gl = useThree((state) => state.gl);
   const texture = useMemo(() => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) draw(ctx, width, height);
      const map = new CanvasTexture(canvas);
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      return map;
   }, [gl, width, height, draw]);
   useEffect(() => () => texture.dispose(), [texture]);
   return texture;
}
