"use client";

// Plate Bounce Arena: the run stepped in useRunFrame, the hall, the tilted table, the hero ball, Rollo,
// the orbit camera on the table view and the intro. Juice: a bumper's light ring flashes with a 0.04 s
// hit-stop and a pop, the flipper clacks with a small camera kick, the chase lights speed up with the
// combo, a ramp shot whooshes and rings, lanterns chime, penguins thud (ice shatters), the jackpot throws
// confetti with a slow-mo, a lost ball shakes the table. Local multiplayer renders MultiScene.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useRunFrame } from "@/arcade3d/core/useRunFrame";
import { useInput } from "@/arcade3d/core/input";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { JuiceLayer, useJuice } from "@/arcade3d/menu2/juice";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { comboFlow } from "@/arcade3d/menu2/combo/combo";
import { playSfx } from "@/arcade3d/core/audio";
import { randomSeed } from "@/arcade3d/core/math";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { createOrbit, type OrbitState } from "@/arcade3d/menu2/camera/orbit";
import { OrbitCamera } from "@/arcade3d/menu2/camera/OrbitCamera";
import { GameIntro, useShellIntro } from "@/arcade3d/core/intro";
import { ARCADE_PREVIEW } from "@/arcade3d/flags";
import type { LevelId } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayers } from "@/arcade3d/menu2/multiplayer/players";
import World from "./World";
import TableView, { TableFrame, createTableClock, type TableClock } from "./TableView";
import Rollo from "./Rollo";
import { Ball, createBallAnim, type BallAnim } from "./Ball";
import { FOV, FOV_PORTRAIT, TABLE_ORBIT, introKeyframes, orbitPivot, orbitScale, playCamera } from "./camera";
import { ORB, STAT, createRun, createStepInput, currentObjective, step, type PinRun, type StepInput } from "./rules";
import { tableToWorld } from "./table";
import { pickedHero, subscribeHero } from "./heroes";
import { createBot, botInput } from "./bot";
import type { PinLevel } from "./levels";
import { COMBO, ROLLO, SECRETS } from "./progression";
import { levelEndStats } from "./levelEnd";
import MultiScene from "./MultiScene";
import { COLORS } from "./look";
import type { LiveInputState } from "@/arcade3d/core/types";

function autoplayRequested(): boolean {
   if (!ARCADE_PREVIEW || typeof window === "undefined") return false;
   try {
      return new URLSearchParams(window.location.search).get("autoplay") === "1";
   } catch {
      return false;
   }
}

/** The shell's input to the rules': A / ← and D / → (or that half of the screen held) are the flippers. */
export function readInput(i: LiveInputState, yaw: number, out: StepInput): StepInput {
   out.moveX = i.moveX;
   out.moveZ = i.moveY;
   out.yaw = yaw;
   const touch = i.pointer.down;
   out.left = i.moveX < -0.35 || (touch && i.pointer.x < 0);
   out.right = i.moveX > 0.35 || (touch && i.pointer.x >= 0);
   out.jumpPressed = i.jumpPressed;
   out.jumpHeld = i.jump;
   out.actionPressed = i.actionPressed;
   out.actionHeld = i.action;
   return out;
}

function publishBoss(run: PinRun): void {
   const b = run.boss;
   if (!b) return;
   const store = useArcadeStore.getState();
   const open = b.step === "vulnerable" ? 1 : 0;
   const flash = b.flashMs > 0 ? 1 : 0;
   if (store.stats[STAT.bossHp] !== b.hp) store.setStat(STAT.bossHp, b.hp);
   if (store.stats[STAT.bossPhase] !== b.phase) store.setStat(STAT.bossPhase, b.phase);
   if (store.stats[STAT.bossOpen] !== open) store.setStat(STAT.bossOpen, open);
   if (store.stats[STAT.bossFlash] !== flash) store.setStat(STAT.bossFlash, flash);
   const jam = run.rollo.jam + 1;
   if (store.stats[STAT.jam] !== jam) store.setStat(STAT.jam, jam);
}

const W = { x: 0, y: 0, z: 0 };
function world(x: number, h: number, z: number): { x: number; y: number; z: number } {
   return { ...tableToWorld(x, h, z, W) };
}

