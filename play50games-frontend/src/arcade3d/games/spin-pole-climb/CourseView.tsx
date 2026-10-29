"use client";

// The course (no gameplay here: rules.ts owns it). The stone poles (m2RotatingPole / V2 sections stacked
// up each pole) turn with their spin, and jade chevrons on them point the way they turn: green when the
// spin carries you up, red when it treadmills you down, flashing before a level-3 pole flips. The spiral
// stairs are code-built stone steps (one instanced draw for every step of the level, a jade inlay on each
// edge) that turn moss-green behind the hero as he climbs: the card's colour returning. A grip ledge
// (m2GripLedge) marks every full lap. Caps: m2CircularPlatform (the goal, a gold ring) and
// m2MushroomCapTop (a rest point; the hidden m2CheckpointDisc sits on one). Sweeper arms (m2SweeperBar)
// ride their own rings; spike collars, spore vents and veils, Riko's cracked urn, the colour orbs
// (menu2 scoreOrb), Vexa's ghost pole, and a pulsing ring where a hop would land.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Color, ConeGeometry, MeshStandardMaterial, type Mesh, type Matrix4, type Vector3 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE, STEP_H, STEP_LEN } from "./assets";
import { TAU, dirTo, helixEnd, helixTop, isVeil, msToFlip, neighbours, sporeOn, stairY, stretchAt, sweeperAngle, wrapPi, type Course } from "./course";
import { COLORS } from "./look";
import { heroAngle, hopTarget, floorY, poleOmega, type Hop, type SpinRun } from "./rules";

const SECTION_H = 3;

interface Section {
   pole: number;
   y: number;
}

function sections(course: Course, wide: boolean): Section[] {
   const out: Section[] = [];
   for (const p of course.poles) {
      if (p.ghost || p.wide !== wide) continue;
      let top = 0;
      for (const h of course.helices) if (h.pole === p.id) top = Math.max(top, helixTop(h));
      for (let y = -1; y < top; y += SECTION_H) out.push({ pole: p.id, y });
   }
   return out;
}

interface Step {
   helix: number;
   a: number;
   x: number;
   y: number;
   z: number;
   len: number;
   r: number;
   ghost: boolean;
}

/** Every step of every stair (gaps left out), stone or ghost. */
export function stepsOf(course: Course): Step[] {
   const out: Step[] = [];
   for (const h of course.helices) {
      const p = course.poles[h.pole];
      const da = STEP_LEN / p.walk;
      const radial = p.walk + 0.45 - p.core;
      const rc = p.core + radial / 2;
      for (let a = h.a0 + da / 2; a < helixEnd(h); a += da) {
         if (course.gaps.some((g) => g.helix === h.id && a >= g.from - da / 3 && a <= g.to + da / 3)) continue;
         out.push({ helix: h.id, a, x: p.x + rc * Math.sin(a), y: stairY(h, a), z: p.z + rc * Math.cos(a), len: radial, r: rc, ghost: p.ghost });
      }
   }
   return out;
}

const STONE = new Color(COLORS.step);
const ASH = new Color("#a5a49c");
const MOSS = new Color(COLORS.moss);
const WITH = new Color(COLORS.with);
const AGAINST = new Color(COLORS.against);
const STILL = new Color(COLORS.gold);
const WHITE = new Color("#ffffff");

function Steps({ run, ghost }: { run: SpinRun; ghost: boolean }) {
   const steps = useMemo(() => stepsOf(run.course).filter((s) => s.ghost === ghost), [run.course, ghost]);
   // how far round each stair the hero has climbed: the steps behind him are mossy green
   const reached = useMemo(() => run.course.helices.map((h) => h.a0), [run.course]);
   const parts = useMemo<InstancePart[]>(() => {
      const slab = new BoxGeometry(1, 1, 1);
      slab.translate(0, -0.5, 0);
      const lip = new BoxGeometry(1, 0.22, 0.06);
      lip.translate(0, -0.11, 0.5);
      return [
         { geometry: slab, material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, transparent: ghost, opacity: ghost ? 0.45 : 1 }) },
         { geometry: lip, material: new MeshStandardMaterial({ color: ghost ? COLORS.ghost : COLORS.jade, emissive: ghost ? COLORS.ghost : COLORS.jadeDark, emissiveIntensity: 0.5, roughness: 0.4 }) },
      ];
   }, [ghost]);
   const tint = useMemo(() => new Color(), []);
   useFrame(() => {
      const h = run.hero;
      if (!h.cap && !h.hop.active && h.a > reached[h.helix]) reached[h.helix] = h.a;
      if (h.cap) reached[h.helix] = Number.POSITIVE_INFINITY;
   });
   const update = (i: number, m: Matrix4, c: Color) => {
      const s = steps[i];
      if (!s) return false;
      m.makeRotationY(s.a);
      m.scale({ x: STEP_LEN * (s.r / run.course.poles[run.course.helices[s.helix].pole].walk) * 1.05, y: STEP_H, z: s.len } as Vector3);
      m.setPosition(s.x, s.y, s.z);
      if (ghost) c.copy(WHITE);
      else c.copy(s.a <= reached[s.helix] ? tint.copy(ASH).lerp(MOSS, 0.75) : STONE);
   };
   if (steps.length === 0) return null;
   return <DynamicInstanced count={steps.length} update={update} parts={parts} tinted name={ghost ? "ghost-steps" : "steps"} />;
}

