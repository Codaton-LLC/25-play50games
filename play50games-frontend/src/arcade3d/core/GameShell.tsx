"use client";

// The full-screen frame every 3D Arcade game runs in. Owned by Claude.
// Games provide a GameDefinition; the shell owns everything around the Scene:
// WebGL check, Canvas, loading, start screen, 3-2-1 countdown, HUD, pause, result + score submit,
// login modals, touch controls, rotate/context-lost overlays and cleanup. It also measures where
// its HUD and touch controls cover the canvas and publishes that to scenes (core/safeArea.tsx).
// When a run ends, the score is submitted at once, but the scene (and the HUD) stay on screen for
// the game's result delay (GameDefinition.resultDelayMs, default 800 ms) before the result panel
// appears, so a crash or a win animation can be seen.
// Overlays (ShellOverlays.tsx) and the result card (ui/ResultPanel) stay inside the free area above
// the cookie banner and scroll inside their card with the buttons pinned on view; they open
// scrolled to the top and focus their first button without scrolling (overlayFocus.ts, never
// autoFocus). Time games show no score chip in the HUD (ShellOverlays.tsx HudChips).
import {
   useCallback,
   useEffect,
   useRef,
   useState,
   useSyncExternalStore,
   type CSSProperties,
   type RefObject,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProgress } from "@react-three/drei";
import type { ArcadeGameMeta } from "../types";
import type { GameDefinition, GameShellProps, RunState } from "./types";
import { arcadeStore, useArcadeStore } from "./useArcadeStore";
import { InputProvider } from "./input";
import TouchControls, { TouchControlsProbe, useBottomObstruction, useCoarsePointer } from "./TouchControls";
import { SafeAreaProvider, createSafeAreaStore, useSafeAreaTracker } from "./safeArea";
import ShellStage from "./ShellStage";
import ErrorBoundary from "./ErrorBoundary";
import { assetUrls, clearModelCache } from "./assets";
import { initAudio, playSfx, toggleMuted, useMuted } from "./audio";
import { loopsStopOn, stopShellLoops } from "./loopControl";
import { trackArcade } from "./analytics";
import { useLeaderboard } from "./useLeaderboard";
import { FocusButton, HudButtons, HudChips, LeaderboardBlock, Overlay, StartCard } from "./ShellOverlays";
import { focusWithoutScroll } from "./overlayFocus";
import {
   isRankedRun,
   normalizeRun,
   saveRunToAccount,
   submitScore,
   unrankedResult,
   type FinishedRun,
   type SubmitResult,
} from "./scores";
import { formatDuration } from "./format";
import { isPausable, isResultShown, pauseKeyAction } from "./frameLoop";
import { createRunTickets } from "./runTicket";
import { ARCADE_LEADERBOARD } from "../flags";
import { useAuth } from "@/contexts/AuthContext";
import { arcadeApi } from "@/lib/api/arcade";
import { getJwtToken } from "@/lib/api/apiUtils";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import ResultPanel from "../ui/ResultPanel";
import styles from "./GameShell.module.css";

// ---------- small hooks ----------

type WebGLSupport = "checking" | "ok" | "unsupported";

function detectWebGL(): boolean {
   try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
   } catch {
      return false;
   }
}

const PORTRAIT_QUERY = "(orientation: portrait)";

function subscribePortrait(onChange: () => void): () => void {
   if (typeof window === "undefined" || !window.matchMedia) return () => {};
   const query = window.matchMedia(PORTRAIT_QUERY);
   query.addEventListener?.("change", onChange);
   window.addEventListener("resize", onChange);
   return () => {
      query.removeEventListener?.("change", onChange);
      window.removeEventListener("resize", onChange);
   };
}

const readPortrait = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(PORTRAIT_QUERY).matches;

/** true when a touch device is held the wrong way for this game. */
function useWrongOrientation(orientation: ArcadeGameMeta["orientation"], coarse: boolean): boolean {
   const portrait = useSyncExternalStore(subscribePortrait, readPortrait, () => false);
   if (!coarse || orientation === "any") return false;
   return orientation === "landscape" ? portrait : !portrait;
}

