"use client";

// Keepers on screen: at most 3 skinned keepers (slots: the current stage's keepers, then next-stage
// keepers inside the camera window + 1 m), each with its torch and its vision cone clipped by the
// blockers (core Flashlight, C1), the searchlight on its tower, and the shared instanced overlays:
// khaki ground discs, the suspicion meter ring + fill and the "?" / "!" bubbles (billboards).
import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Flashlight } from "@/arcade3d/core/kit";
import { turnTowards } from "@/arcade3d/core/math";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { HumanoidModel, createPose, useHumanoidPose, wrapPhase } from "@/arcade3d/core/rig";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { ASSETS } from "./assets";
import { BLOCKERS, STAGE_KEEPERS, TOWER } from "./level";
import { keeperAmount, keeperPhaseStep, keeperPose } from "./poses";
import { COLORS, keeperPieces, torchPieces, useMerged } from "./Primitives";
import { SEARCHLIGHT, VISION, type Keeper, type RunState } from "./rules";

export const SLOTS = 3;
const CONE_HEIGHT = 1.1;
const LIGHT_HEIGHT = 4.5;
const CALM = new Color(COLORS.cone);
const ALERT = new Color(COLORS.alert);
const HEAD = 2.2;

/** Which keeper each slot shows this frame (-1 = none), written into `out`. */
export function assignSlots(run: RunState, aim: { x: number; z: number }, hx: number, hz: number, out: number[]): number[] {
   let n = 0;
   for (const i of STAGE_KEEPERS[run.stage]) if (n < SLOTS) out[n++] = i;
   if (run.stage < 2) {
      for (const i of STAGE_KEEPERS[run.stage + 1]) {
         const a = run.keepers[i].agent;
         if (n < SLOTS && Math.abs(a.x - aim.x) <= hx + 1 && Math.abs(a.z - aim.z) <= hz + 1) out[n++] = i;
      }
   }
   while (n < SLOTS) out[n++] = -1;
   return out;
}

const alerted = (k: Keeper) => k.meter > 0 || k.kind === "seen" || k.kind === "radio";

/** Recolours a Flashlight's two materials (only when its calm / alert state flips). */
function tintCone(group: Group | null, color: Color) {
   group?.traverse((o) => {
      const m = (o as Mesh).material as MeshBasicMaterial | undefined;
      if (m && "color" in m && (o as Mesh).isMesh) m.color.copy(color);
   });
}

function Torch() {
   const geometry = useMerged(torchPieces);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors roughness={0.4} metalness={0.3} emissive={COLORS.lampGlow} emissiveIntensity={0.15} />
      </mesh>
   );
}

function KeeperPrimitive() {
   const geometry = useMerged(keeperPieces);
   return (
      <mesh geometry={geometry}>
         <meshStandardMaterial vertexColors roughness={0.7} />
      </mesh>
   );
}

