"use client";

// The player card "/progress" (docs/design/DESIGN.md §6 item 7): who is playing, the totals in
// large numerals, one meter per world, the latest arcade bests, every Classic 50 score, the
// certificate and the leaderboard name switch.
// Classic progress loads exactly as the old page did (the games from the API, the progress from
// progressStorage, the same refresh events and timer). Arcade scores are the local bests
// (components/Site/hooks useLocalScores), synced from the account by ArcadeScoreSync.
import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Game, GameProgress } from "@/types/game";
import { getAllProgress, getGuestId } from "@/lib/storage/progressStorage";
import { getAllGames } from "@/lib/api/games";
import { useAuth } from "@/contexts/AuthContext";
import { getGameMeta } from "@/arcade3d/metaSource";
import { levelsActive } from "@/arcade3d/core/levels";
import { levelClearedText, levelProgress, levelTotalText } from "@/arcade3d/core/levelProgress";
import { formatScore } from "@/arcade3d/core/format";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, SQUAD_TEASER } from "@/arcade3d/flags";
import ArcadePrivacyToggle from "@/app/3d/ArcadePrivacyToggle";
import { LOGIN_EVENT, WORLDS, initialsOf, publicName, type SiteGame } from "@/components/Site/siteData";
import { useLocalScores } from "@/components/Site/hooks";
import { AwardIcon, BrandMark, CheckIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import styles from "./page.module.css";

export interface PlayerCardProps {
   /** the arcade games a player can open (empty while the arcade is off) */
   games: SiteGame[];
}

const CATEGORY_LABELS: Array<{ id: Game["game_type"]; label: string }> = [
   { id: "logic", label: "Logic games" },
   { id: "memory", label: "Memory games" },
   { id: "speed", label: "Speed games" },
   { id: "skill", label: "Skill games" },
   { id: "final", label: "Final games" },
];

const RECENT = 6;

const two = (value: number) => String(value).padStart(2, "0");

/** "18 Nov": the day a score was last played; "" when the date cannot be read. */
function shortDate(iso: string): string {
   const date = new Date(iso);
   if (Number.isNaN(date.getTime())) return "";
   return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The old page's medals: finished or 90 and up is gold, 70 silver, 50 bronze. */
function medalOf(completed: boolean, best: number): "Gold" | "Silver" | "Bronze" | null {
   if (completed || best >= 90) return "Gold";
   if (best >= 70) return "Silver";
   if (best >= 50) return "Bronze";
   return null;
}

function Total({ value, of, label }: { value: string; of?: string; label: string }) {
   return (
      <div className={styles.total}>
         <p className={styles.totalValue}>
            {value}
            {of ? <span className={styles.totalOf}> / {of}</span> : null}
         </p>
         <p className={styles.totalLabel}>{label}</p>
      </div>
   );
}

function Meter({ value, total }: { value: number; total: number }) {
   return (
      <div className={ui.meter}>
         <i className={ui.meterFill} style={{ "--v": total > 0 ? Math.min(1, value / total) : 0 } as CSSProperties} />
      </div>
   );
}

export default function PlayerCard({ games: arcadeGames }: PlayerCardProps) {
   const { user, isAuthenticated } = useAuth();
   const [progress, setProgress] = useState<Record<number, GameProgress>>({});
   const [games, setGames] = useState<Game[]>([]);
   const [loading, setLoading] = useState(true);
   const [guestId] = useState(() => getGuestId());
   const scores = useLocalScores();

   useEffect(() => {
      loadData();

      // Listen for progress updates in real-time
      const handleProgressUpdate = async () => {
         const updatedProgress = await getAllProgress();
         setProgress(updatedProgress);
      };

      const handleProgressSynced = (event: CustomEvent) => {
         if (event.detail?.progress) {
            setProgress(event.detail.progress);
         }
      };

      const handleProgressLoaded = (event: CustomEvent) => {
         if (event.detail?.progress) {
            setProgress(event.detail.progress);
         }
      };

      const handleStorageChange = () => {
         loadData();
      };

      window.addEventListener("play50games_progress_updated", handleProgressUpdate as EventListener);
      window.addEventListener("play50games_progress_synced", handleProgressSynced as EventListener);
      window.addEventListener("play50games_progress_loaded", handleProgressLoaded as EventListener);
      window.addEventListener("storage", handleStorageChange);

      // Also check periodically for updates
      const progressInterval = setInterval(async () => {
         const updatedProgress = await getAllProgress();
         setProgress((prevProgress) => {
            // Only update if there are actual changes
            if (JSON.stringify(updatedProgress) !== JSON.stringify(prevProgress)) {
               return updatedProgress;
            }
            return prevProgress;
         });
      }, 2000);

      return () => {
         window.removeEventListener("play50games_progress_updated", handleProgressUpdate as EventListener);
         window.removeEventListener("play50games_progress_synced", handleProgressSynced as EventListener);
         window.removeEventListener("play50games_progress_loaded", handleProgressLoaded as EventListener);
         window.removeEventListener("storage", handleStorageChange);
         clearInterval(progressInterval);
      };
   }, []);

   const loadData = async () => {
      try {
         const [progressData, gamesData] = await Promise.all([
            getAllProgress(), // from the server for logged-in users
            getAllGames(guestId),
         ]);
         setProgress(progressData);
         setGames(gamesData);
      } catch (error) {
         // Failed to load progress
      } finally {
         setLoading(false);
      }
   };

   // ----- Classic 50 -----
   const completedGames = games.filter((game) => progress[game.id]?.completed === true);
   const totalScore = Object.values(progress).reduce((sum, p) => sum + (p.best_score || 0), 0);
   const classicTotal = games.length;
   const classicDone = completedGames.length;
   const classicLeft = classicTotal - classicDone;
   const certificateReady = classicTotal > 0 && classicLeft === 0;

   // ----- 3D Arcade -----
   const arcade = arcadeGames.map((game) => {
      const meta = getGameMeta(game.slug);
      const entry = scores[game.slug as keyof typeof scores] ?? null;
      const summary = meta && levelsActive(meta) ? levelProgress(meta, entry) : null;
      return { game, meta, entry, summary };
   });
   const played = arcade.filter((item) => item.entry);
   const levelTotal = arcade.reduce((sum, item) => sum + (item.summary ? item.summary.levels.length : 0), 0);
   const levelsCleared = arcade.reduce((sum, item) => sum + (item.summary ? item.summary.cleared : 0), 0);
   const recent = [...played]
      .sort((a, b) => (b.entry?.lastPlayed ?? "").localeCompare(a.entry?.lastPlayed ?? ""))
      .slice(0, RECENT);

   const name = user ? user.display_name || `${user.first_name} ${user.last_name}`.trim() || "Player" : "Guest player";

   if (loading) {
      return (
         <div className={styles.skeleton} role="status" aria-label="Loading your player card">
            <div className={styles.head}>
               <i className={styles.bone} style={{ height: 120 }} />
               <i className={styles.bone} style={{ height: 180 }} />
            </div>
            <i className={styles.bone} style={{ height: 160 }} />
            <i className={styles.bone} style={{ height: 320 }} />
         </div>
      );
   }

   return (
      <>
         <section className={styles.head} aria-labelledby="player-name">
            <div className={styles.identity}>
               <span className={styles.avatar} aria-hidden="true">
                  {user ? initialsOf(user) : <BrandMark />}
               </span>
               <div className={styles.who}>
                  <p className={ui.label}>Player card</p>
                  <h1 id="player-name" className={styles.name}>
                     {name}
                  </h1>
                  {isAuthenticated && user ? (
                     <p className={styles.sub}>
                        Scores show as <b>{publicName(user)}</b>
                     </p>
                  ) : (
                     <>
                        <p className={styles.sub}>
                           Your progress is saved on this device. Log in to keep it on every device.
                        </p>
                        <button
                           type="button"
                           className={`${ui.btn} ${ui.btnPrimary} ${styles.login}`}
                           onClick={() => window.dispatchEvent(new Event(LOGIN_EVENT))}
                        >
                           Log in
                        </button>
                     </>
                  )}
               </div>
            </div>

            <div className={styles.totals}>
               <Total value={two(classicDone)} of={String(classicTotal)} label="Classic games finished" />
               <Total value={totalScore.toLocaleString("en-US")} label="Classic points, best scores combined" />
               {ARCADE_ENABLED ? (
                  <>
                     {levelTotal > 0 ? (
                        <Total value={two(levelsCleared)} of={String(levelTotal)} label="Arcade levels cleared" />
                     ) : null}
                     <Total value={two(played.length)} of={String(arcade.length)} label="Arcade games played" />
                  </>
               ) : null}
            </div>
         </section>

         <section aria-labelledby="player-worlds">
            <div className={ui.secHead}>
               <h2 id="player-worlds" className={ui.h2}>
                  Worlds
               </h2>
            </div>
            <ul className={styles.worlds}>
               <li className={styles.world}>
                  <span className={ui.plate} aria-hidden="true">
                     {WORLDS.classic.plate}
                  </span>
                  <span className={styles.worldName}>{WORLDS.classic.title}</span>
                  <Meter value={classicDone} total={classicTotal} />
                  <span className={styles.worldCount}>
                     {two(classicDone)} / {classicTotal} games
                  </span>
                  <Link href="/classic" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                     {classicDone > 0 && !certificateReady ? "Continue" : "Open"}
                  </Link>
               </li>
               {ARCADE_ENABLED ? (
                  <li className={styles.world}>
                     <span className={ui.plate} aria-hidden="true">
                        {WORLDS.arcade.plate}
                     </span>
                     <span className={styles.worldName}>{WORLDS.arcade.title}</span>
                     {levelTotal > 0 ? (
                        <>
                           <Meter value={levelsCleared} total={levelTotal} />
                           <span className={styles.worldCount}>
                              {two(levelsCleared)} / {levelTotal} levels
                           </span>
                        </>
                     ) : (
                        <>
                           <Meter value={played.length} total={arcade.length} />
                           <span className={styles.worldCount}>
                              {two(played.length)} / {arcade.length} games
                           </span>
                        </>
                     )}
                     <Link href="/3d" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                        Open
                     </Link>
                  </li>
               ) : null}
               {SQUAD_TEASER ? (
                  <li className={styles.world}>
                     <span className={ui.plate} aria-hidden="true">
                        {WORLDS.squad.plate}
                     </span>
                     <span className={styles.worldName}>{WORLDS.squad.title}</span>
                     <Meter value={0} total={1} />
                     <span className={styles.worldCount}>Opens soon</span>
                     <Link href="/scale-squad" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                        Open
                     </Link>
                  </li>
               ) : null}
            </ul>
         </section>

         {ARCADE_ENABLED ? (
            <section aria-labelledby="player-bests">
               <div className={ui.secHead}>
                  <h2 id="player-bests" className={ui.h2}>
                     Recent best scores
                  </h2>
                  <Link href="/3d" className={styles.more}>
                     All 3D games
                  </Link>
               </div>
               {recent.length > 0 ? (
                  <ul className={styles.bests}>
                     {recent.map(({ game, meta, entry, summary }) => (
                        <li key={game.slug}>
                           <Link href={`/3d/${game.slug}`} className={styles.best}>
                              {game.thumbnail ? (
                                 // eslint-disable-next-line @next/next/no-img-element
                                 <img src={game.thumbnail} alt="" loading="lazy" />
                              ) : (
                                 <span className={styles.noArt} />
                              )}
                              <span className={styles.bestTitle}>{game.title}</span>
                              {summary ? (
                                 <span
                                    className={summary.cleared >= summary.levels.length ? `${ui.pips} ${ui.pipsAll}` : ui.pips}
                                    role="img"
                                    aria-label={levelClearedText(summary)}
                                 >
                                    {summary.levels.map((level) => (
                                       <i key={level.id} className={level.cleared ? `${ui.pip} ${ui.pipOn}` : ui.pip} />
                                    ))}
                                 </span>
                              ) : (
                                 <span />
                              )}
                              <span className={styles.bestScore}>
                                 {entry && meta
                                    ? summary
                                       ? levelTotalText(meta, summary)
                                       : formatScore(entry.best, meta.scoring, entry.bestDurationMs)
                                    : ""}
                              </span>
                              <span className={styles.bestDate}>{entry ? shortDate(entry.lastPlayed) : ""}</span>
                           </Link>
                        </li>
                     ))}
                  </ul>
               ) : (
                  <div className={styles.empty}>
                     <div className={styles.ghost} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                     </div>
                     <p>No arcade scores yet. Play one round and your best score shows here.</p>
                     <Link href="/3d" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                        Open the 3D Arcade
                     </Link>
                  </div>
               )}
            </section>
         ) : null}

         <section aria-labelledby="player-classic">
            <div className={ui.secHead}>
               <h2 id="player-classic" className={ui.h2}>
                  Classic 50 scores
               </h2>
               <p className={ui.secNote}>Best score out of 100 and attempts</p>
            </div>

            {games.length === 0 ? (
               <div className={styles.empty}>
                  <p>Could not load the Classic 50 games. Check your connection and try again.</p>
                  <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`} onClick={loadData}>
                     Try again
                  </button>
               </div>
            ) : (
               CATEGORY_LABELS.map((category) => {
                  const list = games.filter((game) => (game.game_type || "logic") === category.id);
                  if (list.length === 0) return null;
                  return (
                     <div key={category.id} className={styles.group}>
                        <h3 className={`${ui.label} ${styles.groupTitle}`}>{category.label}</h3>
                        <ol className={styles.rows}>
                           {list.map((game) => {
                              const gameProgress = progress[game.id];
                              const isCompleted = gameProgress?.completed === true;
                              const bestScore = gameProgress?.best_score || 0;
                              const medal = gameProgress ? medalOf(isCompleted, bestScore) : null;
                              const status = isCompleted ? "Finished" : bestScore > 0 ? "In progress" : "Not started";
                              return (
                                 <li key={game.id}>
                                    <Link href={`/games/${game.id}`} className={styles.row} data-done={isCompleted ? "" : undefined}>
                                       <span className={styles.rowNo}>#{two(games.indexOf(game) + 1)}</span>
                                       <span className={styles.rowTitle}>
                                          {game.title}
                                          <span className={styles.rowStatus}>
                                             {isCompleted ? <CheckIcon /> : null}
                                             {status}
                                             {medal ? <span data-medal={medal}> · {medal}</span> : null}
                                          </span>
                                       </span>
                                       <span className={styles.rowScore}>
                                          {gameProgress ? (
                                             <>
                                                {bestScore}
                                                <span> / 100</span>
                                             </>
                                          ) : (
                                             <span>–</span>
                                          )}
                                       </span>
                                       <span className={styles.rowTries}>
                                          {gameProgress ? `${gameProgress.attempts || 0}×` : ""}
                                       </span>
                                    </Link>
                                 </li>
                              );
                           })}
                        </ol>
                     </div>
                  );
               })
            )}
         </section>

         <section className={styles.last} aria-label="Certificate and leaderboard name">
            <div className={styles.cert} data-ready={certificateReady ? "" : undefined}>
               <span className={styles.medal} aria-hidden="true">
                  <AwardIcon />
               </span>
               <div className={styles.certText}>
                  <h2 className={styles.certTitle}>Certificate</h2>
                  <p className={styles.certLine}>
                     {certificateReady ? (
                        "All fifty finished. Your certificate is ready."
                     ) : classicTotal > 0 ? (
                        <>
                           <b>{classicLeft}</b> {classicLeft === 1 ? "game" : "games"} to go. Finish all {classicTotal} classic
                           games to earn it.
                        </>
                     ) : (
                        "Finish all fifty classic games to earn it."
                     )}
                  </p>
               </div>
               <Link href="/certificate" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                  {certificateReady ? "Open the certificate" : "About the certificate"}
               </Link>
            </div>

            {ARCADE_ENABLED && ARCADE_LEADERBOARD ? (
               isAuthenticated ? (
                  <ArcadePrivacyToggle bare />
               ) : (
                  <p className={styles.privacyNote}>
                     Log in to choose how your name shows on the 3D Arcade leaderboards.
                  </p>
               )
            ) : null}
         </section>
      </>
   );
}
