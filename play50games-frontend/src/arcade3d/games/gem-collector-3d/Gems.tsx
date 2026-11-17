"use client";

// Every gem in one tinted pool (m2FacetGem, the plain faceted gem, upright): on the floor they bob and spin,
// loose (cut) gems blink as they fade, magnet-trail gems stay hidden until Zuno's magnet pulls them
// out of the rim, and the train's links trail each hero at their link positions, tilted along the path,
// strung on a glowing tether. Multiplayer passes every player's run (they share the gem states).
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, Matrix4 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { MAX_LINKS } from "./arena";
import { GEM, type GemRun } from "./rules";
import { ASSETS } from "./assets";
import { COLORS, GEM_TINT, LOOKS } from "./look";
import type { VisualClock } from "./Vault";

const TINT = { clear: new Color(GEM_TINT.clear), frost: new Color(GEM_TINT.frost), gold: new Color(GEM_TINT.gold) };
const BLINK = new Color("#ffffff");
const LINK_Y = 0.25;

/** Where each train gem is this frame: gem index -> (x, z, heading), filled before the pool updates. */
interface TrainSlots {
   x: Float32Array;
   z: Float32Array;
   yaw: Float32Array;
   on: Uint8Array;
}

export function Gems({ runs, clock }: { runs: GemRun[]; clock: VisualClock }) {
   const first = runs[0];
   const a = first.arena;
   const n = a.gems.length;
   const slots = useMemo<TrainSlots>(() => ({ x: new Float32Array(n), z: new Float32Array(n), yaw: new Float32Array(n), on: new Uint8Array(n) }), [n]);
   const glow = LOOKS[a.level].gemGlow;

   // the train slots, before the pool's update (FRAME_PRIORITY.visuals)
   useFrame(() => {
      slots.on.fill(0);
      for (const r of runs) {
         for (let k = 0; k < r.n; k++) {
            const gi = r.links[k];
            const x = r.linkPos[k * 2];
            const z = r.linkPos[k * 2 + 1];
            const px = k === 0 ? r.hero.x : r.linkPos[(k - 1) * 2];
            const pz = k === 0 ? r.hero.z : r.linkPos[(k - 1) * 2 + 1];
            slots.x[gi] = x;
            slots.z[gi] = z;
            slots.yaw[gi] = Math.atan2(px - x, pz - z);
            slots.on[gi] = 1;
         }
      }
   }, FRAME_PRIORITY.visuals - 0.01);

   const update = (i: number, m: Matrix4, color?: Color) => {
      const st = first.gemState[i];
      const ms = Math.max(0, clock.ms);
      const gem = a.gems[i];
      if (st === GEM.train) {
         if (!slots.on[i]) return false;
         m.makeRotationY(slots.yaw[i] + ms / 500);
         m.setPosition(slots.x[i], LINK_Y + 0.08 * Math.sin(ms / 180 + i), slots.z[i]);
         if (color) color.copy(TINT[gem.kind]);
         return;
      }
      if (st !== GEM.floor && st !== GEM.loose) return false;
      if (gem.hidden && !first.revealed[i]) return false;
      const left = st === GEM.loose ? first.fadeAt[i] - ms : Infinity;
      if (left < 1000 && Math.floor(ms / 120) % 2 === 0) return false;
      const bob = 0.18 + 0.12 * Math.sin(ms / 420 + i * 0.7);
      m.makeRotationY(ms / 700 + i);
      m.setPosition(first.gx[i], first.gy[i] + bob, first.gz[i]);
      if (color) {
         color.copy(TINT[gem.kind]);
         if (st === GEM.loose) color.lerp(BLINK, 0.4);
         if (glow > 0.5) color.multiplyScalar(1.25);
      }
   };
   return <DynamicInstancedModel asset={ASSETS.gem} count={n} update={update} tinted name="gems" />;
}

/** The glowing tether through each hero's train (head first). */
export function Tethers({ runs, colors }: { runs: GemRun[]; colors?: readonly string[] }) {
   return (
      <>
         {runs.map((r, i) => (
            <Tether key={i} run={r} color={colors?.[i] ?? COLORS.link} />
         ))}
      </>
   );
}

function Tether({ run, color }: { run: GemRun; color: string }) {
   const line = useMemo(() => {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array((MAX_LINKS + 1) * 3), 3));
      g.setDrawRange(0, 0);
      const l = new Line(g, new LineBasicMaterial({ color, transparent: true, opacity: 0.85, toneMapped: false }));
      l.frustumCulled = false;
      return l;
   }, [color]);
   useFrame(() => {
      const geom = line.geometry;
      const pos = geom.getAttribute("position") as BufferAttribute;
      const arr = pos.array as Float32Array;
      const h = run.hero;
      arr[0] = h.x;
      arr[1] = h.y + LINK_Y + 0.1;
      arr[2] = h.z;
      for (let k = 0; k < run.n; k++) {
         arr[(k + 1) * 3] = run.linkPos[k * 2];
         arr[(k + 1) * 3 + 1] = LINK_Y + 0.1;
         arr[(k + 1) * 3 + 2] = run.linkPos[k * 2 + 1];
      }
      pos.needsUpdate = true;
      geom.setDrawRange(0, run.n > 0 ? run.n + 1 : 0);
   }, FRAME_PRIORITY.visuals);
   return <primitive object={line} />;
}