function Slot({ run, slots, index }: { run: RunState; slots: number[]; index: number }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const near = useRef<Group>(null);
   const far = useRef<Group>(null);
   const [g] = useState(() => ({ phase: 0, amount: 0, yaw: 0, keeper: -2, alert: false, cheer: 0 }));
   const [scratch] = useState(createPose);
   const torch = useMemo(() => <Torch />, []);
   const fallback = useMemo(() => <KeeperPrimitive />, []);
   // the pose driver also places the groups: at FRAME_PRIORITY.pose, before the Flashlight's clip (visuals)
   const pose = useHumanoidPose((p) => {
      const k = slots[index];
      const shown = k >= 0;
      if (body.current) body.current.visible = shown;
      if (near.current) near.current.visible = shown && run.keepers[k].stage < 2;
      if (far.current) far.current.visible = shown && run.keepers[k].stage === 2;
      if (!shown) { g.keeper = -1; return; }
      const kp = run.keepers[k];
      const a = kp.agent;
      const playing = useArcadeStore.getState().phase === "playing";
      const speed = playing ? Math.hypot(a.vx, a.vz) : 0;
      const dt = time.delta;
      if (g.keeper !== k) { g.keeper = k; g.yaw = a.yaw; g.phase = 0; g.amount = keeperAmount(speed); g.alert = !alerted(kp); }
      g.amount += (keeperAmount(speed) - g.amount) * (1 - Math.exp(-10 * dt));
      g.phase = wrapPhase(g.phase + keeperPhaseStep(g.amount, speed, dt));
      // waiting: the body keeps facing the way it came and the chest and head carry the look-around
      const facing = kp.patrol.wait > 0 ? kp.patrol.lookYaw ?? a.yaw : a.yaw;
      g.yaw = turnTowards(g.yaw, facing, 1 - Math.exp(-10 * dt));
      let look = (a.yaw - g.yaw) % (2 * Math.PI);
      if (look > Math.PI) look -= 2 * Math.PI;
      if (look < -Math.PI) look += 2 * Math.PI;
      look = Math.max(-1.2, Math.min(1.2, look));
      g.cheer += ((justCaught(run, k) ? 1 : 0) - g.cheer) * (1 - Math.exp(-6 * dt));
      keeperPose(g.phase, g.amount, look, time.now, g.cheer * 0.6, p, scratch);
      if (body.current) { body.current.position.set(a.x, 0, a.z); body.current.rotation.y = g.yaw; }
      if (near.current) { near.current.position.set(a.x, 0, a.z); near.current.rotation.y = a.yaw; }
      if (far.current) { far.current.position.set(a.x, 0, a.z); far.current.rotation.y = a.yaw; }
      const al = alerted(kp);
      if (al !== g.alert) { g.alert = al; tintCone(near.current, al ? ALERT : CALM); tintCone(far.current, al ? ALERT : CALM); }
   });
   return (
      <>
         <group ref={body} visible={false} name={`keeper-${index}`}>
            <HumanoidModel asset={ASSETS.keeper} pose={pose} attach={{ handR: torch }} fallback={fallback} />
         </group>
         <group ref={near} visible={false}>
            <Flashlight halfAngle={VISION.halfAngle} range={VISION.range[0]} height={CONE_HEIGHT} color={COLORS.cone} opacity={0.25} light={false} blockers={BLOCKERS} />
         </group>
         <group ref={far} visible={false}>
            <Flashlight halfAngle={VISION.halfAngle} range={VISION.range[2]} height={CONE_HEIGHT} color={COLORS.cone} opacity={0.25} light={false} blockers={BLOCKERS} />
         </group>
      </>
   );
}

/** The flashlight groups are the Flashlight's own; the slot wraps them, so they need no offset. */
function Searchlight({ run }: { run: RunState }) {
   const ref = useRef<Group>(null);
   const [g] = useState(() => ({ alert: false }));
   useFrame(() => {
      const o = ref.current;
      if (!o) return;
      o.position.set(TOWER.x, 0, TOWER.z);
      o.rotation.y = run.light.yaw;
      const al = run.light.meter > 0;
      if (al !== g.alert) { g.alert = al; tintCone(o, al ? ALERT : CALM); }
   }, FRAME_PRIORITY.pose);
   return <Flashlight ref={ref} halfAngle={SEARCHLIGHT.halfAngle} range={SEARCHLIGHT.range} height={LIGHT_HEIGHT} color={COLORS.cone} opacity={0.22} light intensity={30} blockers={BLOCKERS} />;
}

const glyph = (text: string, color: string) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.clearRect(0, 0, w, h);
   ctx.fillStyle = "rgba(15,23,42,0.85)";
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
   ctx.fill();
   ctx.fillStyle = color;
   ctx.font = `bold ${Math.round(h * 0.68)}px system-ui, sans-serif`;
   ctx.textAlign = "center";
   ctx.textBaseline = "middle";
   ctx.fillText(text, w / 2, h / 2 + 4);
};
const QUESTION = glyph("?", COLORS.cone);
const BANG = glyph("!", COLORS.alert);

const M_POS = new Vector3();
const M_SCALE = new Vector3();
const AMBER = new Color(COLORS.cone);
const CORAL = new Color(COLORS.alert);

/** Did keeper k (or -1, the searchlight) just catch the panda (the card is up, or the run was lost)? */
const justCaught = (run: RunState, k: number) => run.lastCatcher === k && (run.card > 0 || run.over === "lose");

