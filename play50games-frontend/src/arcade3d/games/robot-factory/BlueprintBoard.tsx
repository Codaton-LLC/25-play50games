"use client";

// The blueprint screen on the back wall: the current robot's parts in order (each slot the part's
// own silhouette in its colour), a tick on every fitted part, the next slot glowing, three strike
// lamps and a jam warning while the claw is locked. One canvas texture, redrawn only when what it
// shows changes (never per frame), one draw call.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from "three";
import { useCanvasTexture } from "@/arcade3d/core/render";
import { COLORS } from "./palette";
import { BOARD, SHAPE_OF, SHIFT, blueprintSize, type Run } from "./rules";

const W = 1024;
const H = 336;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
   ctx.beginPath();
   ctx.moveTo(x + r, y);
   ctx.arcTo(x + w, y, x + w, y + h, r);
   ctx.arcTo(x + w, y + h, x, y + h, r);
   ctx.arcTo(x, y + h, x, y, r);
   ctx.arcTo(x, y, x + w, y, r);
   ctx.closePath();
}

/** A part's silhouette, centred on (cx, cy), about `u` px tall. */
export function drawShapeIcon(ctx: CanvasRenderingContext2D, shape: number, cx: number, cy: number, u: number, fill: string) {
   ctx.fillStyle = fill;
   ctx.strokeStyle = fill;
   ctx.lineCap = "round";
   const dark = "rgba(7,20,38,0.55)";
   switch (shape) {
      case 0:
         roundRect(ctx, cx - u * 0.36, cy - u * 0.48, u * 0.72, u * 0.96, u * 0.16);
         ctx.fill();
         ctx.fillStyle = dark;
         ctx.fillRect(cx - u * 0.36, cy - u * 0.22, u * 0.72, u * 0.07);
         ctx.fillRect(cx - u * 0.36, cy + u * 0.15, u * 0.72, u * 0.07);
         break;
      case 1:
         roundRect(ctx, cx - u * 0.48, cy - u * 0.34, u * 0.96, u * 0.68, u * 0.06);
         ctx.fill();
         ctx.fillStyle = dark;
         ctx.fillRect(cx - u * 0.3, cy - u * 0.34, u * 0.1, u * 0.68);
         ctx.fillRect(cx + u * 0.2, cy - u * 0.34, u * 0.1, u * 0.68);
         break;
      case 2:
         roundRect(ctx, cx - u * 0.22, cy - u * 0.36, u * 0.44, u * 0.84, u * 0.08);
         ctx.fill();
         ctx.fillRect(cx - u * 0.1, cy - u * 0.5, u * 0.2, u * 0.14);
         ctx.fillStyle = dark;
         ctx.fillRect(cx - u * 0.22, cy + u * 0.3, u * 0.44, u * 0.1);
         break;
      case 3:
         ctx.beginPath();
         ctx.arc(cx, cy + u * 0.18, u * 0.42, Math.PI, 0);
         ctx.fill();
         ctx.fillRect(cx - u * 0.44, cy + u * 0.18, u * 0.88, u * 0.2);
         ctx.fillStyle = dark;
         roundRect(ctx, cx - u * 0.28, cy - u * 0.06, u * 0.56, u * 0.14, u * 0.06);
         ctx.fill();
         break;
      case 4:
         roundRect(ctx, cx - u * 0.42, cy - u * 0.36, u * 0.84, u * 0.7, u * 0.14);
         ctx.fill();
         ctx.fillRect(cx - u * 0.05, cy - u * 0.5, u * 0.1, u * 0.16);
         ctx.fillStyle = dark;
         ctx.beginPath();
         ctx.arc(cx - u * 0.17, cy - u * 0.02, u * 0.09, 0, Math.PI * 2);
         ctx.arc(cx + u * 0.17, cy - u * 0.02, u * 0.09, 0, Math.PI * 2);
         ctx.fill();
         break;
      case 5:
         roundRect(ctx, cx - u * 0.36, cy - u * 0.1, u * 0.72, u * 0.56, u * 0.1);
         ctx.fill();
         ctx.lineWidth = u * 0.06;
         ctx.beginPath();
         ctx.moveTo(cx, cy - u * 0.1);
         ctx.lineTo(cx, cy - u * 0.4);
         ctx.stroke();
         ctx.beginPath();
         ctx.arc(cx, cy - u * 0.44, u * 0.09, 0, Math.PI * 2);
         ctx.fill();
         break;
      case 6:
      case 7:
      case 8:
         roundRect(ctx, cx - u * 0.1, cy - u * 0.06, u * 0.2, u * 0.56, u * 0.06);
         ctx.fill();
         ctx.lineWidth = u * 0.11;
         ctx.beginPath();
         if (shape === 6) {
            ctx.moveTo(cx - u * 0.05, cy - u * 0.04);
            ctx.lineTo(cx - u * 0.24, cy - u * 0.42);
            ctx.moveTo(cx + u * 0.05, cy - u * 0.04);
            ctx.lineTo(cx + u * 0.24, cy - u * 0.42);
            ctx.stroke();
         } else if (shape === 7) {
            ctx.arc(cx, cy - u * 0.24, u * 0.2, Math.PI * 0.65, Math.PI * 2.35);
            ctx.stroke();
         } else {
            ctx.moveTo(cx - u * 0.14, cy - u * 0.06);
            ctx.lineTo(cx + u * 0.14, cy - u * 0.06);
            ctx.lineTo(cx, cy - u * 0.5);
            ctx.closePath();
            ctx.fill();
         }
         break;
   }
}

