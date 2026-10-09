import type { ScreenRect } from "@/arcade3d/core/view";
import { HULL } from "./assets";
import { BODY, PLANETS, padX, type Run } from "./rules";

export interface FlightBox { x0: number; x1: number; y0: number; y1: number }
export function rocketBox(run: Run): FlightBox {
   const b = run.body, c = Math.cos(b.angle), s = Math.sin(b.angle);
   const px = padX(run.layouts[run.planet], run.planet, run.attemptTime), half = PLANETS[run.planet].width / 2;
   const box = { x0: px - half, x1: px + half, y0: 1.6, y1: 2.08 };
   for (const [hx, hy] of HULL) {
      const x = b.x + c * hx - s * (hy - BODY.centre);
      const y = b.y + s * hx + c * (hy - BODY.centre);
      box.x0 = Math.min(box.x0, x); box.x1 = Math.max(box.x1, x);
      box.y0 = Math.min(box.y0, y); box.y1 = Math.max(box.y1, y);
   }
   return box;
}

// Level camera: fit the live box in the largest clear horizontal strip.
// Treat every obstruction as a band, conservatively including side touch controls.
// Equivalent perspective fit math without fitView's per-frame projection search.
export function fitRocketView(box: FlightBox, width: number, height: number, avoid: readonly ScreenRect[]) {
   const w = Math.max(1, width), h = Math.max(1, height);
   let slots = [{ top: h * 0.04, bottom: h * 0.96 }];
   for (const r of avoid) {
      if (r.right <= 0 || r.left >= w || r.bottom <= 0 || r.top >= h) continue;
      const top = r.top - 4, bottom = r.bottom + 4;
      slots = slots.flatMap((slot) => {
         if (top >= slot.bottom || bottom <= slot.top) return [slot];
         return [
            ...(top > slot.top ? [{ top: slot.top, bottom: top }] : []),
            ...(bottom < slot.bottom ? [{ top: bottom, bottom: slot.bottom }] : []),
         ];
      });
   }
   const slot = slots.reduce((best, s) => s.bottom - s.top > best.bottom - best.top ? s : best, { top: h / 2, bottom: h / 2 + 1 });
   const tangent = Math.tan(35 * Math.PI / 360);
   const hx = (box.x1 - box.x0) / 2 + 0.15, hy = (box.y1 - box.y0) / 2 + 0.15;
   // Hull has depth too: reserve 1.5 m towards the camera.
   const distance = 1.5 + Math.max(hx / (tangent * w / h * 0.94), hy * h / (tangent * (slot.bottom - slot.top)), 3);
   return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, distance, shift: 1 - (slot.top + slot.bottom) / h };
}
