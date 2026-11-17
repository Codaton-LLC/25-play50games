"use client";

// The crops and everything that tells their timing: two crop pools (glowPod, gourd; nine bed slots
// plus four basket slots each, tinted by the pulse), the pulse rings (an outer ring by stage, an
// inner disc that fills towards the peak and turns gold in the perfect band), seed mounds on locked
// beds, the spore haze discs and the tool's cooldown ring at the farmer's feet. Each is one pool:
// about 9 draw calls in all. The frame callbacks only read the run state (no allocation).
import { useEffect, useMemo } from "react";
import { AdditiveBlending, CircleGeometry, Color, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, RingGeometry, SphereGeometry, Vector3 } from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { BASKET_LOCAL_POS } from "./poses";
import { BED_SURFACE, COLORS, HEIGHTS, cropBrightness, cropScale, groundAt } from "./looks";
import { useCropParts } from "./Primitives";
import { HARVEST, PLOT_COUNT, SPORES, cycleIndex, cyclePeak, growthAt, ringFill, stageAt, type CropKind, type RunState } from "./rules";

const POOL = PLOT_COUNT + HARVEST.capacity;
const CROP_Y = BED_SURFACE;
const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const UP = new Vector3(0, 1, 0);
const SCALE = { xz: 1, y: 1 };
const TINT = {
   mint: new Color(COLORS.mint),
   cyan: new Color(COLORS.cyan),
   gold: new Color(COLORS.gold),
   coral: new Color(COLORS.coral),
   dim: new Color("#64748b"),
   white: new Color("#ffffff"),
   olive: new Color("#a3a35a"),
   spore: new Color(COLORS.spore),
   seed: new Color(COLORS.seed),
};
const SCRATCH = new Color();
/** basket miniatures: 0.22 m, in a 2 x 2 nest inside the basket */
const MINI = 0.22;
const NEST = [
   [-0.05, -0.04],
   [0.05, -0.04],
   [-0.05, 0.05],
   [0.05, 0.05],
] as const;

function CropPool({ run, kind }: { run: RunState; kind: CropKind }) {
   const time = useGameTime();
   const parts = useCropParts(kind);
   const asset = kind === "glowPod" ? ASSETS.glowPod : ASSETS.gourd;
   const glow = kind === "glowPod" ? TINT.mint : TINT.cyan;
   const update = (i: number, m: Matrix4, color: Color) => {
      const t = run.time;
      if (i < PLOT_COUNT) {
         const plot = run.plots[i];
         if (plot.kind !== kind) return false;
         const stage = stageAt(plot, t);
         if (stage === "locked" || stage === "waiting" || (stage === "spent" && !plot.reserved)) return false;
         cropScale(growthAt(plot, t), SCALE);
         const k = cycleIndex(plot, t);
         let bob = 0;
         if (plot.missed === k) color.copy(TINT.dim);
         else if (stage === "overripe") color.copy(TINT.olive);
         else {
            const q = ringFill(plot, t);
            const pulse = stage === "ripe" ? 0.12 * Math.sin(time.now * 9) : 0;
            color.copy(TINT.white).lerp(glow, 0.25).multiplyScalar(cropBrightness(q) + pulse);
            bob = stage === "ripe" ? 0.02 * Math.sin(time.now * 9) : 0;
         }
         // the picked crop lifts out of the bed during the pick
         let lift = 0;
         if (plot.reserved && run.channel.active) lift = Math.min(1, (t - run.channel.start) / HARVEST.channelS) * 0.5;
         Q.setFromAxisAngle(UP, i * 1.7);
         m.compose(V.set(plot.x, CROP_Y + bob + lift, plot.z), Q, S.set(SCALE.xz, SCALE.y, SCALE.xz));
         return;
      }
      const slot = i - PLOT_COUNT;
      if (slot >= run.cargoCount || run.cargo[slot].kind !== kind) return false;
      const f = run.farmer;
      const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
      const lx = BASKET_LOCAL_POS.x + NEST[slot][0], lz = BASKET_LOCAL_POS.z + NEST[slot][1];
      color.copy(run.cargo[slot].perfect ? TINT.gold : TINT.white);
      Q.setFromAxisAngle(UP, f.yaw + slot);
      m.compose(V.set(f.x + c * lx + s * lz, BASKET_LOCAL_POS.y - 0.06 + groundAt(f.x, f.z), f.z - s * lx + c * lz), Q, S.set(MINI, MINI, MINI));
   };
   return <DynamicInstancedModel asset={asset} count={POOL} update={update} fallbackParts={parts} tinted />;
}

