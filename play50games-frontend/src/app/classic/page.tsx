"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Game } from "@/types/game";
import { getAllGames } from "@/lib/api/games";
import { getGuestId, getAllProgress } from "@/lib/storage/progressStorage";
import UnlockSystem from "@/components/UnlockSystem/UnlockSystem";
import { getGameInstructions } from "@/lib/utils/gameInstructions";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import Header from "@/components/Header/Header";
import Footer from "@/components/Footer/Footer";
import GamePreview from "@/components/GamePreview/GamePreview";
import SectionTabs from "@/components/Nav/SectionTabs";
import styles from "./page.module.css";
import {
   TrophyIcon,
   CheckBadgeIcon,
   ClockIcon,
   StarIcon,
   PuzzlePieceIcon,
   BoltIcon,
   SparklesIcon,
   FireIcon,
} from "@heroicons/react/24/outline";

type GameCategory = "all" | "logic" | "memory" | "speed" | "skill" | "final";

type ProgressMap = Record<number, { completed: boolean }>;

/** The progress poll runs every 2 s; keep the old map when nothing changed so the 50 cards
 *  are not re-rendered for nothing. */
function keepIfSame(prev: ProgressMap, next: ProgressMap): ProgressMap {
   const keys = Object.keys(next);
   if (keys.length !== Object.keys(prev).length) return next;
   for (const key of keys) {
      const id = Number(key);
      if (!prev[id] || prev[id].completed !== next[id].completed) return next;
   }
   return prev;
}

