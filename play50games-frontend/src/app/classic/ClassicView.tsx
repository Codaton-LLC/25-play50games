"use client";

// Classic 50 "/classic" (docs/design/DESIGN.md §6 item 4): the progress ring and the next game on
// top, then the fifty games as one path in five chapters of ten. A finished game is a filled
// node, the next one has the coral ring, a locked one is dim with a lock; the certificate waits
// at the end. An unlocked node is a link to its game ("/games/[id]"); a locked one is not.
// The data is loaded exactly as the old dashboard did: the games (with the unlock chain) from
// the API, the progress from progressStorage, refreshed on the same events and on the same timer.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Game } from "@/types/game";
import { getAllGames } from "@/lib/api/games";
import { getGuestId, getAllProgress } from "@/lib/storage/progressStorage";
import { getGameInstructions } from "@/lib/utils/gameInstructions";
import ProgressRing from "@/components/Site/ProgressRing";
import { AwardIcon, LockIcon, PlayIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

type GameCategory = "all" | Game["game_type"];

const CATEGORIES: Array<{ id: GameCategory; label: string }> = [
   { id: "all", label: "All games" },
   { id: "logic", label: "Logic & Puzzle" },
   { id: "memory", label: "Memory" },
   { id: "speed", label: "Speed & Reaction" },
   { id: "skill", label: "Skill & Coordination" },
   { id: "final", label: "Final games" },
];

const CATEGORY_NAMES: Record<Game["game_type"], string> = {
   logic: "Logic",
   memory: "Memory",
   speed: "Speed",
   skill: "Skill",
   final: "Final",
};

/** games per chapter, and per row half (a chapter is one row on a desktop, two on a tablet) */
const CHAPTER = 10;
const HALF = 5;

type StopState = "done" | "now" | "open" | "locked";

interface Stop {
   game: Game;
   /** 1-based place on the path */
   number: number;
   done: boolean;
   locked: boolean;
}

const two = (value: number) => String(value).padStart(2, "0");

function stateOf(stop: Stop, current: Stop | null): StopState {
   if (stop.done) return "done";
   if (stop.locked) return "locked";
   return stop === current ? "now" : "open";
}

function descriptionOf(game: Game): string {
   const gameType = game.game_config?.gameType || "";
   return game.description || getGameInstructions(gameType, game.title).description || "";
}

function StopItem({ stop, state, dim }: { stop: Stop; state: StopState; dim: boolean }) {
   const { game, number } = stop;
   const note = state === "done" ? ", finished" : state === "now" ? ", next up" : "";
   const label = `Game ${number}: ${game.title}${note}${stop.locked ? ", locked" : ""}`;
   const body = (
      <>
         <span className={styles.node}>
            {two(number)}
            {stop.locked ? <LockIcon className={styles.lock} /> : null}
         </span>
         <span className={styles.stopText}>
            <span className={styles.stopTitle}>{game.title}</span>
            <span className={styles.stopMeta}>
               {stop.locked
                  ? "Locked. Finish the games before it."
                  : `${CATEGORY_NAMES[game.game_type] ?? "Game"} · Difficulty ${game.difficulty} of 5 · Target ${game.passing_score}%`}
            </span>
         </span>
      </>
   );

   return (
      <li className={styles.stop} data-state={state} data-locked={stop.locked ? "" : undefined} data-dim={dim ? "" : undefined}>
         {stop.locked ? (
            <div className={styles.stopBody} role="group" aria-label={label}>
               {body}
            </div>
         ) : (
            <Link href={`/games/${game.id}`} className={styles.stopBody} aria-label={label} title={descriptionOf(game) || undefined}>
               {body}
            </Link>
         )}
      </li>
   );
}

/** The page while the games load: the same shapes, empty. */
function Skeleton() {
   return (
      <div className={styles.skeleton} role="status" aria-label="Loading the Classic 50 games">
         {/* the server HTML is this skeleton: it carries the h1 of the page until the path loads */}
         <h1 className={ui.srOnly}>Fifty brain games, one path.</h1>
         <div className={styles.head}>
            <div className={styles.intro}>
               <i className={styles.bone} style={{ width: 120, height: 26 }} />
               <i className={styles.bone} style={{ width: "min(420px, 90%)", height: 96 }} />
               <i className={styles.bone} style={{ width: "min(360px, 80%)", height: 44 }} />
            </div>
            <i className={`${styles.bone} ${styles.boneCard}`} />
         </div>
         <div className={styles.boneRows}>
            {Array.from({ length: 3 }, (_, row) => (
               <div key={row} className={styles.boneRow}>
                  {Array.from({ length: CHAPTER }, (_, index) => (
                     <i key={index} className={`${styles.bone} ${styles.boneNode}`} />
                  ))}
               </div>
            ))}
         </div>
      </div>
   );
}

export default function ClassicView() {
   const [games, setGames] = useState<Game[]>([]);
   const [loading, setLoading] = useState(true);
   const [guestId] = useState(() => getGuestId());
   const [selectedCategory, setSelectedCategory] = useState<GameCategory>("all");
   const [gameProgress, setGameProgress] = useState<Record<number, { completed: boolean }>>({});
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      loadGames();
      loadProgress();

      // Refresh progress when returning to the page
      const handleStorageChange = () => {
         loadProgress();
      };

      const handleProgressUpdate = () => {
         loadProgress();
      };

      const handleProgressLoaded = (event: CustomEvent) => {
         if (event.detail?.progress) {
            const progressMap: Record<number, { completed: boolean }> = {};
            Object.entries(event.detail.progress).forEach(([gameId, progress]: [string, any]) => {
               progressMap[parseInt(gameId)] = {
                  completed: progress.completed,
               };
            });
            setGameProgress(progressMap);
         }
      };

      window.addEventListener("storage", handleStorageChange);
      // Listen for custom progress update events (for same-tab updates)
      window.addEventListener("play50games_progress_updated", handleProgressUpdate);
      window.addEventListener("play50games_progress_loaded", handleProgressLoaded as EventListener);
      // Also check on focus (when user returns to tab)
      window.addEventListener("focus", loadProgress);

      // Periodically check for progress updates (in case localStorage changes in same tab)
      const progressInterval = setInterval(() => {
         loadProgress();
      }, 2000);

      return () => {
         window.removeEventListener("storage", handleStorageChange);
         window.removeEventListener("play50games_progress_updated", handleProgressUpdate);
         window.removeEventListener("play50games_progress_loaded", handleProgressLoaded as EventListener);
         window.removeEventListener("focus", loadProgress);
         clearInterval(progressInterval);
      };
   }, []);

   const loadProgress = async () => {
      const allProgress = await getAllProgress(); // from the server for logged-in users
      const progressMap: Record<number, { completed: boolean }> = {};
      Object.entries(allProgress).forEach(([gameId, progress]) => {
         progressMap[parseInt(gameId)] = { completed: progress.completed };
      });
      setGameProgress(progressMap);
   };

   const loadGames = async () => {
      try {
         const gamesData = await getAllGames(guestId);
         setGames(gamesData);
         setError(null);
      } catch (error: any) {
         const errorMessage =
            error.message || "Failed to load games. Please check your WordPress API connection.";
         setError(errorMessage);
      } finally {
         setLoading(false);
      }
   };

   const stops = useMemo<Stop[]>(
      () =>
         games.map((game, index) => ({
            game,
            number: index + 1,
            done: gameProgress[game.id]?.completed || false,
            locked: !game.is_unlocked,
         })),
      [games, gameProgress],
   );

   const counts = useMemo(() => {
      const byCategory: Record<string, number> = { all: games.length };
      games.forEach((game) => {
         byCategory[game.game_type] = (byCategory[game.game_type] || 0) + 1;
      });
      return byCategory;
   }, [games]);

   const chapters = useMemo(() => {
      const list: Stop[][] = [];
      for (let start = 0; start < stops.length; start += CHAPTER) list.push(stops.slice(start, start + CHAPTER));
      return list;
   }, [stops]);

   if (loading) return <Skeleton />;

   if (error) {
      const [summary, ...rest] = error.split("\n");
      return (
         <div className={styles.state} role="alert">
            <h1 className={styles.stateTitle}>Could not load the games</h1>
            <p className={styles.stateText}>Check your connection and try again.</p>
            <div className={styles.stateActions}>
               <button type="button" className={`${ui.btn} ${ui.btnQuiet}`} onClick={loadGames}>
                  Try again
               </button>
               <Link href="/diagnostics" className={`${ui.btn} ${ui.btnQuiet}`}>
                  Run diagnostics
               </Link>
            </div>
            <details className={styles.stateDetails}>
               <summary>Details</summary>
               <p>{summary}</p>
               {rest.length > 0 ? <p className={styles.statePre}>{rest.join("\n")}</p> : null}
            </details>
         </div>
      );
   }

   if (games.length === 0) {
      return (
         <div className={styles.state}>
            <h1 className={styles.stateTitle}>No games to show yet</h1>
            <p className={styles.stateText}>The Classic 50 games are not available right now. Try again in a moment.</p>
            <div className={styles.stateActions}>
               <button type="button" className={`${ui.btn} ${ui.btnQuiet}`} onClick={loadGames}>
                  Try again
               </button>
            </div>
         </div>
      );
   }

   const total = stops.length;
   const doneCount = stops.filter((stop) => stop.done).length;
   const allDone = doneCount === total;
   const left = total - doneCount;
   // the next game: the first one that is open and not finished
   const current = stops.find((stop) => !stop.locked && !stop.done) ?? null;
   // nothing open is left, but the path is not finished: the next game is still locked
   const blocked = current ? null : (stops.find((stop) => !stop.done) ?? null);
   const filtered = selectedCategory !== "all";
   // the certificate hangs under the last node only when the last row is full and ends on the
   // side the layout expects (an odd number of chapters, as with fifty games)
   const whole = total % CHAPTER === 0 && chapters.length % 2 === 1;

   return (
      <>
         <section className={styles.head} aria-labelledby="classic-title">
            <div className={styles.intro}>
               <p className={styles.eyebrow}>
                  <span className={`${ui.plate} ${ui.plateLg}`} aria-hidden="true">
                     50
                  </span>
                  <span className={ui.label}>Classic 50</span>
               </p>
               <h1 id="classic-title" className={styles.title}>
                  Fifty brain games, one path.
               </h1>
               <p className={styles.lead}>
                  Pass a game to unlock the next one. Finish all fifty and the certificate is yours.
               </p>
               <div className={styles.status}>
                  <ProgressRing value={doneCount} total={total} label={`${doneCount} of ${total} games finished`}>
                     {two(doneCount)} / {total}
                  </ProgressRing>
                  <div className={styles.statusText}>
                     <p className={styles.statusLine}>
                        {allDone ? (
                           "All fifty finished."
                        ) : (
                           <>
                              <b>{left}</b> {left === 1 ? "game" : "games"} to your certificate
                           </>
                        )}
                     </p>
                     <div className={styles.statusLinks}>
                        <Link href="/progress" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                           My progress
                        </Link>
                        <Link href="/certificate" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                           Certificate
                        </Link>
                     </div>
                  </div>
               </div>
            </div>

            <aside className={styles.next} aria-label={allDone ? "Certificate" : "Next game"}>
               {allDone ? (
                  <>
                     <p className={styles.nextKicker}>
                        <span className={`${ui.label} ${styles.gold}`}>Path finished</span>
                     </p>
                     <h2 className={styles.nextTitle}>The certificate is yours</h2>
                     <p className={styles.nextText}>You finished all {total} games. Open your certificate and share it.</p>
                     <Link href="/certificate" className={`${ui.btn} ${ui.btnPrimary} ${styles.nextCta}`}>
                        Get your certificate
                     </Link>
                  </>
               ) : current ? (
                  <>
                     <p className={styles.nextKicker}>
                        <span className={ui.label}>Next up</span>
                        <span className={styles.nextNo}>Game {two(current.number)}</span>
                     </p>
                     <h2 className={styles.nextTitle}>{current.game.title}</h2>
                     {descriptionOf(current.game) ? <p className={styles.nextText}>{descriptionOf(current.game)}</p> : null}
                     <ul className={styles.facts}>
                        <li>{CATEGORY_NAMES[current.game.game_type] ?? "Game"}</li>
                        <li>
                           Difficulty <b>{current.game.difficulty}</b> of 5
                        </li>
                        <li>
                           Target <b>{current.game.passing_score}%</b>
                        </li>
                     </ul>
                     <Link href={`/games/${current.game.id}`} className={`${ui.btn} ${ui.btnPrimary} ${styles.nextCta}`}>
                        <PlayIcon />
                        {doneCount > 0 ? "Continue" : "Start"}: game {current.number}
                     </Link>
                  </>
               ) : (
                  <>
                     <p className={styles.nextKicker}>
                        <span className={ui.label}>Next up</span>
                        {blocked ? <span className={styles.nextNo}>Game {two(blocked.number)}</span> : null}
                     </p>
                     <h2 className={styles.nextTitle}>{blocked ? blocked.game.title : "Nothing to play"}</h2>
                     <p className={styles.nextText}>This game is still locked. Finish the games before it to unlock it.</p>
                  </>
               )}
            </aside>
         </section>

         <section aria-labelledby="classic-path">
            <div className={ui.secHead}>
               <h2 id="classic-path" className={ui.h2}>
                  The path
               </h2>
               <p className={ui.secNote}>Five chapters of ten games</p>
            </div>

            <div className={styles.chips} role="group" aria-label="Show a kind of game">
               {CATEGORIES.map((category) => {
                  const count = counts[category.id] || 0;
                  if (category.id !== "all" && count === 0) return null;
                  return (
                     <button
                        key={category.id}
                        type="button"
                        className={styles.chip}
                        aria-pressed={selectedCategory === category.id}
                        onClick={() => setSelectedCategory(category.id)}
                     >
                        {category.label}
                        <span className={styles.chipCount}>{count}</span>
                     </button>
                  );
               })}
            </div>

            <div className={styles.path} data-filtered={filtered ? "" : undefined} data-loose={whole ? undefined : ""}>
               {chapters.map((chapter, index) => {
                  const first = chapter[0].number;
                  const last = chapter[chapter.length - 1].number;
                  const chapterDone = chapter.filter((stop) => stop.done).length;
                  const matches = filtered ? chapter.filter((stop) => stop.game.game_type === selectedCategory).length : chapter.length;
                  return (
                     <section
                        key={first}
                        className={styles.chapter}
                        aria-label={`Chapter ${index + 1}, games ${first} to ${last}`}
                        data-empty={matches === 0 ? "" : undefined}
                     >
                        <div className={styles.chapHead}>
                           <p className={styles.chapName}>
                              <span className={ui.label}>Chapter {index + 1}</span>
                              <span className={styles.chapRange}>
                                 {two(first)}–{two(last)}
                              </span>
                           </p>
                           <p className={styles.chapCount}>
                              {two(chapterDone)} / {chapter.length}
                           </p>
                        </div>
                        <div className={styles.row}>
                           {[chapter.slice(0, HALF), chapter.slice(HALF)].map((half, halfIndex) =>
                              half.length > 0 ? (
                                 <ol key={halfIndex} className={styles.half} start={half[0].number}>
                                    {half.map((stop) => (
                                       <StopItem
                                          key={stop.game.id}
                                          stop={stop}
                                          state={stateOf(stop, current)}
                                          dim={filtered && stop.game.game_type !== selectedCategory}
                                       />
                                    ))}
                                 </ol>
                              ) : null,
                           )}
                        </div>
                     </section>
                  );
               })}

               <div className={styles.finish} data-earned={allDone ? "" : undefined}>
                  <span className={styles.finishNode}>
                     <span className={styles.medal}>
                        <AwardIcon />
                     </span>
                  </span>
                  <div className={styles.finishText}>
                     <h3 className={styles.finishTitle}>Certificate</h3>
                     <p className={styles.finishLine}>
                        {allDone ? (
                           "All fifty finished. It is yours."
                        ) : (
                           <>
                              It waits at the end of the path. <b>{left}</b> to go.
                           </>
                        )}
                     </p>
                     <Link href="/certificate" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                        {allDone ? "Open the certificate" : "About the certificate"}
                     </Link>
                  </div>
               </div>
            </div>
         </section>
      </>
   );
}