function usePulseParts() {
   const parts = useMemo(() => {
      const flat = new Matrix4().makeRotationX(-Math.PI / 2);
      const ring = new RingGeometry(0.86, 1.0, 40).applyMatrix4(flat);
      const disc = new CircleGeometry(0.8, 32).applyMatrix4(flat);
      const spore = new CircleGeometry(SPORES.radius, 40).applyMatrix4(flat);
      const cool = new RingGeometry(0.46, 0.54, 32).applyMatrix4(flat);
      const seed = new SphereGeometry(0.16, 12, 8).scale(1, 0.45, 1);
      const additive = (opacity: number) => new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, toneMapped: false });
      return {
         ring: [{ geometry: ring, material: additive(0.75) }] as InstancePart[],
         disc: [{ geometry: disc, material: additive(0.4) }] as InstancePart[],
         spore: [{ geometry: spore, material: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.28, depthWrite: false }) }] as InstancePart[],
         cool: [{ geometry: cool, material: additive(0.8) }] as InstancePart[],
         seed: [{ geometry: seed, material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.8, emissive: COLORS.seed, emissiveIntensity: 0.25 }) }] as InstancePart[],
      };
   }, []);
   useEffect(
      () => () => {
         for (const list of Object.values(parts)) for (const p of list) {
            p.geometry.dispose();
            (p.material as MeshBasicMaterial).dispose();
         }
      },
      [parts],
   );
   return parts;
}

export function Crops({ run, reducedMotion }: { run: RunState; reducedMotion: boolean }) {
   const time = useGameTime();
   const parts = usePulseParts();

   const placeRing = (i: number, m: Matrix4, color: Color) => {
      const plot = run.plots[i], t = run.time;
      const stage = stageAt(plot, t);
      if (stage === "locked") return false;
      const k = cycleIndex(plot, t);
      const base = plot.kind === "glowPod" ? TINT.mint : TINT.cyan;
      // a burst (missed) bed is coral; a waiting or spent bed keeps a faint ring of its crop's colour
      // (a grey ring added onto the plum soil read as coral under the sunset light)
      if (plot.missed === k) color.copy(TINT.coral).multiplyScalar(0.6);
      else if (stage === "waiting" || stage === "spent") color.copy(base).multiplyScalar(0.22);
      else if (stage === "ripe") {
         const perfect = Math.abs(t - cyclePeak(plot, k)) <= HARVEST.perfectHalf;
         const pulse = reducedMotion ? 0.65 : 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(time.now * 10));
         color.copy(perfect ? TINT.gold : base).multiplyScalar(perfect ? 1 : 0.6 + pulse * 0.4);
      } else color.copy(base).multiplyScalar(0.25 + 0.5 * ringFill(plot, t));
      m.makeTranslation(plot.x, HEIGHTS.ring, plot.z);
   };
   const placeDisc = (i: number, m: Matrix4, color: Color) => {
      const plot = run.plots[i], t = run.time;
      const stage = stageAt(plot, t);
      const k = cycleIndex(plot, t);
      if (stage === "locked" || stage === "waiting" || stage === "spent" || plot.missed === k) return false;
      const q = ringFill(plot, t);
      if (q <= 0.01) return false;
      const perfect = stage === "ripe" && Math.abs(t - cyclePeak(plot, k)) <= HARVEST.perfectHalf;
      color.copy(perfect ? TINT.gold : plot.kind === "glowPod" ? TINT.mint : TINT.cyan).multiplyScalar(stage === "overripe" ? 0.2 : 0.35 + 0.35 * q);
      m.makeScale(q, 1, q).setPosition(plot.x, HEIGHTS.ring + 0.005, plot.z);
   };
   const placeSeed = (i: number, m: Matrix4, color: Color) => {
      const plot = run.plots[i], t = run.time;
      const stage = stageAt(plot, t);
      if (stage !== "locked" && stage !== "waiting") return false;
      color.copy(stage === "locked" ? TINT.dim : TINT.seed);
      m.makeTranslation(plot.x, CROP_Y, plot.z);
   };
   const placeSpore = (i: number, m: Matrix4, color: Color) => {
      const plot = run.plots[i], t = run.time;
      if (!(t >= plot.sporeFrom && t < plot.sporeTo)) return false;
      const age = (t - plot.sporeFrom) / (plot.sporeTo - plot.sporeFrom); // the level's spore life
      const fade = age > 0.8 ? (1 - age) / 0.2 : 1;
      const grow = Math.min(1, age * 8);
      color.copy(SCRATCH.copy(TINT.spore)).multiplyScalar(0.5 + 0.5 * fade);
      m.makeScale(grow, 1, grow).setPosition(plot.x, HEIGHTS.spore, plot.z);
   };
   const placeCool = (_i: number, m: Matrix4, color: Color) => {
      const left = run.cooldownUntil - run.time;
      if (left <= 0) return false;
      const k = left / HARVEST.cooldownS;
      color.copy(TINT.coral).multiplyScalar(0.4 + 0.6 * k);
      m.makeScale(0.6 + 0.4 * k, 1, 0.6 + 0.4 * k).setPosition(run.farmer.x, HEIGHTS.cooldown, run.farmer.z);
   };

   return (
      <group name="crops">
         <CropPool run={run} kind="glowPod" />
         <CropPool run={run} kind="gourd" />
         <DynamicInstanced count={PLOT_COUNT} update={placeRing} parts={parts.ring} name="rings" tinted />
         <DynamicInstanced count={PLOT_COUNT} update={placeDisc} parts={parts.disc} name="fills" tinted />
         <DynamicInstanced count={PLOT_COUNT} update={placeSeed} parts={parts.seed} name="seeds" tinted />
         <DynamicInstanced count={PLOT_COUNT} update={placeSpore} parts={parts.spore} name="spores" tinted />
         <DynamicInstanced count={1} update={placeCool} parts={parts.cool} name="cooldown" tinted />
      </group>
   );
}