function Poles({ run }: { run: SpinRun }) {
   const c = run.course;
   const narrow = useMemo(() => sections(c, false), [c]);
   const wide = useMemo(() => sections(c, true), [c]);
   // each pole's drawn turn: integrated from its spin (the disc and Coilstone's phase 3 included)
   const turn = useMemo(() => c.poles.map(() => 0), [c]);
   const time = useGameTime();
   useFrame(() => {
      const dt = Math.min(0.05, time.delta);
      for (const p of c.poles) turn[p.id] += poleOmega(run, p.id) * dt;
   });
   const place = (list: Section[], g: { x: number; y: number; z: number }) => (i: number, m: Matrix4) => {
      const s = list[i];
      if (!s) return false;
      const p = c.poles[s.pole];
      m.makeRotationY(turn[p.id]);
      m.scale({ x: (p.core * 2) / g.x, y: SECTION_H / g.y, z: (p.core * 2) / g.z } as Vector3);
      m.setPosition(p.x, s.y, p.z);
   };
   return (
      <>
         {narrow.length > 0 && <DynamicInstancedModel asset={ASSETS.pole} count={narrow.length} update={place(narrow, GLB_SIZE.pole)} />}
         {wide.length > 0 && <DynamicInstancedModel asset={ASSETS.poleWide} count={wide.length} update={place(wide, GLB_SIZE.poleWide)} />}
         <Chevrons run={run} turn={turn} />
         {c.poles.filter((p) => p.ghost).map((p) => {
            let top = 0;
            for (const h of c.helices) if (h.pole === p.id) top = Math.max(top, helixTop(h));
            return (
               <mesh key={p.id} position={[p.x, top / 2 - 0.5, p.z]}>
                  <cylinderGeometry args={[p.core, p.core, top + 1, 18]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.35} transparent opacity={0.28} depthWrite={false} />
               </mesh>
            );
         })}
      </>
   );
}

/** Jade chevrons on every pole: they turn with it and show its spin (green with you, red against, gold still). */
function Chevrons({ run, turn }: { run: SpinRun; turn: number[] }) {
   const c = run.course;
   const spots = useMemo(() => {
      const out: { pole: number; y: number; k: number }[] = [];
      for (const p of c.poles) {
         if (p.ghost) continue;
         let top = 0;
         for (const h of c.helices) if (h.pole === p.id) top = Math.max(top, helixTop(h));
         for (let y = 1.5; y < top; y += 3) for (let k = 0; k < 3; k++) out.push({ pole: p.id, y, k });
      }
      return out;
   }, [c]);
   const time = useGameTime();
   const geo = useMemo(() => new ConeGeometry(0.16, 0.42, 3).rotateZ(-Math.PI / 2), []);
   const update = (i: number, m: Matrix4, col: Color) => {
      const s = spots[i];
      if (!s) return false;
      const p = c.poles[s.pole];
      const om = poleOmega(run, p.id);
      const a = turn[p.id] + (s.k * TAU) / 3 + s.y * 0.7;
      const r = p.core + 0.04;
      // a cone pointing round the pole the way it turns (+angle: tangent (cos a, -sin a))
      m.makeRotationY(a + (om >= 0 ? 0 : Math.PI));
      m.setPosition(p.x + r * Math.sin(a), s.y, p.z + r * Math.cos(a));
      const flip = msToFlip(p.spin, run.simMs);
      const warn = flip < 1000 && Math.sin(time.now * 24) > 0;
      col.copy(warn ? WHITE : Math.abs(om) < 0.01 ? STILL : om > 0 ? WITH : AGAINST);
   };
   return (
      <DynamicInstanced count={spots.length} update={update} tinted name="chevrons">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.55} roughness={0.4} />
      </DynamicInstanced>
   );
}