function Simulation({ run, anim, clock, orbit }: { run: PinRun; anim: BallAnim; clock: TableClock; orbit: OrbitState }) {
   const input = useInput();
   const juice = useJuice();
   const time = useGameTime();
   const stepInput = useMemo(createStepInput, []);
   const [bot] = useMemo(() => [autoplayRequested() ? createBot(run) : null], [run]);
   const { user } = useAuth();
   const userRef = useRef<number | null>(null);
   userRef.current = user?.id ?? null;

   useRunFrame((_state, dt) => {
      readInput(input.current, orbit.viewYaw, stepInput);
      if (bot) botInput(bot, run, stepInput);
      const ev = step(run, dt * 1000, stepInput);
      const store = useArcadeStore.getState();
      const b = run.ball;
      const now = time.now;
      const at = () => world(b.x, b.h + 0.6, b.z);
      if (ev.flipped) {
         playSfx("click", { volume: 0.5, pitch: 0.8 });
         juice.kick(0, -1, 0, 0.6);
      }
      for (let k = 0; k < Math.min(ev.bumpers, ev.bumperList.length); k++) {
         const i = ev.bumperList[k];
         const c = run.table.bumpers[i];
         clock.bumperAt[i] = now;
         juice.burst("hit", world(c.x, (c.layer ? 1.6 : 0) + 1, c.z), 14, { color: "#7dd3fc" });
         juice.hitStop(40);
         playSfx("pop", { volume: 0.55, pitch: 1 + Math.min(5, run.combo.chain) * 0.08 });
      }
      if (ev.slings > 0) playSfx("thud", { volume: 0.35, pitch: 1.3 });
      if (ev.rampIn) playSfx("whoosh", { volume: 0.5, pitch: 1.1 });
      if (ev.rampDone) {
         juice.popup(at(), ev.jackpot ? "JACKPOT x3!" : "RAMP!", { color: ev.jackpot ? COLORS.golden : "#9be7ff" });
         playSfx("chime", { pitch: 1.2 });
      }
      if (ev.jackpot) {
         juice.burst("checkpoint", at(), 70, { color: COLORS.golden });
         juice.hitStop(120);
         juice.shake(0.25);
      }
      if (ev.orbitDone) {
         const o = currentObjective(run);
         juice.popup(at(), o?.kind === "orbits" ? `ORBIT ${run.prog.count}` : "ORBIT!", { color: COLORS.orbit });
         playSfx("chime", { pitch: 1 + run.prog.count * 0.12 });
      }
      if (ev.mushroom >= 0) {
         const m = run.table.mushrooms[ev.mushroom];
         juice.burst("pickup", world(m.x, 1.5, m.z), 18, { color: "#f87171" });
         playSfx("jump", { volume: 0.55, pitch: 0.9 });
      }
      if (ev.lantern >= 0) {
         clock.lanternAt[ev.lantern] = now;
         const l = run.table.lanterns[ev.lantern];
         juice.burst("checkpoint", world(l.x, 0.6, l.z), 20, { color: COLORS.lantern });
         playSfx("chime", { pitch: 1.3 });
      }
      if (ev.target >= 0) {
         const t = run.table.targets[ev.target];
         juice.burst("hit", world(t.x, 0.8, t.z), t.ice ? 30 : 16, { color: t.ice ? COLORS.ice : "#e5e7eb" });
         juice.shake(t.ice ? 0.18 : 0.1);
         playSfx(t.ice ? "zap" : "thud", { volume: 0.55 });
      }
      for (let k = 0; k < Math.min(ev.orbCount, ev.orbList.length); k++) {
         const o = run.table.orbs[ev.orbList[k]];
         juice.burst("pickup", world(o.x, o.h + 0.6, o.z), 12, { color: o.kind === "coin" ? COLORS.coin : COLORS.orb });
         juice.popup(world(o.x, o.h + 1, o.z), `-${(ORB.bonusMs / 1000).toFixed(2)} s`, { color: COLORS.orb });
         playSfx("pickup", { pitch: 1.1 });
      }
      if (ev.orbCount > 0) {
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
      }
      for (let k = 0; k < ev.secretCount; k++) {
         const spec = SECRETS[run.level][ev.secretList[k]];
         juice.burst("checkpoint", at(), 26, { color: "#a7f3d0" });
         juice.popup(at(), spec?.name ?? "Secret", { color: "#a7f3d0" });
         playSfx("chime", { pitch: 1.5 });
      }
      if (ev.stageDone >= 0) {
         juice.popup(at(), "SECTION CLEAR", { color: "#fde68a" });
         playSfx("combo", { pitch: 1 });
      }
      if (ev.exitOpen) {
         const h = run.table.hole;
         juice.burst("checkpoint", world(h.x, 0.5, h.z), 40, { color: COLORS.holeOpen });
         juice.popup(world(h.x, 1.4, h.z), "EXIT OPEN!", { color: COLORS.holeOpen });
         playSfx("chime", { pitch: 0.9 });
      }
      if (ev.multiball) {
         juice.popup(world(0, 1.5, -24), "MULTIBALL!", { color: "#f0abfc" });
         playSfx("combo", { pitch: 1.3 });
      }
      if (ev.plunged) playSfx("whoosh", { volume: 0.55, pitch: 0.9 });
      if (ev.skill) juice.popup(at(), "SKILL SHOT!", { color: COLORS.golden });
      if (ev.saved) juice.popup(world(0, 1, -2), "BALL SAVED", { color: "#86efac" });
      if (ev.shieldSave) {
         juice.burst("aura", at(), 30, { color: "#86efac" });
         juice.popup(at(), "SHIELD!", { color: "#86efac" });
         playSfx("zap", { pitch: 1.2 });
      }
      if (ev.powered || ev.hop || ev.held) {
         juice.burst("aura", at(), 12, { color: heroAccent(run.heroId) });
         playSfx("whoosh", { volume: 0.4, pitch: 1.3 });
      }
      if (ev.cracked) {
         juice.burst("hit", world(-3, 0.6, -22), 26, { color: COLORS.crack });
         juice.shake(0.2);
         playSfx("boom", { volume: 0.5 });
      }
      if (ev.deck) juice.popup(at(), "UP TOP!", { color: COLORS.deck });
      if (ev.lost) {
         juice.shake(0.35);
         playSfx("lose", { volume: 0.5 });
         juice.popup(world(0, 1, -2), run.ballsLeft > 0 ? `Ball lost: ${run.ballsLeft} left` : "Last ball lost", { color: "#fca5a5" });
         store.setStat(STAT.lost, run.hits);
      }
      if (ev.bossHit) {
         juice.burst("hit", world(run.rollo.x, 1.2, run.rollo.z), 30, { color: "#c4b5fd" });
         juice.burst("checkpoint", world(run.rollo.x, 1.2, run.rollo.z), 30, { color: COLORS.golden });
         juice.shake(0.3);
         juice.hitStop(90);
         playSfx("boom", { pitch: 1.2 });
      }
      if (ev.bossBump) playSfx("thud", { volume: 0.4, pitch: 0.7 });
      if (ev.bossDefeated) {
         juice.burst("checkpoint", world(run.rollo.x, 1.2, run.rollo.z), 90, { color: COLORS.golden });
         juice.hitStop(Math.min(140, ROLLO.slowMo.durationMs));
         playSfx("win", { pitch: 0.9 });
      }
      if (ev.comboBonus > 0) store.setStat(STAT.comboMs, run.combo.bonusTotal);
      const flow = Math.ceil(comboFlow(run.combo, COMBO, run.simMs) * 10);
      clock.mult.current = run.combo.multiplier;
      if (store.stats[STAT.comboChain] !== run.combo.chain) store.setStat(STAT.comboChain, run.combo.chain);
      const mult = Math.round(run.combo.multiplier * 100);
      if (store.stats[STAT.comboMult] !== mult) store.setStat(STAT.comboMult, mult);
      if (store.stats[STAT.comboFlow] !== flow) store.setStat(STAT.comboFlow, flow);
      if (store.stats[STAT.points] !== run.points) store.setStat(STAT.points, run.points);
      if (store.stats[STAT.balls] !== run.ballsLeft) store.setStat(STAT.balls, run.ballsLeft);
      if (store.stats[STAT.stage] !== run.prog.stage) store.setStat(STAT.stage, run.prog.stage);
      if (store.stats[STAT.count] !== run.prog.count) store.setStat(STAT.count, run.prog.count);
      const charge = b.mode === "plunger" ? Math.round(b.charge * 20) : -1;
      if (store.stats[STAT.charge] !== charge) store.setStat(STAT.charge, charge);
      const golden = run.goldenUntil >= run.simMs ? 1 : 0;
      if (store.stats[STAT.golden] !== golden) store.setStat(STAT.golden, golden);
      publishBoss(run);
      const heroStat = run.heroId === "nami" ? 1 : run.heroId === "kiro" ? 2 : run.heroId === "zuno" ? 3 : run.heroId === "vexa" ? 4 : 0;
      if (store.stats[STAT.hero] !== heroStat) store.setStat(STAT.hero, heroStat);
      const powerLeft = run.powerUsed ? -1 : Math.max(0, Math.ceil((run.powerReadyAt - run.simMs) / 1000));
      if (store.stats[STAT.power] !== powerLeft) store.setStat(STAT.power, powerLeft);
      if (ev.finished) {
         anim.winAt = now;
         juice.burst("checkpoint", at(), 80);
         playSfx("chime", { pitch: 0.75 });
         store.setStat(STAT.orbs, run.orbs);
         store.setStat(STAT.mainOrbs, run.mainOrbs);
         store.setStat(STAT.finishMs, run.finishMs);
         store.setStat(STAT.comboMs, run.combo.bonusTotal);
         const end = levelEndStats(run, userRef.current);
         for (const key of Object.keys(end) as Array<keyof typeof end>) store.setStat(STAT[key], end[key]);
         store.end("win");
      } else if (ev.gameOver) {
         levelEndStats(run, userRef.current);
         store.end("lose");
      } else if (ev.timeup) {
         levelEndStats(run, userRef.current);
         store.end("timeup");
      }
   });
   return null;
}