function isEditable(target: EventTarget | null): boolean {
   if (!(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

// ---------- overlays ----------

function LoadingOverlay({ title }: { title: string }) {
   const { progress, active } = useProgress();
   const pct = Math.round(active ? progress : Math.max(progress, 0));
   return (
      <div className={styles.overlay} role="status" aria-live="polite">
         <div className={`${styles.panel} ${styles.center}`}>
            <span className={styles.spinner} aria-hidden="true" />
            <p className={styles.loadingTitle}>Loading {title}…</p>
            <div
               className={styles.progress}
               role="progressbar"
               aria-label="Loading progress"
               aria-valuemin={0}
               aria-valuemax={100}
               aria-valuenow={pct}
            >
               <span className={styles.progressFill} style={{ width: `${Math.max(6, pct)}%` }} />
            </div>
         </div>
      </div>
   );
}

function Countdown() {
   const seconds = useArcadeStore((s) => (s.phase === "countdown" ? Math.ceil(s.countdownMs / 1000) : 0));
   useEffect(() => {
      if (seconds > 0) playSfx("countdown");
   }, [seconds]);
   if (seconds <= 0) return null;
   return (
      <div className={styles.countdown} role="status" aria-live="assertive">
         <span key={seconds} className={styles.countdownNumber}>
            {seconds}
         </span>
      </div>
   );
}

/**
 * Score (points games only), time, lives, stats, mute and pause. Laid out (hidden) in every phase
 * so the safe area (core/safeArea.tsx) knows where it sits before the run starts; its children are
 * the measured groups.
 */
function Hud({
   definition,
   scoring,
   onPause,
   hidden,
   rootRef,
}: {
   definition: GameDefinition;
   /** meta.scoring, passed whole: HudChips derives from its kind whether a score chip shows */
   scoring: ArcadeGameMeta["scoring"];
   onPause: () => void;
   hidden: boolean;
   rootRef: RefObject<HTMLDivElement>;
}) {
   const score = useArcadeStore((s) => s.score);
   const time = useArcadeStore((s) => (s.timeLeftMs !== null ? Math.ceil(s.timeLeftMs / 1000) : Math.floor(s.elapsedMs / 1000)));
   const timed = useArcadeStore((s) => s.timeLeftMs !== null);
   const lives = useArcadeStore((s) => s.lives);
   const stats = useArcadeStore((s) => s.stats);
   const canPause = useArcadeStore((s) => isPausable(s.phase));
   const muted = useMuted();

   return (
      <div ref={rootRef} className={styles.hud} style={hidden ? { visibility: "hidden" } : undefined} aria-hidden={hidden || undefined}>
         <HudChips
            scoring={scoring}
            score={score}
            time={time}
            timed={timed}
            lives={lives}
            stats={stats}
            hudStats={definition.hudStats}
         />
         <HudButtons hidden={hidden} canPause={canPause} muted={muted} onToggleMute={toggleMuted} onPause={onPause} />
      </div>
   );
}

// ---------- the shell ----------

interface Outcome {
   runId: number;
   run: FinishedRun;
   result: SubmitResult | null;
   saving: boolean;
   /** who played the run (null = guest): "Save to my account" merges guest runs or resends own runs only */
   userId: number | null;
   /** the run's single-use ticket (memory only), resent only by the same user */
   runToken: string | null;
}

const END_TITLES: Record<string, string> = {
   win: "You did it!",
   lose: "Game over",
   timeup: "Time's up!",
   quit: "Run ended",
};

export default function GameShell({ meta, definition, exitHref = "/3d" }: GameShellProps) {
   const router = useRouter();
   const { user, login, register } = useAuth();
   const coarse = useCoarsePointer();
   const bottomObstruction = useBottomObstruction();
   const phase = useArcadeStore((s) => s.phase);
   const endReason = useArcadeStore((s) => s.endReason);
   // flips once per run: the scene has stayed on screen for the result delay after the end
   // (configure() below hands the store definition.resultDelayMs)
   const resultShown = useArcadeStore(isResultShown);
   const leaderboard = useLeaderboard(meta.slug, { refreshKey: user?.id ?? null });

   const [webgl, setWebgl] = useState<WebGLSupport>("checking");
   const [contextLost, setContextLost] = useState(false);
   const [stageKey, setStageKey] = useState(0);
   /** the 3D stage crashed (Scene threw, Rapier chunk failed, renderer failed) */
   const [stageError, setStageError] = useState<Error | null>(null);
   const [outcome, setOutcome] = useState<Outcome | null>(null);
   const [showLogin, setShowLogin] = useState(false);
   const [showRegister, setShowRegister] = useState(false);
   const wrongOrientation = useWrongOrientation(meta.orientation, coarse);
   const muted = useMuted();

   const canvasWrapRef = useRef<HTMLDivElement>(null);
   const hudRef = useRef<HTMLDivElement>(null);
   const gameHudRef = useRef<HTMLDivElement>(null);
   const probeRef = useRef<HTMLDivElement>(null);
   const [safeArea] = useState(createSafeAreaStore);
   const resultRef = useRef<HTMLDivElement>(null);
   const submittedRunRef = useRef<number | null>(null);
   const userRef = useRef(user);
   userRef.current = user;
   const retryLeaderboardRef = useRef(leaderboard.retry);
   retryLeaderboardRef.current = leaderboard.retry;
   // one ticket context per shell mount (core/runTicket.ts); requests never block the countdown
   const [tickets] = useState(() =>
      createRunTickets({
         startRun: (slug) => arcadeApi.startRun(slug),
         getState: () => arcadeStore.getState(),
         getUserId: () => userRef.current?.id ?? null,
         hasJwt: () => !!getJwtToken(),
         enabled: () => ARCADE_LEADERBOARD,
      })
   );
   useEffect(() => () => tickets.reset(), [tickets]);

   const pause = useCallback(() => arcadeStore.getState().pause(), []);
   const exit = useCallback(() => router.push(exitHref), [router, exitHref]);

   // WebGL support (once)
   useEffect(() => {
      setWebgl(detectWebGL() ? "ok" : "unsupported");
   }, []);

   // where the HUDs, the touch controls and the cookie banner cover the canvas (useSafeArea in
   // scenes); the banner lifts the controls, and the HUDs mount once WebGL is known
   useSafeAreaTracker(safeArea, canvasWrapRef, hudRef, probeRef, [bottomObstruction, coarse, webgl, stageError], {
      gameHud: gameHudRef,
      bottomObstruction,
   });

   // run config; reset() on unmount so the next game starts clean (safe to run twice)
   useEffect(() => {
      arcadeStore.getState().configure({
         durationMs: definition.durationMs,
         lives: definition.lives,
         resultDelayMs: definition.resultDelayMs,
      });
      submittedRunRef.current = null;
      return () => arcadeStore.getState().reset();
   }, [definition]);

   // free loaded GLBs when the game closes (R3F disposes the renderer and its scene)
   useEffect(() => {
      const urls = assetUrls(definition);
      return () => clearModelCache(urls);
   }, [definition]);

   // audio unlocks on the first gesture
   useEffect(() => initAudio(), []);

   // looping sounds (core/loopControl.ts) fall silent when the game closes and when the player
   // mutes. TODO(P-06): core/audio.ts registers its stopAllLoops with registerLoopStopper.
   useEffect(() => () => stopShellLoops(), []);
   useEffect(() => {
      if (muted) stopShellLoops();
   }, [muted]);

   // no pull-to-refresh / rubber-banding while the game is open
   useEffect(() => {
      const html = document.documentElement;
      const previous = html.style.overscrollBehavior;
      html.style.overscrollBehavior = "none";
      return () => {
         html.style.overscrollBehavior = previous;
      };
   }, []);

   // run lifecycle: start analytics, the end of a run (score submit), the next run
   useEffect(() => {
      const slug = meta.slug;
      const scoring = meta.scoring;

      const finishRun = (state: RunState) => {
         if (submittedRunRef.current === state.runId) return;
         submittedRunRef.current = state.runId;

         if (state.endReason === "quit") {
            exit();
            return;
         }
         const final = definition.finalScore
            ? definition.finalScore(state)
            : { score: state.score, durationMs: state.elapsedMs };
         const normalized = normalizeRun(
            { slug, score: final.score, durationMs: final.durationMs, finishedAt: new Date().toISOString() },
            scoring
         );
         // time games: only a win has a finish time; a lost or timed-out run scores 0 and is not saved
         const ranked = isRankedRun(scoring, state.endReason);
         const run: FinishedRun = ranked ? normalized : { ...normalized, score: 0 };
         const runId = state.runId;
         const userId = userRef.current?.id ?? null;
         // frozen at the end: a ticket that arrives later is too late for this run
         const ticket = tickets.ticketFor(runId, userId);
         playSfx(state.endReason === "win" ? "win" : "lose");
         trackArcade("arcade_game_over", { game: slug, score: run.score, duration_ms: run.durationMs, ticket: ticket.outcome });

         if (!ranked) {
            setOutcome({ runId, run, result: unrankedResult(slug, userId), saving: false, userId, runToken: null });
            return;
         }
         setOutcome({ runId, run, result: null, saving: true, userId, runToken: ticket.token });

         // one upload: with the ticket when it was kept, otherwise without (the server decides)
         submitScore(run, userId, ticket.token)
            .then((result) => {
               setOutcome((current) => (current && current.runId === runId ? { ...current, result, saving: false } : current));
               if (result.isNewBest) {
                  trackArcade("arcade_new_best", { game: slug, score: result.score, duration_ms: run.durationMs });
               }
               if (result.status === "synced") retryLeaderboardRef.current();
            })
            .catch(() => {
               const result: SubmitResult = {
                  slug,
                  score: run.score,
                  best: run.score,
                  bestDurationMs: run.durationMs,
                  isNewBest: false,
                  plays: 0,
                  rank: null,
                  status: "config-error",
               };
               setOutcome((current) => (current && current.runId === runId ? { ...current, result, saving: false } : current));
            });
      };

      // the store may already be over (e.g. a fast remount); handle it once
      const now = arcadeStore.getState();
      if (now.phase === "over") finishRun(now);
      if (now.phase === "countdown") tickets.onRunStart(now.runId, slug);

      return arcadeStore.subscribe((state, prev) => {
         // every new run (Play, Retry, Restart from pause or from the countdown) asks for its ticket
         if (state.phase === "countdown" && state.runId !== prev.runId) tickets.onRunStart(state.runId, slug);
         if (state.phase === prev.phase) return;
         // a paused or ended run falls silent (TODO(P-06): audio's stopAllLoops is registered then)
         if (loopsStopOn(prev.phase, state.phase)) stopShellLoops();
         if (state.phase === "playing" && prev.phase === "countdown") {
            playSfx("go");
            trackArcade("arcade_start", { game: slug, score: 0, duration_ms: 0 });
            // keys must drive the game, not a focused button
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
         }
         if (state.phase === "countdown" && (prev.phase === "over" || prev.phase === "ready")) setOutcome(null);
         if (state.phase === "over") finishRun(state);
      });
   }, [definition, meta.slug, meta.scoring, exit, tickets]);

   // Esc / P toggle pause; never behind the "Rotate your device" overlay (the run stays paused
   // until the phone is turned back)
   useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
         if (event.code !== "Escape" && event.code !== "KeyP") return;
         if (showLogin || showRegister || stageError || isEditable(event.target)) return;
         const state = arcadeStore.getState();
         const action = pauseKeyAction(state.phase, { contextLost, wrongOrientation });
         if (!action) return;
         event.preventDefault();
         if (action === "pause") state.pause();
         else state.resume();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
   }, [showLogin, showRegister, stageError, contextLost, wrongOrientation]);

   // leaving the tab or the window pauses
   useEffect(() => {
      const onVisibility = () => {
         if (document.visibilityState === "hidden") pause();
      };
      window.addEventListener("blur", pause);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
         window.removeEventListener("blur", pause);
         document.removeEventListener("visibilitychange", onVisibility);
      };
   }, [pause]);

   // holding the phone the wrong way pauses
   useEffect(() => {
      if (wrongOrientation) pause();
   }, [wrongOrientation, pause]);

   // result screen: move focus into it for keyboard and screen-reader users (once it appears),
   // without scrolling it away from its title
   useEffect(() => {
      if (resultShown) focusWithoutScroll(resultRef.current);
   }, [resultShown]);

   const onContextLost = useCallback(() => {
      setContextLost(true);
      arcadeStore.getState().pause();
   }, []);

   // the stage boundary sits inside .canvasWrap (its own stacking context), so its error is lifted
   // here and shown as a root-level overlay; the run is paused so HUD and keys stop acting on it
   const onStageError = useCallback((error: Error) => {
      setStageError(error);
      arcadeStore.getState().pause();
   }, []);

   const retryStage = () => {
      setStageError(null);
      setStageKey((key) => key + 1);
      arcadeStore.getState().configure({
         durationMs: definition.durationMs,
         lives: definition.lives,
         resultDelayMs: definition.resultDelayMs,
      });
   };

   const saveToAccount = () => {
      const current = outcome;
      const account = userRef.current;
      if (!current || !account) return;
      // another account's run is never merged or sent; a guest run is merged without a ticket
      if (current.userId !== null && current.userId !== account.id) return;
      const runId = current.runId;
      setOutcome({ ...current, saving: true, result: null });
      saveRunToAccount(current.run, account.id, current.userId === account.id ? current.runToken : null)
         .then((result) => {
            setOutcome((value) => (value && value.runId === runId ? { ...value, result, saving: false } : value));
            if (result.status === "synced") retryLeaderboardRef.current();
            // the token expired or was rejected: log in again instead of offering the same save
            if (result.status === "login-required") setShowLogin(true);
         })
         .catch(() => {
            setOutcome((value) => (value && value.runId === runId ? { ...value, result: current.result, saving: false } : value));
         });
   };

   const accentStyle = {
      "--game-accent": meta.accent,
      "--arcade-bottom-obstruction": `${bottomObstruction}px`,
   } as CSSProperties;

   // ---------- render ----------

   if (webgl === "unsupported") {
      return (
         <div className={styles.root} style={accentStyle}>
            <Overlay label="3D is not available">
               <h1 className={styles.title}>3D is not available here</h1>
               <p className={styles.tagline}>
                  {meta.title} needs WebGL, which this browser or device has switched off. Try an up-to-date Chrome,
                  Safari, Firefox or Edge, or turn on hardware acceleration.
               </p>
               <Link href={exitHref} className={styles.primary}>
                  Back to the 3D Arcade
               </Link>
            </Overlay>
         </div>
      );
   }

   const stageFailed = stageError !== null;
   // the HUD stays up while the ended run is still on screen (the result delay)
   const showHud =
      !stageFailed && (phase === "countdown" || phase === "playing" || phase === "paused" || (phase === "over" && !resultShown));
   const hudMounted = !stageFailed && webgl === "ok";
   const result = outcome?.result ?? null;
   const loginRequired = result?.status === "login-required";
   // saving needs a JWT; a cookie-only session or a token dropped after a 401 must log in again
   // and only the run's own player, or anyone for a guest run
   const canSaveToAccount =
      !!user && !!getJwtToken() && (outcome?.userId == null || outcome.userId === user.id);
   const frameloop = contextLost ? "never" : phase === "paused" ? "demand" : "always";

   return (
      <>
         <div className={styles.root} style={accentStyle}>
            <InputProvider target={canvasWrapRef}>
               <div ref={canvasWrapRef} className={styles.canvasWrap}>
                  {webgl === "ok" && (
                     <ErrorBoundary resetKey={stageKey} onError={onStageError}>
                        {/* the Canvas bridges this context, so Scenes can read useSafeArea() */}
                        <SafeAreaProvider store={safeArea}>
                           <ShellStage
                              key={stageKey}
                              definition={definition}
                              frameloop={frameloop}
                              onContextLost={onContextLost}
                              label={`${meta.title} game view`}
                           />
                        </SafeAreaProvider>
                     </ErrorBoundary>
                  )}
                  {!stageFailed && (phase === "countdown" || phase === "playing") && (
                     <TouchControls controls={definition.touchControls} labels={definition.touchLabels} />
                  )}
                  <TouchControlsProbe controls={definition.touchControls} probeRef={probeRef} />
               </div>

               {hudMounted && (
                  <Hud definition={definition} scoring={meta.scoring} onPause={pause} hidden={!showHud} rootRef={hudRef} />
               )}
               {/* laid out (hidden) in every phase like the shell HUD, so the safe area knows its marked panels */}
               {hudMounted && definition.Hud && (
                  <div
                     ref={gameHudRef}
                     className={styles.gameHud}
                     style={showHud ? undefined : { visibility: "hidden" }}
                     aria-hidden={!showHud || undefined}
                  >
                     <definition.Hud />
                  </div>
               )}

               {!stageFailed && (phase === "loading" || webgl === "checking") && <LoadingOverlay title={meta.title} />}

               {!stageFailed && phase === "ready" && webgl === "ok" && (
                  <StartCard
                     meta={meta}
                     definition={definition}
                     coarse={coarse}
                     exitHref={exitHref}
                     leaderboard={leaderboard}
                     onPlay={() => arcadeStore.getState().start()}
                  />
               )}

               {!stageFailed && phase === "countdown" && <Countdown />}

               {!stageFailed && phase === "paused" && !contextLost && !wrongOrientation && (
                  <Overlay label="Paused">
                     <h1 className={styles.title}>Paused</h1>
                     <div className={styles.actions}>
                        <FocusButton className={styles.primary} onClick={() => arcadeStore.getState().resume()}>
                           Resume
                        </FocusButton>
                        <button type="button" className={styles.secondary} onClick={() => arcadeStore.getState().restart()}>
                           Restart
                        </button>
                        <button type="button" className={styles.secondary} onClick={exit}>
                           Exit
                        </button>
                     </div>
                     <p className={styles.hint}>Press Esc or P to resume.</p>
                  </Overlay>
               )}

               {/* ResultPanel's own overlay fills .resultWrap, which ends above the cookie banner */}
               {!stageFailed && resultShown && outcome && (
                  <div className={styles.resultLayer}>
                     <div ref={resultRef} className={styles.resultWrap} tabIndex={-1}>
                        <ResultPanel
                           title={END_TITLES[endReason ?? "lose"] ?? "Game over"}
                           score={result?.score ?? outcome.run.score}
                           durationMs={outcome.run.durationMs}
                           best={result?.best ?? outcome.run.score}
                           bestDurationMs={result?.bestDurationMs ?? null}
                           rank={result?.rank ?? null}
                           isNewBest={result?.isNewBest ?? false}
                           status={outcome.saving ? null : result?.status ?? null}
                           scoring={meta.scoring}
                           onRetry={() => arcadeStore.getState().restart()}
                           onExit={exit}
                           onLogin={loginRequired && !canSaveToAccount ? () => setShowLogin(true) : undefined}
                           onSaveToAccount={
                              loginRequired && canSaveToAccount && !outcome.saving ? saveToAccount : undefined
                           }
                        >
                           <p className={styles.hint}>Played {formatDuration(outcome.run.durationMs)}</p>
                           <LeaderboardBlock leaderboard={leaderboard} meta={meta} />
                        </ResultPanel>
                     </div>
                  </div>
               )}

               {stageFailed && !contextLost && (
                  <Overlay label="Game error" className={styles.stageError}>
                     <h1 className={styles.title}>Something went wrong</h1>
                     <p className={styles.tagline}>The game stopped unexpectedly. You can try again.</p>
                     <div className={styles.actions}>
                        <FocusButton className={styles.primary} onClick={retryStage}>
                           Try again
                        </FocusButton>
                        <button type="button" className={styles.secondary} onClick={exit}>
                           Exit
                        </button>
                     </div>
                  </Overlay>
               )}

               {!stageFailed && wrongOrientation && !contextLost && (
                  <Overlay label="Rotate your device" className={styles.rotate}>
                     <span className={styles.rotateIcon} aria-hidden="true" />
                     <h1 className={styles.title}>Rotate your device</h1>
                     <p className={styles.tagline}>
                        {meta.title} plays in {meta.orientation} mode. Turn your phone to continue.
                     </p>
                  </Overlay>
               )}

               {contextLost && (
                  <Overlay label="Graphics stopped">
                     <h1 className={styles.title}>The 3D view stopped</h1>
                     <p className={styles.tagline}>
                        Your device paused the graphics (this can happen when memory runs low). Reload to keep playing.
                     </p>
                     <FocusButton className={styles.primary} onClick={() => window.location.reload()}>
                        Tap to reload
                     </FocusButton>
                  </Overlay>
               )}
            </InputProvider>
         </div>

         <LoginModal
            isOpen={showLogin}
            onClose={() => setShowLogin(false)}
            onLogin={login}
            onSwitchToRegister={() => {
               setShowLogin(false);
               setShowRegister(true);
            }}
         />
         <RegisterModal
            isOpen={showRegister}
            onClose={() => setShowRegister(false)}
            onRegister={register}
            onSwitchToLogin={() => {
               setShowRegister(false);
               setShowLogin(true);
            }}
         />
      </>
   );
}