function Caps({ run }: { run: SpinRun }) {
   const c = run.course;
   const goals: InstanceSpot[] = [];
   const rests: InstanceSpot[] = [];
   for (const h of c.helices) {
      const p = c.poles[h.pole];
      const d = p.walk * 2 + 0.7;
      const top = helixTop(h);
      if (p.mushroom && !h.goal) rests.push({ x: p.x, y: top - (d / GLB_SIZE.mushroom.x) * GLB_SIZE.mushroom.y, z: p.z, sx: d / GLB_SIZE.mushroom.x, sy: d / GLB_SIZE.mushroom.x, sz: d / GLB_SIZE.mushroom.z });
      else goals.push({ x: p.x, y: top - 0.24 * (d / GLB_SIZE.platform.x), z: p.z, sx: d / GLB_SIZE.platform.x, sy: d / GLB_SIZE.platform.x, sz: d / GLB_SIZE.platform.z });
   }
   const disc = c.disc;
   let discAt: [number, number, number] | null = null;
   if (disc) {
      const h = c.helices[disc.helix];
      const p = c.poles[h.pole];
      discAt = [p.x + p.walk * 0.6 * Math.sin(disc.at), helixTop(h) + 0.02, p.z + p.walk * 0.6 * Math.cos(disc.at)];
   }
   return (
      <>
         {goals.length > 0 && <InstancedModel asset={ASSETS.platform} spots={goals} fallback={null} />}
         {rests.length > 0 && <InstancedModel asset={ASSETS.mushroom} spots={rests} fallback={null} />}
         {c.helices.filter((h) => h.goal && !c.cfg.boss).map((h) => {
            const p = c.poles[h.pole];
            return (
               <mesh key={h.id} position={[p.x, helixTop(h) + 0.06, p.z]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[p.walk + 0.1, p.walk + 0.35, 40]} />
                  <meshBasicMaterial color={COLORS.gold} transparent opacity={0.85} toneMapped={false} />
               </mesh>
            );
         })}
         {discAt && (
            <group position={discAt} scale={0.9 / GLB_SIZE.disc.x}>
               <Model asset={ASSETS.disc} />
            </group>
         )}
      </>
   );
}

function LapGrips({ run }: { run: SpinRun }) {
   const c = run.course;
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const h of c.helices) {
         const p = c.poles[h.pole];
         if (p.ghost) continue;
         for (let k = 1; k <= Math.floor(h.laps); k++) {
            const a = h.a0 + k * TAU;
            const r = p.walk + 0.35;
            out.push({ x: p.x + r * Math.sin(a), y: stairY(h, a) - 0.05, z: p.z + r * Math.cos(a), rotY: a, scale: 0.6 / GLB_SIZE.ledge.x });
         }
      }
      return out;
   }, [c]);
   if (spots.length === 0) return null;
   return <InstancedModel asset={ASSETS.ledge} spots={spots} fallback={null} />;
}

function Sweepers({ run }: { run: SpinRun }) {
   const c = run.course;
   const time = useGameTime();
   void time;
   const update = (i: number, m: Matrix4) => {
      const s = c.sweepers[i];
      if (!s) return false;
      const p = c.poles[s.pole];
      const a = sweeperAngle(s, run.simMs);
      const len = p.walk + 0.8 - p.core;
      const rc = p.core + len / 2;
      m.makeRotationY(a - Math.PI / 2);
      m.scale({ x: len / GLB_SIZE.sweeper.x, y: 1.1, z: 0.42 / GLB_SIZE.sweeper.z } as Vector3);
      m.setPosition(p.x + rc * Math.sin(a), s.y - 0.16, p.z + rc * Math.cos(a));
   };
   if (c.sweepers.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.sweeper} count={c.sweepers.length} update={update} />;
}

const RANGE = { from: 0, to: 0 };

function Hazards({ run }: { run: SpinRun }) {
   const c = run.course;
   const time = useGameTime();
   const spikeSlots = c.spikes.length * 4;
   const spikeGeo = useMemo(() => new ConeGeometry(0.14, 0.5, 6).translate(0, 0.25, 0), []);
   const spike = (i: number, m: Matrix4) => {
      const s = c.spikes[Math.floor(i / 4)];
      if (!s) return false;
      const h = c.helices[s.helix];
      const p = c.poles[h.pole];
      stretchAt(s, run.simMs, RANGE);
      const a = RANGE.from + ((RANGE.to - RANGE.from) * ((i % 4) + 0.5)) / 4;
      const r = p.walk - 0.2 + (i % 2) * 0.35;
      m.makeTranslation(p.x + r * Math.sin(a), stairY(h, a), p.z + r * Math.cos(a));
   };
   const puffSlots = c.spores.length * 3;
   const puff = (i: number, m: Matrix4, col: Color) => {
      const s = c.spores[Math.floor(i / 3)];
      if (!s) return false;
      const h = c.helices[s.helix];
      const p = c.poles[h.pole];
      const k = i % 3;
      const a = s.from + ((s.to - s.from) * (k + 0.5)) / 3;
      const on = sporeOn(s, run.simMs);
      const veil = isVeil(s);
      const wob = 1 + 0.12 * Math.sin(time.now * 3 + i);
      const size = veil ? 0.75 * wob : on ? 0.8 * wob : 0.18;
      m.makeScale(size, size * (veil ? 1.4 : 1.2), size);
      m.setPosition(p.x + p.walk * Math.sin(a), stairY(h, a) + (veil ? 0.9 : 0.6), p.z + p.walk * Math.cos(a));
      col.set(veil ? COLORS.veil : COLORS.spore);
   };
   return (
      <>
         {spikeSlots > 0 && (
            <DynamicInstanced count={spikeSlots} update={spike} name="spikes">
               <primitive object={spikeGeo} attach="geometry" />
               <meshStandardMaterial color={COLORS.spike} metalness={0.5} roughness={0.35} emissive="#7f1d1d" emissiveIntensity={0.25} />
            </DynamicInstanced>
         )}
         {puffSlots > 0 && (
            <DynamicInstanced count={puffSlots} update={puff} tinted name="spores">
               <sphereGeometry args={[1, 14, 10]} />
               <meshStandardMaterial color="#ffffff" emissive={COLORS.spore} emissiveIntensity={0.35} transparent opacity={0.42} depthWrite={false} />
            </DynamicInstanced>
         )}
      </>
   );
}