function TableCamera({ run, orbit }: { run: PinRun; orbit: OrbitState }) {
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const base = aspect < 1 ? FOV_PORTRAIT : FOV;
   useEffect(() => {
      camera.fov = base;
      camera.updateProjectionMatrix();
   }, [camera, base]);
   const pivot = useMemo(
      () => (out: { x: number; y: number; z: number }) => {
         const b = run.ball;
         orbitPivot(b.x, b.z, b.h, out);
         return true;
      },
      [run],
   );
   return <OrbitCamera orbit={orbit} pivot={pivot} behind={() => 0} input={{ oneFinger: false, mouseButtons: [2] }} distanceScale={orbitScale(aspect)} pivotDamping={3} />;
}

function IntroCamera({ run, anim }: { run: PinRun; anim: BallAnim }) {
   const intro = useShellIntro();
   const size = useThree((s) => s.size);
   const aspect = size.width / Math.max(1, size.height);
   const keys = useMemo(() => introKeyframes(run.table), [run.table]);
   const play = useMemo(() => playCamera(run.table, aspect), [run.table, aspect]);
   const running = !!intro?.session && !intro.ready;
   useFrame(() => {
      anim.intro = running && intro ? intro.hero.current : Number.NaN;
   }, FRAME_PRIORITY.pose);
   if (!running || !intro?.session) return null;
   return <GameIntro session={intro.session} keyframes={keys} playCamera={play} hero={intro.hero} />;
}