export function BlueprintBoard({ run }: { run: Run }) {
   const state = useRef(run);
   state.current = run;
   const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const r = state.current;
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0a1e3a");
      bg.addColorStop(1, COLORS.screen);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(56,189,248,0.12)";
      ctx.lineWidth = 2;
      for (let x = 32; x < w; x += 48) {
         ctx.beginPath();
         ctx.moveTo(x, 0);
         ctx.lineTo(x, h);
         ctx.stroke();
      }
      const size = blueprintSize(r.robot);
      const base = r.robotStart[r.robot];
      ctx.fillStyle = COLORS.screenText;
      ctx.font = "800 34px system-ui, sans-serif";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(`ROBOT ${r.robot + 1}`, 30, 38);
      ctx.fillStyle = "rgba(224,242,254,0.6)";
      ctx.font = "600 24px system-ui, sans-serif";
      ctx.fillText(r.robot >= SHIFT.WIN_QUOTA ? "QUOTA MET" : `QUOTA ${r.robot}/${SHIFT.WIN_QUOTA}`, 210, 39);
      // strike lamps
      for (let k = 0; k < SHIFT.LIVES; k++) {
         ctx.beginPath();
         ctx.arc(w - 40 - k * 40, 38, 13, 0, Math.PI * 2);
         ctx.fillStyle = k < r.strikes ? COLORS.faulty : "rgba(148,163,184,0.25)";
         ctx.fill();
      }
      if (r.lockout > 0) {
         ctx.fillStyle = COLORS.bad;
         ctx.font = "800 26px system-ui, sans-serif";
         ctx.textAlign = "right";
         ctx.fillText("CLAW JAMMED", w - 150, 39);
         ctx.textAlign = "left";
      }
      const slotW = 168;
      const gap = 22;
      const total = size * slotW + (size - 1) * gap;
      const x0 = (w - total) / 2;
      const y0 = 80;
      const sh = 232;
      for (let i = 0; i < size; i++) {
         const g = base + i;
         const x = x0 + i * (slotW + gap);
         const done = i < r.stepIndex;
         const current = i === r.stepIndex;
         roundRect(ctx, x, y0, slotW, sh, 18);
         ctx.fillStyle = current ? "rgba(125,211,252,0.18)" : "rgba(15,23,42,0.6)";
         ctx.fill();
         ctx.lineWidth = current ? 7 : 3;
         ctx.strokeStyle = done ? COLORS.good : current ? COLORS.rim : "rgba(148,163,184,0.35)";
         ctx.stroke();
         const shape = SHAPE_OF[r.stepKind[g]][r.stepColour[g]];
         ctx.globalAlpha = done ? 0.45 : 1;
         drawShapeIcon(ctx, shape, x + slotW / 2, y0 + sh / 2 + 6, 128, COLORS.parts[r.stepColour[g]]);
         ctx.globalAlpha = 1;
         ctx.fillStyle = "rgba(224,242,254,0.7)";
         ctx.font = "700 22px system-ui, sans-serif";
         ctx.textAlign = "left";
         ctx.fillText(String(i + 1), x + 14, y0 + 22);
         if (done) {
            ctx.strokeStyle = COLORS.good;
            ctx.lineWidth = 12;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x + slotW - 62, y0 + 40);
            ctx.lineTo(x + slotW - 44, y0 + 58);
            ctx.lineTo(x + slotW - 16, y0 + 22);
            ctx.stroke();
         }
      }
   }, []);
   const map = useCanvasTexture(W, H, draw);
   const geometry = useMemo(() => new PlaneGeometry(BOARD.width, BOARD.height), []);
   const material = useMemo(() => new MeshBasicMaterial({ map, toneMapped: false }), [map]);
   useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);
   const key = useRef(-1);
   useFrame(() => {
      const k = run.robot * 1000 + run.stepIndex * 100 + run.strikes * 10 + (run.lockout > 0 ? 1 : 0);
      if (k === key.current) return;
      key.current = k;
      redraw(map, draw);
   });
   return <mesh geometry={geometry} material={material} position={[BOARD.x, BOARD.y, BOARD.z + 0.035]} name="blueprint-board" />;
}

function redraw(map: CanvasTexture, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
   const canvas = map.image as HTMLCanvasElement;
   const ctx = canvas.getContext("2d");
   if (!ctx) return;
   draw(ctx, canvas.width, canvas.height);
   map.needsUpdate = true;
}
