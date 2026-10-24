"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { TargetMarkers, type MarkerTarget } from "@/arcade3d/core/hud";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { visibleGoblin } from "./Goblins";
import { LADDER, threatenedCrew, type CastleRun } from "./rules";

const LANE_X = [-3, 0, 3];
export function Markers({ run }: { run: CastleRun }) {
   const { gl, camera, size } = useThree();
   const targets = useMemo<MarkerTarget[]>(() => Array.from({ length: 40 }, () => ({ x: 0, y: 0, z: 0, hidden: true })), []);
   const scratch = useMemo(() => ({ p: new Vector3(), corner: new Vector3() }), []);
   const pixels = useMemo(() => ({ x: Array.from({ length: Math.ceil(size.width) + 1 }, (_, n) => `${n}px`), y: Array.from({ length: Math.ceil(size.height) + 1 }, (_, n) => `${n}px`) }), [size.width, size.height]);
   const dom = useMemo(() => {
      const layer = document.createElement("div"); layer.setAttribute("aria-hidden", "true");
      layer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
      const nodes = Array.from({ length: 42 }, (_, i) => {
         const node = document.createElement("div");
         node.style.cssText = "position:absolute;width:24px;height:24px;margin:-12px;border:2px solid #f8fafc;border-radius:50%;box-sizing:border-box;box-shadow:0 0 0 1px #0f172a;display:none;";
         if (i >= 40) { node.textContent = i === 40 ? "+" : "!"; node.style.textAlign = "center"; node.style.color = "#f8fafc"; node.style.lineHeight = "20px"; }
         layer.appendChild(node); return node;
      });
      return {
         layer, nodes, x: new Int32Array(42).fill(-9999), y: new Int32Array(42).fill(-9999),
         display: Array<string>(42).fill("none"), border: Array<string>(42).fill("#f8fafc"),
      };
   }, []);
   useEffect(() => { gl.domElement.parentElement?.appendChild(dom.layer); return () => dom.layer.remove(); }, [dom, gl]);
   const place = (slot: number, x: number, y: number, z: number, visible: boolean, lift = 0) => {
      const node = dom.nodes[slot]; scratch.p.set(x, y, z).project(camera);
      const on = visible && Math.abs(scratch.p.x) <= 1 && Math.abs(scratch.p.y) <= 1 && scratch.p.z < 1;
      const display = on ? "block" : "none";
      if (display !== dom.display[slot]) { node.style.display = display; dom.display[slot] = display; }
      if (!on) return;
      const px = Math.round((scratch.p.x + 1) * size.width / 2), py = Math.max(12, Math.round((1 - scratch.p.y) * size.height / 2) - lift);
      if (px !== dom.x[slot]) { node.style.left = pixels.x[px]; dom.x[slot] = px; }
      if (py !== dom.y[slot]) { node.style.top = pixels.y[py]; dom.y[slot] = py; }
   };
   useFrame(() => {
      const phase = useArcadeStore.getState().phase, on = phase === "playing" || phase === "paused";
      for (let i = 0; i < 40; i++) {
         const g = visibleGoblin(run, i), t = targets[i];
         const living = !!g && g.status !== "dead" && g.status !== "waiting" && g.status !== "escaped";
         t.hidden = !living; let small = false;
         if (g && living) {
            const k0 = g.status === "climb" ? LADDER.climberScale : 1;
            t.x = g.x; t.y = g.y + 0.8 * k0; t.z = g.z; let lo = Infinity, hi = -Infinity;
            for (let k = 0; k < 8; k++) {
               scratch.corner.set(g.x + (k & 1 ? 0.592 : -0.592) * k0, g.y + (k & 2 ? 1.6 * k0 : 0), g.z + (k & 4 ? 0.3189095 : -0.3189095) * k0).project(camera);
               const py = (1 - scratch.corner.y) * size.height / 2; lo = Math.min(lo, py); hi = Math.max(hi, py);
            }
            small = hi - lo < 24 || g.z < -4.5;
         }
         place(i, t.x, t.y, t.z, on && living && small);
      }
      place(40, run.aim.x, 0.04, -run.aim.y, on);
      // the "!" sits above the ladder and its highest climber (centre 24 px over their top), never on them
      const crew = threatenedCrew(run); let top = 0.08 + LADDER.height + 0.15;
      if (crew >= 0) for (const g of run.goblins) if (g.crew === crew && g.status === "climb") top = Math.max(top, g.y + 1.6 * LADDER.climberScale);
      place(41, crew >= 0 ? LANE_X[run.crews[crew].lane] : 0, top, 2, on && crew >= 0, 24);
      const border = run.ready <= run.time ? "#34d399" : "#f8fafc";
      if (border !== dom.border[40]) { dom.nodes[40].style.borderColor = border; dom.border[40] = border; }
   });
   return <TargetMarkers targets={targets} size={24} color="#fbbf24" />;
}