function SoloScene() {
   const runId = useArcadeStore((s) => s.runId);
   const { config } = useLevel<PinLevel>();
   const levelId: LevelId = config?.id ?? 1;
   const livePick = useSyncExternalStore(subscribeHero, pickedHero, pickedHero);
   const startCard = useArcadeStore((s) => s.phase === "ready");
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const runPick = useMemo(() => pickedHero(), [runId]);
   const hero = startCard ? livePick : runPick;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const run = useMemo(() => createRun(randomSeed(), levelId, hero), [runId, levelId, hero]);
   const anim = useMemo(createBallAnim, [run]);
   const clock = useMemo(() => createTableClock(run.table), [run]);
   const orbit = useMemo(() => createOrbit({ ...TABLE_ORBIT }), [run]);
   return (
      <JuiceLayer>
         <World key={`w${levelId}`} level={levelId} />
         <TableFrame>
            <TableView key={`t${levelId}`} run={run} clock={clock} />
            <Ball key={`b${run.heroId}`} run={run} anim={anim} />
            {run.table.boss ? <Rollo key={`r${levelId}`} run={run} /> : null}
         </TableFrame>
         <Simulation run={run} anim={anim} clock={clock} orbit={orbit} />
         <TableCamera run={run} orbit={orbit} />
         <IntroCamera run={run} anim={anim} />
      </JuiceLayer>
   );
}

export default function Scene() {
   const multiplayer = usePlayers((s) => s.phase === "playing");
   return multiplayer ? <MultiScene /> : <SoloScene />;
}