function Urns({ run }: { run: SpinRun }) {
   const c = run.course;
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      refs.current.forEach((m, i) => {
         if (m) m.visible = !run.urnBroken[i];
      });
   });
   return (
      <>
         {c.urns.map((u, i) => {
            const h = c.helices[u.helix];
            const p = c.poles[h.pole];
            const r = p.walk + 0.25;
            return (
               <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[p.x + r * Math.sin(u.at), stairY(h, u.at) + 0.45, p.z + r * Math.cos(u.at)]}>
                  <cylinderGeometry args={[0.3, 0.22, 0.9, 10]} />
                  <meshStandardMaterial color={COLORS.urn} roughness={0.85} emissive="#5a3a1a" emissiveIntensity={0.15} />
               </mesh>
            );
         })}
      </>
   );
}

function Orbs({ run }: { run: SpinRun }) {
   const c = run.course;
   const time = useGameTime();
   const s = ORB_SIZE / GLB_SIZE.orb.y;
   const update = (i: number, m: Matrix4) => {
      const o = c.orbs[i];
      if (!o || run.orbTaken[i]) return false;
      m.makeRotationY(time.now * 1.6 + i);
      m.scale({ x: s, y: s, z: s } as Vector3);
      m.setPosition(o.x, o.y - ORB_SIZE / 2 + 0.06 * Math.sin(time.now * 2.4 + i), o.z);
   };
   return <DynamicInstancedModel asset={ASSETS.orb} count={c.orbs.length} update={update} />;
}

/** A pulsing ring where a hop would land right now (the hero faces a neighbour pole). */
function HopMarker({ run }: { run: SpinRun }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   const hop = useMemo<Hop>(() => ({ active: false, t: 0, fromX: 0, fromY: 0, fromZ: 0, helix: 0, a: 0, cap: false, capA: 0, toX: 0, toY: 0, toZ: 0 }), []);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = run.hero;
      m.visible = false;
      if (h.hop.active || !h.grounded || run.ended !== null) return;
      const c = run.course;
      const hx = c.helices[h.helix];
      const pole = c.poles[hx.pole];
      const a = heroAngle(run);
      for (const q of neighbours(c, pole.id)) {
         const t = c.poles[q];
         const d = dirTo(pole, t.x, t.z);
         if (Math.abs(wrapPi(a - d)) > 0.5) continue;
         if (!hopTarget(run, Math.sin(d), Math.cos(d), hop)) continue;
         const th = c.helices[hop.helix];
         const tp = c.poles[th.pole];
         const la = hop.cap ? hop.capA : hop.a;
         m.visible = true;
         m.position.set(tp.x + tp.walk * Math.sin(la), (hop.cap ? helixTop(th) : stairY(th, hop.a)) + 0.08, tp.z + tp.walk * Math.cos(la));
         m.scale.setScalar(1 + 0.15 * Math.sin(time.now * 7));
         return;
      }
      void floorY;
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={3} visible={false}>
         <ringGeometry args={[0.35, 0.55, 28]} />
         <meshBasicMaterial color={COLORS.gold} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export function Course({ run }: { run: SpinRun }) {
   return (
      <>
         <Poles run={run} />
         <Steps run={run} ghost={false} />
         <Steps run={run} ghost />
         <LapGrips run={run} />
         <Caps run={run} />
         <Sweepers run={run} />
         <Hazards run={run} />
         <Urns run={run} />
         <Orbs run={run} />
         <HopMarker run={run} />
      </>
   );
}
