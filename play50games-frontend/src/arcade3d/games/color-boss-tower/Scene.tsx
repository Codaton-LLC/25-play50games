"use client";

// Color Boss Tower's scene: the run (rules.ts) stepped in useRunFrame, the tower (Tower.tsx), the
// guardian (Boss.tsx), the five heroes (Hero.tsx: World 6's tag-switch; keys 1-5 / T and the HUD's
// portrait strip through menu2/heroTag/tagInput), the orbit camera between the shaft and the hero
// (camera.ts), the intro (core/intro, index.tsx `intro: true`), a ring on the next claw to charge, the
// cannon beams, and the juice (menu2/juice): a colour swirl on every tag, "Hand-off!" for a tag inside
// the combo window, the claw's charge, the plate opening, the hit, the sweep's dust, the knocks, the
// crumble, Prism Lock, the glyphs and the slow-mo finish (visual only). Remounted per run (runId).
// Local multiplayer renders MultiScene.tsx.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from "three";
import { arcadeStore, useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { comboFlow } from "@/arcade3d/menu2/combo/combo";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { ORBIT_DRIVER_PRIORITY, OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import { TAG_COLOUR, TAG_ORDER, isLocked } from "@/arcade3d/menu2/heroTag/rules";
import { takeTag, useTagKeys } from "@/arcade3d/menu2/heroTag/tagInput";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import { Tower, cannonMuzzle, ringPoint, CLAW_R } from "./Tower";
import { Boss, bossChest, bossFeetY, type BossView } from "./Boss";
import { Heroes, createHeroAnim, type HeroAnim } from "./Hero";
import { FOV, FOV_PORTRAIT, TOWER_COLLISION, introKeyframes, orbitLookUp, orbitPivot, orbitScale, playCamera, steerTowerCamera, towerOrbit } from "./camera";
import { ORB_BONUS_MS, STAT, createRun, createStepInput, isGrand, step, type CbtRun, type StepEvents } from "./rules";
import { R_PATH, type TowerSpec } from "./levels";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput, nextClaw } from "./bot";
import { COMBO, GLYPH_MS, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import { COLORS, TAG_HEX } from "./look";
import MultiScene from "./MultiScene";

/** Preview builds only: `?autoplay=1` lets the honest bot (bot.ts) play, for screenshots and checks. */
function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

const CD_STAT = { riko: STAT.cdRiko, nami: STAT.cdNami, kiro: STAT.cdKiro, zuno: STAT.cdZuno, vexa: STAT.cdVexa } as const;

/** The HUD's numbers that change during a run (written only when they change). */
export function publishRun(run: CbtRun): void {
   const store = useArcadeStore.getState();
   const set = (k: string, v: number) => {
      if (store.stats[k] !== v) store.setStat(k, v);
   };
   const b = run.boss;
   set(STAT.orbs, run.orbs);
   set(STAT.hero, TAG_ORDER.indexOf(run.tag.active));
   set(STAT.hearts, run.hearts);
   for (const id of TAG_ORDER) set(CD_STAT[id], Math.ceil(run.tag.cooldown[id] / 100));
   set(STAT.tagCd, run.simMs - run.tag.lastTagMs < run.tag.tagCooldownMs ? 1 : 0);
   set(STAT.locked, isLocked(run.tag, run.simMs) ? 1 : 0);
   let ready = 0;
   for (const c of run.claws) if (c.chargedAt >= 0) ready++;
   set(STAT.ready, ready);
   set(STAT.climb, Math.max(0, Math.min(100, Math.round((run.hero.y / Math.max(1, run.tower.topY)) * 100))));
   set(STAT.comboChain, run.combo.chain);
   set(STAT.comboMult, Math.round(run.combo.multiplier * 100));
   set(STAT.comboFlow, Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10));
   set(STAT.comboMs, run.combo.bonusTotal);
   set(STAT.bossHp, b.hp);
   set(STAT.bossPhase, b.phase);
   set(STAT.bossOpen, b.step === "vulnerable" ? 1 : 0);
   set(STAT.bossFlash, b.flashMs > 0 ? 1 : 0);
   set(STAT.bossOn, b.step === "intro" ? 0 : 1);
   set(STAT.glyph, isGrand(run) && b.phase === 2 && b.step === "vulnerable" ? Math.min(4, Math.floor(b.stepMs / GLYPH_MS)) : -1);
}

/** A cannon beam: from the muzzle to his chest, for a moment. */
export interface Beam {
   from: { x: number; y: number; z: number };
   to: { x: number; y: number; z: number };
   color: string;
   until: number;
}

function Simulation({ run, anim, won, orbit, beam, view }: { run: CbtRun; anim: HeroAnim; won: { current: boolean }; orbit: OrbitState; beam: Beam; view: BossView }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useState(() => (autoplayRequested() ? createBot(run) : null));
   const lastFrame = useRef(1000 / 60);
   const chest = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const feet = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const boss = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;
   const playing = useArcadeStore((s) => s.phase === "playing");
   useTagKeys(playing);

   const react = (ev: StepEvents) => {
      const store = useArcadeStore.getState();
      const h = run.hero;
      const now = time.now;
      const th = h.a / R_PATH;
      ringPoint(th, R_PATH, h.y + 1.1, chest);
      ringPoint(th, R_PATH, h.y + 0.1, feet);
      bossChest(run, view.feet, boss);
      const accent = TAG_HEX[TAG_COLOUR[run.tag.active]];
      if (ev.tagged) {
         anim.outHero = run.tag.previous;
         anim.outA = h.a;
         anim.outY = h.y;
         anim.outMs = run.simMs;
         juice.burst("aura", chest, 22, { color: accent });
         juice.burst("pickup", chest, 14, { color: accent, vy: 2 });
         playSfx("whoosh", { volume: 0.45, pitch: 1.3 + TAG_ORDER.indexOf(run.tag.active) * 0.08 });
         if (ev.handOff) {
            juice.popup({ x: chest.x, y: chest.y + 0.7, z: chest.z }, "Hand-off!", { color: accent, size: 0.07 });
            playSfx("combo", { pitch: 1.4, volume: 0.4 });
         }
      }
      if (ev.tagRefused) playSfx("thud", { volume: 0.25, pitch: 1.8 });
      if (ev.locked) {
         juice.popup({ x: chest.x, y: chest.y + 1, z: chest.z }, "Prism Lock!", { color: "#f0abfc", size: 0.08 });
         playSfx("chime", { pitch: 0.6, volume: 0.5 });
      }
      if (ev.airJumped) {
         anim.airJumpAt = now;
         juice.burst("dust", feet, 12, { color: "#ffffff" });
         playSfx("jump", { volume: 0.6, pitch: 1.25 });
      } else if (ev.jumped) {
         anim.jumpAt = now;
         playSfx("jump", { volume: 0.5 });
      }
      if (ev.landed) {
         anim.landAt = now;
         juice.burst("dust", feet, 6, { color: "#d6d3d1", vy: 1.2 });
      }
      if (ev.powered) {
         juice.burst("aura", chest, 14, { color: accent });
         playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      }
      if (ev.charged >= 0) {
         const cl = run.claws[ev.charged];
         const at = ringPoint(cl.a / R_PATH, CLAW_R, cl.y, { x: 0, y: 0, z: 0 });
         const hex = TAG_HEX[cl.colour];
         juice.burst("checkpoint", at, 30, { color: hex });
         juice.popup(at, "Charged!", { color: hex, size: 0.07 });
         playSfx("chime", { pitch: 1.3 });
      }
      if (ev.bossOpen) {
         juice.popup({ x: boss.x, y: boss.y + 1.4, z: boss.z }, isGrand(run) && run.boss.phase === 2 ? "Glyphs!" : "Plate open!", { color: "#fef9c3", size: 0.08 });
         playSfx("chime", { pitch: 0.9, volume: 0.45 });
      }
      if (ev.hit) {
         if (ev.fired >= 0) {
            cannonMuzzle(run, ev.fired, beam.from);
            beam.color = TAG_HEX[run.claws[ev.fired].colour];
         } else {
            beam.from.x = chest.x;
            beam.from.y = chest.y;
            beam.from.z = chest.z;
            beam.color = "#ffffff";
         }
         beam.to.x = boss.x;
         beam.to.y = boss.y;
         beam.to.z = boss.z;
         beam.until = now + 0.35;
         juice.burst("hit", boss, 34, { color: beam.color });
         juice.popup({ x: boss.x, y: boss.y + 1.2, z: boss.z }, "HIT!", { color: "#fef08a", size: 0.1 });
         juice.shake(0.32);
         juice.hitStop(90);
         playSfx("thud", { pitch: 1.2 });
      }
      if (ev.glyph >= 0) {
         const hex = TAG_HEX[TAG_COLOUR[TAG_ORDER[ev.glyph]]];
         juice.burst("pickup", boss, 18, { color: hex });
         playSfx("pickup", { pitch: 1 + ev.glyph * 0.15 });
      }
      if (ev.bossDefeat) {
         juice.burst("checkpoint", boss, 120, { color: "#fde047" });
         juice.popup({ x: boss.x, y: boss.y + 2, z: boss.z }, "Guardian down!", { color: "#fde047", size: 0.1 });
         juice.shake(0.5);
         juice.hitStop(140);
      }
      if (ev.bossAttack) {
         juice.shake(0.12);
         playSfx("whoosh", { volume: 0.55, pitch: 0.55 });
      }
      if (ev.knocked) {
         anim.hurtAt = now;
         anim.hurtDir = Math.sign(h.va) || 1;
         juice.burst("hit", chest, 14, { color: "#94a3b8" });
         juice.shake(0.2);
         playSfx("thud", { volume: 0.5, pitch: 0.8 });
      }
      if (ev.shielded) juice.burst("aura", chest, 10, { color: accent });
      if (ev.crumbled >= 0) {
         const c = ev.crumbled;
         const at = ringPoint(run.tower.la[c] / R_PATH, R_PATH, run.tower.ly[c], { x: 0, y: 0, z: 0 });
         juice.burst("dust", at, 24, { color: "#a8a29e", vy: -1 });
         playSfx("thud", { volume: 0.35, pitch: 0.7 });
      }
      if (ev.respawned) {
         juice.burst("pickup", chest, 20, { color: accent });
         playSfx("pop");
      }
      if (ev.checkpoint >= 0) {
         juice.burst("checkpoint", chest, 30, { color: "#7dd3fc" });
         juice.popup(chest, "Checkpoint", { color: "#bae6fd", size: 0.06 });
         playSfx("chime");
      }
      if (ev.orb >= 0) {
         const o = run.tower.orbs[ev.orb];
         const at = ringPoint(o.a / R_PATH, R_PATH, o.y, { x: 0, y: 0, z: 0 });
         juice.burst("pickup", at, 12, { color: COLORS.orb });
         juice.popup(at, `-${(ORB_BONUS_MS / 1000).toFixed(2)} s`, { color: COLORS.orb });
         playSfx("pickup", { pitch: 1 + run.orbs * 0.05 });
      }
      if (ev.secret) {
         const k = SECRETS[run.level].findIndex((s) => s.id === ev.secret);
         const spec = SECRETS[run.level][k];
         if (spec) {
            const color = spec.kind === "shard" ? COLORS.shard : COLORS.sticker;
            juice.burst("checkpoint", chest, 30, { color });
            juice.popup(chest, `${spec.name}!`, { color, size: 0.07 });
            juice.hitStop(40);
            playSfx("chime", { pitch: 1.5 });
         }
      }
      publishRun(run);
      if (!ev.ended || won.current) return;
      won.current = true;
      if (run.ended === "win") {
         anim.winAt = now;
         juice.burst("checkpoint", chest, 90, { color: accent });
         playSfx("chime", { pitch: 0.8 });
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else {
         levelEndStats(run, userRef.current);
         store.end(run.ended === "lose" ? "lose" : "timeup");
      }
   };

   useRunFrame((_state, dt) => {
      const i = input.current;
      stepInput.moveX = i.moveX;
      stepInput.moveZ = i.moveY;
      stepInput.yaw = orbit.viewYaw;
      stepInput.jumpPressed = i.jumpPressed;
      stepInput.jumpHeld = i.jump;
      stepInput.actionPressed = i.actionPressed;
      stepInput.tag = takeTag();
      if (bot) {
         bot.frameMs = lastFrame.current;
         botInput(bot, run, stepInput);
      }
      lastFrame.current = dt * 1000;
      react(step(run, dt * 1000, stepInput));
   });
   return null;
}

function TowerCamera({ run, orbit }: { run: CbtRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   useEffect(() => {
      camera.fov = aspect < 1 ? FOV_PORTRAIT : FOV;
      camera.updateProjectionMatrix();
   }, [camera, aspect]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         orbitPivot(run, out);
         return true;
      },
      [run],
   );
   useFrame((_, dt) => {
      if (arcadeStore.getState().phase === "playing") steerTowerCamera(orbit, run, dt);
   }, ORBIT_DRIVER_PRIORITY - 0.002);
   return <OrbitCamera orbit={orbit} pivot={pivot} lookUp={orbitLookUp(aspect)} distanceScale={orbitScale(aspect)} collision={TOWER_COLLISION} />;
}

/** A ring round the next claw to charge, in its colour (where to go). */
function Guide({ run }: { run: CbtRun }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const c = run.ended === null ? nextClaw(run) : -1;
      m.visible = c >= 0;
      if (c < 0) return;
      const cl = run.claws[c];
      const th = cl.a / R_PATH;
      const pt = ringPoint(th, CLAW_R - 0.5, cl.y, { x: 0, y: 0, z: 0 });
      m.position.set(pt.x, pt.y, pt.z);
      m.rotation.set(0, th, 0);
      m.scale.setScalar(1 + Math.sin(time.now * 5) * 0.12);
      (m.material as MeshBasicMaterial).color.set(TAG_HEX[cl.colour]);
   }, FRAME_PRIORITY.visuals);
   return (
      <mesh ref={ref}>
         <torusGeometry args={[0.85, 0.06, 8, 40]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

/** The cannon beam (a stretched glowing cylinder for a moment). */
function BeamLine({ beam }: { beam: Beam }) {
   const ref = useRef<Group>(null);
   const mat = useRef<MeshBasicMaterial>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const left = beam.until - time.now;
      g.visible = left > 0;
      if (left <= 0) return;
      const dx = beam.to.x - beam.from.x;
      const dy = beam.to.y - beam.from.y;
      const dz = beam.to.z - beam.from.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      g.position.set((beam.from.x + beam.to.x) / 2, (beam.from.y + beam.to.y) / 2, (beam.from.z + beam.to.z) / 2);
      g.lookAt(beam.to.x, beam.to.y, beam.to.z);
      g.scale.set(1, 1, len);
      if (mat.current) {
         mat.current.color.set(beam.color);
         mat.current.opacity = Math.min(1, left / 0.2);
      }
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref} visible={false}>
         <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.16, 0.16, 1, 10, 1, true]} />
            <meshBasicMaterial ref={mat} color="#ffffff" transparent depthWrite={false} toneMapped={false} />
         </mesh>
      </group>
   );
}

