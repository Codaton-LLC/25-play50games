"use client";

// The level's things: the hay targets (m2HayBaleTarget), the stone idols (m2StoneIdolTarget, tinted
// green / gold / jade on level 3, the one that pays double next pulsing on its ring), the score marker
// posts, the colour orbs (scoreOrb), Vexa's shard in the shrine, the rails the moving targets slide on,
// the drifting raft (level 4) and the monkeys. A broken target pops up and shrinks away in 0.35 s.
// Everything moving is one instanced pool, placed from the rules every frame (no React state).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, HAY_SCALE, IDOL_SCALE, MONKEY_SCALE, ORB_SIZE, POST_SCALE, GLB_SIZE, raftScale } from "./assets";
import { monkeyPos, raftX, targetPos, type TargetKind } from "./course";
import { COLORS } from "./look";
import { DISC, type DiscRun } from "./rules";

const UP = new Vector3(0, 1, 0);
const X_AXIS = new Vector3(1, 0, 0);
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const TP = { x: 0, z: 0 };
const IDOL_TINT = COLORS.idol.map((c) => new Color(c).lerp(new Color("#ffffff"), 0.35));
const WHITE = new Color("#ffffff");

/** The visual age of each broken target (s since it broke; -1 standing). */
function useBreaks(run: DiscRun) {
   const time = useGameTime();
   const at = useMemo(() => new Float64Array(run.course.targets.length).fill(-1), [run]);
   useFrame(() => {
      for (let i = 0; i < at.length; i++) if (run.hit[i] && at[i] < 0) at[i] = time.now;
   });
   return { at, time };
}

/** The pop-and-shrink of a broken target: 1 standing, a 1.25 overshoot, then gone after 0.35 s. */
export function breakScale(age: number): number {
   if (age < 0) return 1;
   if (age < 0.08) return 1 + 0.25 * (age / 0.08);
   const k = (age - 0.08) / 0.27;
   return k >= 1 ? 0 : 1.25 * (1 - k * k);
}

function TargetPool({ run, kind, breaks }: { run: DiscRun; kind: TargetKind; breaks: ReturnType<typeof useBreaks> }) {
   const ids = useMemo(() => run.course.targets.filter((t) => t.kind === kind).map((t) => t.id), [run, kind]);
   const asset = kind === "hay" ? ASSETS.hay : kind === "idol" ? ASSETS.idol : ASSETS.post;
   const scale = kind === "hay" ? HAY_SCALE : kind === "idol" ? IDOL_SCALE : POST_SCALE;
   if (!ids.length) return null;
   return (
      <DynamicInstancedModel
         asset={asset}
         count={ids.length}
         name={`targets-${kind}`}
         update={(i, m: Matrix4, color?: Color) => {
            const t = run.course.targets[ids[i]];
            const age = breaks.at[t.id] < 0 ? -1 : breaks.time.now - breaks.at[t.id];
            const s = breakScale(age) * scale;
            if (s <= 0) return false;
            targetPos(t, run.simMs, TP);
            // a hay target and an idol turn their face to the hero; the colour runs in idol order
            const yaw = Math.atan2(run.hero.x - TP.x, run.hero.z - TP.z);
            Q.setFromAxisAngle(UP, kind === "post" ? 0 : yaw);
            P.set(TP.x, age >= 0 ? age * 1.2 : 0, TP.z);
            S.set(s, s, s);
            m.compose(P, Q, S);
            if (color) color.copy(kind === "idol" && run.course.cfg.colours ? IDOL_TINT[t.colour] : WHITE);
         }}
      />
   );
}