export default function ClassicDashboardPage() {
   const { login, register } = useAuth();
   const [games, setGames] = useState<Game[]>([]);
   const [loading, setLoading] = useState(true);
   const [guestId] = useState(() => getGuestId());
   const [selectedCategory, setSelectedCategory] =
      useState<GameCategory>("all");
   const [gameProgress, setGameProgress] = useState<
      Record<number, { completed: boolean }>
   >({});
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);

   useEffect(() => {
      loadGames();
      loadProgress();

      // Refresh progress when returning to home page
      const handleStorageChange = () => {
         loadProgress();
      };

      const handleProgressUpdate = () => {
         loadProgress();
      };

      const handleProgressLoaded = (event: CustomEvent) => {
         if (event.detail?.progress) {
            const progressMap: Record<number, { completed: boolean }> = {};
            Object.entries(event.detail.progress).forEach(
               ([gameId, progress]: [string, any]) => {
                  progressMap[parseInt(gameId)] = {
                     completed: progress.completed,
                  };
               }
            );
            setGameProgress((prev) => keepIfSame(prev, progressMap));
         }
      };

      window.addEventListener("storage", handleStorageChange);
      // Listen for custom progress update events (for same-tab updates)
      window.addEventListener(
         "play50games_progress_updated",
         handleProgressUpdate
      );
      window.addEventListener(
         "play50games_progress_loaded",
         handleProgressLoaded as EventListener
      );
      // Also check on focus (when user returns to tab)
      window.addEventListener("focus", loadProgress);

      // Periodically check for progress updates (in case localStorage changes in same tab)
      const progressInterval = setInterval(() => {
         loadProgress();
      }, 2000); // Check every 2 seconds instead of 5

      return () => {
         window.removeEventListener("storage", handleStorageChange);
         window.removeEventListener(
            "play50games_progress_updated",
            handleProgressUpdate
         );
         window.removeEventListener(
            "play50games_progress_loaded",
            handleProgressLoaded as EventListener
         );
         window.removeEventListener("focus", loadProgress);
         clearInterval(progressInterval);
      };
   }, []);

   const loadProgress = async () => {
      const allProgress = await getAllProgress(); // Now async - gets from server for logged-in users
      const progressMap: Record<number, { completed: boolean }> = {};
      Object.entries(allProgress).forEach(([gameId, progress]) => {
         progressMap[parseInt(gameId)] = { completed: progress.completed };
      });
      setGameProgress((prev) => keepIfSame(prev, progressMap));
   };

   const [error, setError] = useState<string | null>(null);

   const loadGames = async () => {
      try {
         const gamesData = await getAllGames(guestId);
         setGames(gamesData);
         setError(null);
      } catch (error: any) {
         const errorMessage =
            error.message ||
            "Failed to load games. Please check your WordPress API connection.";
         setError(errorMessage);
      } finally {
         setLoading(false);
      }
   };

   // Filter games by category
   const filteredGames = useMemo(() => {
      if (selectedCategory === "all") {
         return games;
      }
      return games.filter((game) => game.game_type === selectedCategory);
   }, [games, selectedCategory]);

   // Group games by category for display
   const gamesByCategory = useMemo(() => {
      const grouped: Record<string, Game[]> = {
         logic: [],
         memory: [],
         speed: [],
         skill: [],
         final: [],
      };

      games.forEach((game) => {
         if (grouped[game.game_type]) {
            grouped[game.game_type].push(game);
         }
      });

      return grouped;
   }, [games]);

   const categoryLabels: Record<
      GameCategory,
      { label: string; icon: React.ReactNode }
   > = {
      all: { label: "All Games", icon: null },
      logic: {
         label: "Logic & Puzzle",
         icon: (
            <PuzzlePieceIcon
               style={{
                  width: 18,
                  height: 18,
                  display: "inline",
                  marginRight: 6,
               }}
            />
         ),
      },
      memory: {
         label: "Memory",
         icon: (
            <SparklesIcon
               style={{
                  width: 18,
                  height: 18,
                  display: "inline",
                  marginRight: 6,
               }}
            />
         ),
      },
      speed: {
         label: "Speed & Reaction",
         icon: (
            <BoltIcon
               style={{
                  width: 18,
                  height: 18,
                  display: "inline",
                  marginRight: 6,
               }}
            />
         ),
      },
      skill: {
         label: "Skill & Coordination",
         icon: (
            <FireIcon
               style={{
                  width: 18,
                  height: 18,
                  display: "inline",
                  marginRight: 6,
               }}
            />
         ),
      },
      final: {
         label: "Final Games",
         icon: (
            <TrophyIcon
               style={{
                  width: 18,
                  height: 18,
                  display: "inline",
                  marginRight: 6,
               }}
            />
         ),
      },
   };

   // Header, tabs and auth modals render at once (also in the server HTML) while the games load,
   // so the logo paints early and stays put when the games arrive.
   const shell = (
      <>
         <Header
            showSubtitle={true}
            onShowLoginModal={() => setShowLoginModal(true)}
            onShowRegisterModal={() => setShowRegisterModal(true)}
         />
         <SectionTabs active="classic" />

         {/* Auth Modals */}
         <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLogin={login}
            onSwitchToRegister={() => {
               setShowLoginModal(false);
               setShowRegisterModal(true);
            }}
         />
         <RegisterModal
            isOpen={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onRegister={register}
            onSwitchToLogin={() => {
               setShowRegisterModal(false);
               setShowLoginModal(true);
            }}
         />
      </>
   );

   if (loading) {
      return (
         <div className="home-page">
            {shell}
            <div
               style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "50vh",
                  width: "100%",
               }}
            >
               <span className="loader" role="status" aria-label="Loading games"></span>
            </div>
         </div>
      );
   }

   return (
      <div className="home-page">
         {shell}

         {error && (
            <div
               style={{
                  margin: "1rem auto",
                  maxWidth: "800px",
                  padding: "1rem",
                  backgroundColor: "#fee",
                  border: "2px solid #fcc",
                  color: "#c33",
               }}
            >
               <h2 style={{ marginTop: 0 }}>Connection Error</h2>
               <p style={{ whiteSpace: "pre-line" }}>{error}</p>
               <div style={{ marginTop: "1rem" }}>
                  <button
                     onClick={loadGames}
                     style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        marginRight: "0.5rem",
                     }}
                  >
                     Retry
                  </button>
                  <Link
                     href="/diagnostics"
                     style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#28a745",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "4px",
                        display: "inline-block",
                     }}
                  >
                     Run Diagnostics
                  </Link>
               </div>
            </div>
         )}

         {games.length === 0 ? (
            <div className="no-games">
               <p>No games found. Please create games in WordPress Admin.</p>
            </div>
         ) : (
            <>
               {/* Category Filter Tabs */}
               <div className="category-filter">
                  {(Object.keys(categoryLabels) as GameCategory[]).map(
                     (category) => {
                        const count =
                           category === "all"
                              ? games.length
                              : gamesByCategory[category]?.length || 0;

                        const categoryInfo = categoryLabels[category];
                        return (
                           <button
                              key={category}
                              onClick={() => setSelectedCategory(category)}
                              className={`category-tab ${
                                 selectedCategory === category ? "active" : ""
                              }`}
                           >
                              {categoryInfo.icon}
                              {categoryInfo.label}
                              {count > 0 && (
                                 <span className="category-count">
                                    ({count})
                                 </span>
                              )}
                           </button>
                        );
                     }
                  )}
               </div>

               {/* Games Display */}
               {selectedCategory === "all" ? (
                  // Show all games grouped by category
                  <div className="games-by-category">
                     {(Object.keys(gamesByCategory) as GameCategory[]).map(
                        (category) => {
                           if (
                              category === "all" ||
                              !gamesByCategory[category]?.length
                           )
                              return null;

                           return (
                              <div
                                 key={category}
                                 className={`category-section ${
                                    category === "final" ? "final-game" : ""
                                 }`}
                              >
                                 <h2
                                    className="category-title"
                                    style={{
                                       display: "flex",
                                       alignItems: "center",
                                       gap: "8px",
                                    }}
                                 >
                                    {categoryLabels[category].icon}
                                    {categoryLabels[category].label}
                                 </h2>
                                 <div className="games-grid">
                                    {gamesByCategory[category].map((game) => {
                                       const gameType =
                                          game.game_config?.gameType || "";
                                       const instructions = getGameInstructions(
                                          gameType,
                                          game.title
                                       );
                                       const displayDescription = (
                                          game.description ||
                                          instructions.description ||
                                          ""
                                       ).length > 150
                                          ? (
                                               game.description ||
                                               instructions.description ||
                                               ""
                                            ).substring(0, 150) + "..."
                                          : game.description ||
                                            instructions.description ||
                                            "";

                                       const isCompleted =
                                          gameProgress[game.id]?.completed ||
                                          false;

                                       return game.is_unlocked ? (
                                          <Link
                                             key={game.id}
                                             href={`/games/${game.id}`}
                                             className={`${styles.card} game-card ${
                                                isCompleted ? "completed" : ""
                                             }`}
                                             style={{ textDecoration: "none" }}
                                          >
                                             <UnlockSystem game={game} />

                                             {/* Feature Image */}
                                             <div className="game-feature-image">
                                                <GamePreview
                                                   gameType={gameType}
                                                   isFinalGame={
                                                      game.game_type === "final"
                                                   }
                                                />

                                                {/* Completion Badge - positioned over feature image */}
                                                {isCompleted && (
                                                   <div className="completion-badge">
                                                      <CheckBadgeIcon
                                                         style={{
                                                            width: 16,
                                                            height: 16,
                                                            marginRight: 4,
                                                         }}
                                                      />
                                                      Complete
                                                   </div>
                                                )}
                                             </div>
                                             <h3>{game.title}</h3>
                                             <p className="game-description">
                                                {displayDescription}
                                             </p>
                                             <div className="game-meta">
                                                <span>
                                                   <StarIcon
                                                      style={{
                                                         width: 14,
                                                         height: 14,
                                                         display: "inline",
                                                         marginRight: 4,
                                                      }}
                                                   />
                                                   Difficulty:{" "}
                                                   {"★".repeat(game.difficulty)}
                                                </span>
                                                <span>
                                                   <ClockIcon
                                                      style={{
                                                         width: 14,
                                                         height: 14,
                                                         display: "inline",
                                                         marginRight: 4,
                                                      }}
                                                   />
                                                   Time: {game.time_limit}s
                                                </span>
                                                <span>
                                                   Target: {game.passing_score}%
                                                </span>
                                             </div>
                                          </Link>
                                       ) : (
                                          <div
                                             key={game.id}
                                             className={`${styles.card} game-card locked ${
                                                isCompleted ? "completed" : ""
                                             }`}
                                          >
                                             <UnlockSystem game={game} />

                                             {/* Feature Image */}
                                             <div className="game-feature-image">
                                                <GamePreview
                                                   gameType={gameType}
                                                   isFinalGame={
                                                      game.game_type === "final"
                                                   }
                                                />

                                                {/* Completion Badge - positioned over feature image */}
                                                {isCompleted && (
                                                   <div className="completion-badge">
                                                      <CheckBadgeIcon
                                                         style={{
                                                            width: 16,
                                                            height: 16,
                                                            marginRight: 4,
                                                         }}
                                                      />
                                                      Complete
                                                   </div>
                                                )}
                                             </div>

                                             <h3>{game.title}</h3>
                                             <p className="locked-message">
                                                Complete previous games to
                                                unlock
                                             </p>
                                             <div className="game-meta">
                                                <span>
                                                   Difficulty:{" "}
                                                   {"★".repeat(game.difficulty)}
                                                </span>
                                                <span>
                                                   Time: {game.time_limit}s
                                                </span>
                                                <span>
                                                   Target: {game.passing_score}%
                                                </span>
                                             </div>
                                          </div>
                                       );
                                    })}
                                 </div>
                              </div>
                           );
                        }
                     )}
                  </div>
               ) : (
                  // Show filtered games for selected category
                  <div
                     className={
                        selectedCategory === "final"
                           ? "final-games"
                           : "category-section"
                     }
                     style={{
                        marginTop: selectedCategory === "final" ? "0" : "0",
                        background:
                           selectedCategory === "final"
                              ? "var(--card)"
                              : "transparent",
                        border: "none",
                     }}
                  >
                     <div className="games-grid">
                        {filteredGames.length === 0 ? (
                           <div className="no-games">
                              <p>
                                 No {categoryLabels[selectedCategory].label}{" "}
                                 games found.
                              </p>
                           </div>
                        ) : (
                           filteredGames.map((game) => {
                              const gameType = game.game_config?.gameType || "";
                              const instructions = getGameInstructions(
                                 gameType,
                                 game.title
                              );
                              const displayDescription = (
                                 game.description || instructions.description || ""
                              ).length > 150
                                 ? (
                                      game.description ||
                                      instructions.description ||
                                      ""
                                   ).substring(0, 150) + "..."
                                 : game.description ||
                                   instructions.description ||
                                   "";
                              const isCompleted =
                                 gameProgress[game.id]?.completed || false;
                              const isFinalGame = gameType === "final";

                              return game.is_unlocked ? (
                                 <Link
                                    key={game.id}
                                    href={`/games/${game.id}`}
                                    className={`${styles.card} game-card ${
                                       isCompleted ? "completed" : ""
                                    } ${isFinalGame ? "final-game" : ""}`}
                                    style={{ textDecoration: "none" }}
                                 >
                                    <UnlockSystem game={game} />

                                    {/* Feature Image */}
                                    <div className="game-feature-image">
                                       <GamePreview
                                          gameType={gameType}
                                          isFinalGame={isFinalGame}
                                       />

                                       {/* Completion Badge - positioned over feature image */}
                                       {isCompleted && (
                                          <div
                                             className={`completion-badge ${
                                                isFinalGame ? "final-game" : ""
                                             }`}
                                          >
                                             <CheckBadgeIcon
                                                style={{
                                                   width: 16,
                                                   height: 16,
                                                   marginRight: 4,
                                                }}
                                             />
                                             Complete
                                          </div>
                                       )}
                                    </div>
                                    <h3>{game.title}</h3>
                                    <p className="game-description">
                                       {displayDescription}
                                    </p>
                                    <div className="game-meta">
                                       <span>
                                          <StarIcon
                                             style={{
                                                width: 14,
                                                height: 14,
                                                display: "inline",
                                                marginRight: 4,
                                             }}
                                          />
                                          Difficulty:{" "}
                                          {"★".repeat(game.difficulty)}
                                       </span>
                                       <span>
                                          <ClockIcon
                                             style={{
                                                width: 14,
                                                height: 14,
                                                display: "inline",
                                                marginRight: 4,
                                             }}
                                          />
                                          Time: {game.time_limit}s
                                       </span>
                                       <span>
                                          Target: {game.passing_score}%
                                       </span>
                                    </div>
                                 </Link>
                              ) : (
                                 <div
                                    key={game.id}
                                    className={`${styles.card} game-card locked ${
                                       isCompleted ? "completed" : ""
                                    } ${isFinalGame ? "final-game" : ""}`}
                                 >
                                    <UnlockSystem game={game} />

                                    {/* Feature Image */}
                                    <div className="game-feature-image">
                                       <GamePreview
                                          gameType={gameType}
                                          isFinalGame={isFinalGame}
                                       />

                                       {/* Completion Badge - positioned over feature image */}
                                       {isCompleted && (
                                          <div
                                             className={`completion-badge ${
                                                isFinalGame ? "final-game" : ""
                                             }`}
                                          >
                                             <CheckBadgeIcon
                                                style={{
                                                   width: 16,
                                                   height: 16,
                                                   marginRight: 4,
                                                }}
                                             />
                                             Complete
                                          </div>
                                       )}
                                    </div>

                                    <h3>{game.title}</h3>
                                    <p className="locked-message">
                                       Complete previous games to unlock
                                    </p>
                                    <div className="game-meta">
                                       <span>
                                          <StarIcon
                                             style={{
                                                width: 14,
                                                height: 14,
                                                display: "inline",
                                                marginRight: 4,
                                             }}
                                          />
                                          Difficulty:{" "}
                                          {"★".repeat(game.difficulty)}
                                       </span>
                                       <span>
                                          <ClockIcon
                                             style={{
                                                width: 14,
                                                height: 14,
                                                display: "inline",
                                                marginRight: 4,
                                             }}
                                          />
                                          Time: {game.time_limit}s
                                       </span>
                                       <span>
                                          Target: {game.passing_score}%
                                       </span>
                                    </div>
                                 </div>
                              );
                           })
                        )}
                     </div>
                  </div>
               )}
            </>
         )}
         <Footer />
      </div>
   );
}