function IntroCamera({ run, anim }: { run: CbtRun; anim: HeroAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.tower), [run.tower]);
   const play = useMemo(() => playCamera(run, aspect), [run, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   const juice = useJuice();
   const landed = useRef(false);
   useFrame(() => {
      if (!running || landed.current || anim.intro < 0.985) return;
      landed.current = true;
      const h = run.hero;
      const at = ringPoint(h.a / R_PATH, R_PATH, h.y + 0.3, { x: 0, y: 0, z: 0 });
      juice.burst("dust", at, 26, { color: "#ffffff", vy: 3 });
      juice.burst("pickup", at, 16, { color: TAG_HEX[TAG_COLOUR[run.tag.active]] });
      juice.shake(0.25);
      playSfx("thud");
   });
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<TowerSpec>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createHeroAnim, [run]);
   const orbit = useMemo(() => createOrbit(towerOrbit(run)), [run]);
   const beam = useMemo<Beam>(() => ({ from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, color: "#fff", until: -1 }), [run]);
   const view = useMemo<BossView>(() => ({ feet: bossFeetY(run) }), [run]);
   const won = useRef(false);
   return (
      <JuiceLayer>
         <Tower key={levelId} run={run} />
         <Boss key={`b${levelId}`} run={run} view={view} />
         <Heroes run={run} anim={anim} />
         <Simulation run={run} anim={anim} won={won} orbit={orbit} beam={beam} view={view} />
         <TowerCamera run={run} orbit={orbit} />
         <Guide run={run} />
         <BeamLine beam={beam} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