/** Level 3: a coloured ring under each idol; the colour that pays double next pulses bright. */
function IdolRings({ run }: { run: DiscRun }) {
   const ids = useMemo(() => run.course.targets.filter((t) => t.kind === "idol").map((t) => t.id), [run]);
   const time = useGameTime();
   const tints = useMemo(() => COLORS.idol.map((c) => new Color(c)), []);
   if (!ids.length || !run.course.cfg.colours) return null;
   return (
      <DynamicInstanced
         count={ids.length}
         tinted
         name="idol-rings"
         update={(i, m: Matrix4, color?: Color) => {
            const t = run.course.targets[ids[i]];
            if (run.hit[t.id]) return false;
            targetPos(t, run.simMs, TP);
            const next = t.colour === run.nextColour;
            const s = next ? 1.05 + 0.12 * Math.sin(time.now * 7) : 0.9;
            Q.setFromAxisAngle(X_AXIS, -Math.PI / 2);
            P.set(TP.x, 0.03, TP.z);
            S.set(s, s, s);
            m.compose(P, Q, S);
            if (color) color.copy(tints[t.colour]).multiplyScalar(next ? 1.4 : 0.6);
         }}
      >
         <ringGeometry args={[0.85, 1.1, 32]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** The colour orbs and the shard: floating, spinning, at the disc's height. */
function Floaters({ run, breaks }: { run: DiscRun; breaks: ReturnType<typeof useBreaks> }) {
   const orbIds = useMemo(() => run.course.targets.filter((t) => t.kind === "orb").map((t) => t.id), [run]);
   const shard = useMemo(() => run.course.targets.find((t) => t.kind === "shard") ?? null, [run]);
   const shardRef = useRef<Mesh>(null);
   const orbScale = ORB_SIZE / GLB_SIZE.orb.y;
   useFrame(() => {
      const m = shardRef.current;
      if (!m || !shard) return;
      const age = breaks.at[shard.id] < 0 ? -1 : breaks.time.now - breaks.at[shard.id];
      const s = breakScale(age);
      m.visible = s > 0;
      m.position.set(shard.x, DISC.y + 0.15 * Math.sin(breaks.time.now * 2), shard.z);
      m.rotation.y = breaks.time.now * 1.5;
      m.scale.setScalar(Math.max(0.001, s * 0.32));
   });
   return (
      <group name="floaters">
         {orbIds.length > 0 && (
            <DynamicInstancedModel
               asset={ASSETS.orb}
               count={orbIds.length}
               name="orbs"
               update={(i, m: Matrix4) => {
                  const t = run.course.targets[orbIds[i]];
                  const age = breaks.at[t.id] < 0 ? -1 : breaks.time.now - breaks.at[t.id];
                  const s = breakScale(age) * orbScale;
                  if (s <= 0) return false;
                  Q.setFromAxisAngle(UP, breaks.time.now * 1.6 + i);
                  P.set(t.x, DISC.y - ORB_SIZE / 2 + 0.12 * Math.sin(breaks.time.now * 2.2 + i), t.z);
                  S.set(s, s, s);
                  m.compose(P, Q, S);
               }}
            />
         )}
         {shard && (
            <mesh ref={shardRef}>
               <octahedronGeometry args={[1, 0]} />
               <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.8} roughness={0.2} />
            </mesh>
         )}
      </group>
   );
}

/** The ruin rails the moving targets slide on: a bronze track per rail. */
function Rails({ run }: { run: DiscRun }) {
   const spots = useMemo<InstanceSpot[]>(
      () =>
         run.course.targets
            .filter((t) => t.rail)
            .map((t) => {
               const r = t.rail!;
               return { x: t.x, y: 0.04, z: t.z, rotY: Math.atan2(r.ax, r.az), sx: 0.28, sy: 0.06, sz: 2 * r.amp + 1.6 };
            }),
      [run],
   );
   if (!spots.length) return null;
   return (
      <Instanced spots={spots}>
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color="#9a7a3a" metalness={0.5} roughness={0.5} />
      </Instanced>
   );
}

/** The raft's drawn height (m): its deck 0.1 m over the walk. */
const RAFT_DECK = 0.18;

function Raft({ run }: { run: DiscRun }) {
   const ref = useRef<Group>(null);
   const raft = run.course.raft;
   useFrame(() => {
      const g = ref.current;
      if (!g || !raft) return;
      g.position.set(raftX(run.course, run.simMs), 0, raft.z);
   });
   if (!raft) return null;
   return (
      <group ref={ref}>
         {/* flattened so the deck sits at the hero's feet (y 0): the raft floats low in the canal */}
         <Model asset={ASSETS.raft} scale={[raftScale(raft.half), RAFT_DECK / GLB_SIZE.raft.y, raftScale(raft.half)]} position={[0, -0.08, 0]} />
      </group>
   );
}

function Monkeys({ run }: { run: DiscRun }) {
   const time = useGameTime();
   const n = run.course.monkeys.length;
   if (!n) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.monkey}
         count={n}
         name="monkeys"
         update={(i, m: Matrix4) => {
            const mk = run.course.monkeys[i];
            monkeyPos(mk, run.simMs, TP);
            const stunned = run.simMs < run.monkeyStun[i];
            const v = Math.cos((mk.omega * run.simMs) / 1000);
            Q.setFromAxisAngle(UP, Math.atan2(mk.ax * v, mk.az * v) + (stunned ? time.now * 9 : 0));
            P.set(TP.x, stunned ? 0 : Math.abs(Math.sin(time.now * 6 + i)) * 0.35, TP.z);
            S.setScalar(MONKEY_SCALE * (stunned ? 0.85 : 1));
            m.compose(P, Q, S);
         }}
      />
   );
}

/** The thing that is next: a soft white ring under every standing required target (where to aim). */
function TargetRings({ run }: { run: DiscRun }) {
   const ids = useMemo(() => run.course.targets.filter((t) => t.required && !(run.course.cfg.colours && t.kind === "idol")).map((t) => t.id), [run]);
   const ref = useRef<MeshBasicMaterial>(null);
   if (!ids.length) return null;
   return (
      <DynamicInstanced
         count={ids.length}
         name="target-rings"
         update={(i, m: Matrix4) => {
            const t = run.course.targets[ids[i]];
            if (run.hit[t.id]) return false;
            targetPos(t, run.simMs, TP);
            Q.setFromAxisAngle(X_AXIS, -Math.PI / 2);
            P.set(TP.x, 0.03, TP.z);
            S.set(1, 1, 1);
            m.compose(P, Q, S);
         }}
      >
         <ringGeometry args={[0.85, 1.0, 32]} />
         <meshBasicMaterial ref={ref} color="#fff7d6" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}

export function Course({ run }: { run: DiscRun }) {
   const breaks = useBreaks(run);
   return (
      <group name="course">
         <Rails run={run} />
         <TargetRings run={run} />
         <IdolRings run={run} />
         <TargetPool run={run} kind="hay" breaks={breaks} />
         <TargetPool run={run} kind="idol" breaks={breaks} />
         <TargetPool run={run} kind="post" breaks={breaks} />
         <Floaters run={run} breaks={breaks} />
         <Raft run={run} />
         <Monkeys run={run} />
      </group>
   );
}