/** Ground discs, meter rings and fills, and the bubbles: one instanced draw each for every keeper and the searchlight. */
function Overlays({ run, slots }: { run: RunState; slots: number[] }) {
   const time = useGameTime();
   const question = useCanvasTexture(64, 64, QUESTION);
   const bang = useCanvasTexture(64, 64, BANG);
   const [cam] = useState(() => new Quaternion());
   const [p] = useState(() => ({ x: 0, y: 0, z: 0, meter: 0, search: false, bang: false }));
   useFrame(({ camera }) => { cam.copy(camera.quaternion); }, FRAME_PRIORITY.pose);
   /** copy i: a slot's keeper (0..2) or the searchlight (3), written into p; false when none */
   const pick = (i: number): boolean => {
      if (i < SLOTS) {
         const k = slots[i];
         if (k < 0) return false;
         const kp = run.keepers[k];
         p.x = kp.agent.x; p.y = HEAD; p.z = kp.agent.z;
         p.meter = kp.stage === run.stage ? kp.meter : 0;
         p.search = kp.kind !== null;
         p.bang = justCaught(run, k) || kp.meter >= 0.66;
         return true;
      }
      if (run.stage !== 2) return false;
      p.x = TOWER.x; p.y = LIGHT_HEIGHT + 0.9; p.z = TOWER.z;
      p.meter = run.light.meter; p.search = false; p.bang = justCaught(run, -1) || run.light.meter >= 0.66;
      return true;
   };
   const disc = (i: number, m: Matrix4) => {
      if (i >= SLOTS || slots[i] < 0) return false;
      const a = run.keepers[slots[i]].agent;
      m.makeRotationX(-Math.PI / 2).setPosition(a.x, 0.02, a.z);
   };
   const board = (i: number, m: Matrix4, size: number, lift: number) => {
      const pop = 1 + 0.08 * Math.sin(time.now * 9 + i);
      m.compose(M_POS.set(p.x, p.y + lift, p.z), cam, M_SCALE.set(size * pop, size * pop, size * pop));
   };
   const ring = (i: number, m: Matrix4) => {
      if (!pick(i) || p.meter <= 0) return false;
      board(i, m, 0.62, 0);
   };
   const fill = (i: number, m: Matrix4, color: Color) => {
      if (!pick(i) || p.meter <= 0) return false;
      const s = 0.12 + 0.42 * p.meter;
      m.compose(M_POS.set(p.x, p.y, p.z), cam, M_SCALE.set(s, s, s));
      color.lerpColors(AMBER, CORAL, p.meter);
   };
   const ask = (i: number, m: Matrix4) => {
      if (!pick(i) || p.bang || !(p.meter > 0 || p.search)) return false;
      board(i, m, 0.55, 0.62);
   };
   const shout = (i: number, m: Matrix4) => {
      if (!pick(i) || !p.bang) return false;
      board(i, m, 0.62, 0.62);
   };
   return (
      <group name="keeper-overlays">
         <DynamicInstanced count={SLOTS} update={disc} name="keeper-discs">
            <ringGeometry args={[0.32, 0.46, 32]} />
            <meshBasicMaterial color={COLORS.khaki} transparent opacity={0.85} depthWrite={false} side={DoubleSide} />
         </DynamicInstanced>
         <DynamicInstanced count={SLOTS + 1} update={ring} name="meter-rings">
            <ringGeometry args={[0.46, 0.6, 32]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.7} depthTest={false} depthWrite={false} />
         </DynamicInstanced>
         <DynamicInstanced count={SLOTS + 1} update={fill} tinted name="meter-fills">
            <circleGeometry args={[1, 28]} />
            <meshBasicMaterial transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={SLOTS + 1} update={ask} name="bubbles-question">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={question} transparent depthTest={false} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={SLOTS + 1} update={shout} name="bubbles-bang">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={bang} transparent depthTest={false} depthWrite={false} toneMapped={false} blending={AdditiveBlending} />
         </DynamicInstanced>
      </group>
   );
}

export default function Keepers({ run, slots }: { run: RunState; slots: number[] }) {
   return (
      <group name="keepers">
         {Array.from({ length: SLOTS }, (_, i) => (
            <Slot key={i} run={run} slots={slots} index={i} />
         ))}
         <Searchlight run={run} />
         <Overlays run={run} slots={slots} />
      </group>
   );
}
