"use client";

// Performance probe. Owned by Claude. ShellStage mounts it only when the page URL has ?perf=1
// (read once), so normal play never pays for it. It publishes the renderer's numbers and the frame
// times of the last 600 frames:
//
//    window.__arcadePerf = { calls, triangles, geometries, textures, programs, frames, p50, p95, max, maxCalls, samples }
//
// and shows a tiny read-only overlay in the top-left corner (pointer-events: none).
// - calls / triangles: the last rendered frame (read at the very start of the next frame, before
//   anything draws: three resets gl.info.render at the start of every render, so a read after it
//   would see a partial frame). maxCalls is the most seen in one frame since the stage mounted.
// - geometries / textures / programs: live GPU objects (gl.info.memory, gl.info.programs).
// - frames: frames measured; p50 / p95 / max: frame time (ms) over the last 600 frames that were
//   not paused, refreshed twice a second. No allocation per frame (perfStats.ts ring buffer).
// tools/perf and the go-live checklist read window.__arcadePerf.
import { useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { arcadeStore } from "./useArcadeStore";
import { FRAME_PRIORITY } from "./frameLoop";
import { createFrameStats, framePercentiles, pushFrame } from "./perfStats";

export interface ArcadePerf {
   calls: number;
   maxCalls: number;
   triangles: number;
   geometries: number;
   textures: number;
   programs: number;
   frames: number;
   /** frame-time samples in the window (≤ 600) */
   samples: number;
   p50: number;
   p95: number;
   max: number;
}

declare global {
   interface Window {
      __arcadePerf?: ArcadePerf;
   }
}

/** The probe's query flag: `?perf=1`. Read once on the client. */
export function perfProbeRequested(): boolean {
   if (typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("perf") === "1";
   } catch {
      return false;
   }
}

/** Before every other frame callback (FRAME_PRIORITY.input is -2). */
const PROBE_PRIORITY = FRAME_PRIORITY.input - 1;
const REFRESH_MS = 500;
/** a gap this long is a hidden tab or a redraw while paused, not a frame */
const MAX_FRAME_GAP_MS = 1000;

const OVERLAY_STYLE =
   "position:fixed;left:calc(env(safe-area-inset-left,0px) + 8px);top:calc(env(safe-area-inset-top,0px) + 64px);" +
   "z-index:60;pointer-events:none;font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;color:#e2e8f0;" +
   "background:rgba(2,6,23,.72);padding:4px 6px;border-radius:4px;white-space:pre;";

export default function PerfProbe() {
   const gl = useThree((state) => state.gl);
   const [probe] = useState(() => ({
      perf: {
         calls: 0,
         maxCalls: 0,
         triangles: 0,
         geometries: 0,
         textures: 0,
         programs: 0,
         frames: 0,
         samples: 0,
         p50: 0,
         p95: 0,
         max: 0,
      } as ArcadePerf,
      stats: createFrameStats(600),
      last: 0,
      refreshAt: 0,
      overlay: null as HTMLDivElement | null,
   }));

   useEffect(() => {
      window.__arcadePerf = probe.perf;
      const overlay = document.createElement("div");
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("data-arcade-perf", "");
      overlay.style.cssText = OVERLAY_STYLE;
      document.body.appendChild(overlay);
      probe.overlay = overlay;
      return () => {
         overlay.remove();
         probe.overlay = null;
         if (window.__arcadePerf === probe.perf) delete window.__arcadePerf;
      };
   }, [probe]);

   useFrame(() => {
      const { perf, stats } = probe;
      const info = gl.info;
      perf.calls = info.render.calls;
      perf.triangles = info.render.triangles;
      if (perf.calls > perf.maxCalls) perf.maxCalls = perf.calls;
      perf.geometries = info.memory.geometries;
      perf.textures = info.memory.textures;
      perf.programs = info.programs ? info.programs.length : 0;

      const now = performance.now();
      const gap = probe.last > 0 ? now - probe.last : -1;
      probe.last = now;
      if (gap >= 0 && gap < MAX_FRAME_GAP_MS && arcadeStore.getState().phase !== "paused") {
         pushFrame(stats, gap);
         perf.frames += 1;
      }
      if (now >= probe.refreshAt) {
         probe.refreshAt = now + REFRESH_MS;
         framePercentiles(stats, perf);
         perf.samples = stats.count;
         if (probe.overlay) {
            probe.overlay.textContent =
               `calls ${perf.calls} (max ${perf.maxCalls})  tris ${perf.triangles}\n` +
               `geo ${perf.geometries}  tex ${perf.textures}  prog ${perf.programs}\n` +
               `ms p50 ${perf.p50.toFixed(1)}  p95 ${perf.p95.toFixed(1)}  max ${perf.max.toFixed(1)}`;
         }
      }
   }, PROBE_PRIORITY);

   return null;
}
