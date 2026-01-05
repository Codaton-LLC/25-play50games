"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Game } from "@/types/game";
import { getAllGames } from "@/lib/api/games";
import {
   getGuestId,
   getAllProgress,
   getAllProgressSync,
} from "@/lib/storage/progressStorage";
import UnlockSystem from "@/components/UnlockSystem/UnlockSystem";
import { getGameInstructions } from "@/lib/utils/gameInstructions";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import {
   TrophyIcon,
   CheckBadgeIcon,
   InformationCircleIcon,
   ClockIcon,
   StarIcon,
   PuzzlePieceIcon,
   BoltIcon,
   SparklesIcon,
   FireIcon,
   LightBulbIcon,
   UserIcon,
   ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";

type GameCategory = "all" | "logic" | "memory" | "speed" | "skill" | "final";

export default function HomePage() {
   const {
      user,
      isAuthenticated,
      login,
      register,
      logout,
      isLoading: authLoading,
   } = useAuth();
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

   const getInstructionsExcerpt = (text: string, maxLength = 256) => {
      const plainText = text
         .replace(/<[^>]*>/g, " ")
         .replace(/\s+/g, " ")
         .trim();
      if (plainText.length <= maxLength) return plainText;
      return `${plainText.slice(0, maxLength - 3).trimEnd()}...`;
   };

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
            setGameProgress(progressMap);
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
      setGameProgress(progressMap);
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

   if (loading) {
      return (
         <div
            style={{
               display: "flex",
               justifyContent: "center",
               alignItems: "center",
               minHeight: "100vh",
               width: "100%",
            }}
         >
            <span className="loader"></span>
         </div>
      );
   }

   // if (error) {
   //   return (
   //     <div className="home-page">
   //       <header>
   //         <h1>Play50Games</h1>
   //       </header>
   //       <div className="error-message">
   //         <h2>Connection Error</h2>
   //         <p>{error}</p>
   //         <p className="error-hint">
   //           <strong>To fix this:</strong><br />
   //           1. Make sure WordPress is running<br />
   //           2. Create a <code>.env.local</code> file with:<br />
   //           <code>NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1</code><br />
   //           3. Restart the Next.js dev server
   //         </p>
   //         <button onClick={loadGames} className="retry-button">Retry</button>
   //       </div>
   //     </div>
   //   );
   // }

   return (
      <div className="home-page">
         <header>
            <h1>Play50Games</h1>
            <p>Complete all games to earn your certificate!</p>

            {/* Auth Section */}
            <div
               style={{
                  marginTop: "1rem",
                  padding: "1rem",
                  backgroundColor: isAuthenticated
                     ? "rgba(134, 239, 172, 0.1)"
                     : "rgba(255, 255, 255, 0.06)",
                  border: `1px solid ${
                     isAuthenticated
                        ? "rgba(134, 239, 172, 0.3)"
                        : "var(--stroke)"
                  }`,
                  borderRadius: "12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
               }}
            >
               {isAuthenticated && user ? (
                  <>
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "0.5rem",
                        }}
                     >
                        <UserIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--secondary)",
                           }}
                        />
                        <span
                           style={{ fontWeight: "bold", color: "var(--text)" }}
                        >
                           Welcome, {user.display_name || user.email}!
                        </span>
                        <span
                           style={{ color: "var(--muted)", fontSize: "0.9rem" }}
                        >
                           (Your progress is saved)
                        </span>
                     </div>
                     <button
                        onClick={logout}
                        style={{
                           padding: "9px 16px",
                           backgroundColor: "rgba(252, 165, 165, 0.15)",
                           color: "var(--warn)",
                           border: "1px solid rgba(252, 165, 165, 0.35)",
                           borderRadius: "12px",
                           cursor: "pointer",
                           display: "flex",
                           alignItems: "center",
                           gap: "0.5rem",
                           fontWeight: "600",
                           fontSize: "14px",
                           transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                           e.currentTarget.style.backgroundColor =
                              "rgba(252, 165, 165, 0.25)";
                           e.currentTarget.style.borderColor =
                              "rgba(252, 165, 165, 0.5)";
                        }}
                        onMouseLeave={(e) => {
                           e.currentTarget.style.backgroundColor =
                              "rgba(252, 165, 165, 0.15)";
                           e.currentTarget.style.borderColor =
                              "rgba(252, 165, 165, 0.35)";
                        }}
                     >
                        <ArrowRightOnRectangleIcon
                           style={{ width: 18, height: 18 }}
                        />
                        Logout
                     </button>
                  </>
               ) : (
                  <>
                     <div
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "0.5rem",
                        }}
                     >
                        <span
                           style={{ fontWeight: "bold", color: "var(--text)" }}
                        >
                           Playing as Guest
                        </span>
                        <span
                           style={{ color: "var(--muted)", fontSize: "0.9rem" }}
                        >
                           (Progress saved locally)
                        </span>
                     </div>
                     <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                           onClick={() => setShowLoginModal(true)}
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(125, 211, 252, 0.14)",
                              color: "var(--accent)",
                              border: "1px solid rgba(125, 211, 252, 0.35)",
                              borderRadius: "12px",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(125, 211, 252, 0.24)";
                              e.currentTarget.style.borderColor =
                                 "rgba(125, 211, 252, 0.5)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(125, 211, 252, 0.14)";
                              e.currentTarget.style.borderColor =
                                 "rgba(125, 211, 252, 0.35)";
                           }}
                        >
                           Login
                        </button>
                        <button
                           onClick={() => setShowRegisterModal(true)}
                           style={{
                              padding: "9px 16px",
                              backgroundColor: "rgba(134, 239, 172, 0.14)",
                              color: "var(--secondary)",
                              border: "1px solid rgba(134, 239, 172, 0.35)",
                              borderRadius: "12px",
                              cursor: "pointer",
                              fontWeight: "600",
                              fontSize: "14px",
                              transition: "all 0.2s ease",
                           }}
                           onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(134, 239, 172, 0.24)";
                              e.currentTarget.style.borderColor =
                                 "rgba(134, 239, 172, 0.5)";
                           }}
                           onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                 "rgba(134, 239, 172, 0.14)";
                              e.currentTarget.style.borderColor =
                                 "rgba(134, 239, 172, 0.35)";
                           }}
                        >
                           Register
                        </button>
                     </div>
                  </>
               )}
            </div>
         </header>

         <nav className="main-nav">
            <Link href="/progress">
               <TrophyIcon className="nav-icon" />
               View Progress
            </Link>
            <Link href="/certificate">
               <CheckBadgeIcon className="nav-icon" />
               Certificate
            </Link>
            <Link href="/diagnostics">
               <InformationCircleIcon className="nav-icon" />
               Diagnostics
            </Link>
         </nav>

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

         {error && (
            <div
               style={{
                  margin: "1rem auto",
                  maxWidth: "800px",
                  padding: "1rem",
                  backgroundColor: "#fee",
                  border: "2px solid #fcc",
                  borderRadius: "8px",
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
                                       const displayDescription =
                                          game.description ||
                                          instructions.description;
                                       const instructionsExcerpt =
                                          getInstructionsExcerpt(
                                             instructions.instructions || ""
                                          );

                                       const isCompleted =
                                          gameProgress[game.id]?.completed ||
                                          false;

                                       return (
                                          <div
                                             key={game.id}
                                             className={`game-card ${
                                                !game.is_unlocked
                                                   ? "locked"
                                                   : ""
                                             } ${
                                                isCompleted ? "completed" : ""
                                             }`}
                                          >
                                             <UnlockSystem game={game} />
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
                                             {game.is_unlocked ? (
                                                <Link
                                                   href={`/games/${game.id}`}
                                                >
                                                   <h3>{game.title}</h3>
                                                   <p className="game-description">
                                                      {displayDescription}
                                                   </p>
                                                   <div className="game-instructions">
                                                      <p className="instructions-text">
                                                         {instructionsExcerpt}
                                                      </p>
                                                      {instructions.tips && (
                                                         <p
                                                            className="game-tips"
                                                            style={{
                                                               display: "flex",
                                                               alignItems:
                                                                  "center",
                                                               gap: "6px",
                                                            }}
                                                         >
                                                            <LightBulbIcon
                                                               style={{
                                                                  width: 16,
                                                                  height: 16,
                                                                  flexShrink: 0,
                                                               }}
                                                            />
                                                            {instructions.tips}
                                                         </p>
                                                      )}
                                                   </div>
                                                   <div className="game-meta">
                                                      <span>
                                                         <StarIcon
                                                            style={{
                                                               width: 14,
                                                               height: 14,
                                                               display:
                                                                  "inline",
                                                               marginRight: 4,
                                                            }}
                                                         />
                                                         Difficulty:{" "}
                                                         {"★".repeat(
                                                            game.difficulty
                                                         )}
                                                      </span>
                                                      <span>
                                                         <ClockIcon
                                                            style={{
                                                               width: 14,
                                                               height: 14,
                                                               display:
                                                                  "inline",
                                                               marginRight: 4,
                                                            }}
                                                         />
                                                         Time: {game.time_limit}
                                                         s
                                                      </span>
                                                      <span>
                                                         Target:{" "}
                                                         {game.passing_score}%
                                                      </span>
                                                   </div>
                                                </Link>
                                             ) : (
                                                <div>
                                                   <h3>{game.title}</h3>
                                                   <p className="locked-message">
                                                      Complete previous games to
                                                      unlock
                                                   </p>
                                                   <div className="game-meta">
                                                      <span>
                                                         Difficulty:{" "}
                                                         {"★".repeat(
                                                            game.difficulty
                                                         )}
                                                      </span>
                                                      <span>
                                                         Time: {game.time_limit}
                                                         s
                                                      </span>
                                                   </div>
                                                </div>
                                             )}
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
                  <div className="games-grid">
                     {filteredGames.length === 0 ? (
                        <div className="no-games">
                           <p>
                              No {categoryLabels[selectedCategory].label} games
                              found.
                           </p>
                        </div>
                     ) : (
                        filteredGames.map((game) => {
                           const gameType = game.game_config?.gameType || "";
                           const instructions = getGameInstructions(
                              gameType,
                              game.title
                           );
                           const displayDescription =
                              game.description || instructions.description;
                           const instructionsExcerpt = getInstructionsExcerpt(
                              instructions.instructions || ""
                           );
                           const isCompleted =
                              gameProgress[game.id]?.completed || false;

                           return (
                              <div
                                 key={game.id}
                                 className={`game-card ${
                                    !game.is_unlocked ? "locked" : ""
                                 } ${isCompleted ? "completed" : ""}`}
                              >
                                 <UnlockSystem game={game} />
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
                                 {game.is_unlocked ? (
                                    <Link href={`/games/${game.id}`}>
                                       <h3>{game.title}</h3>
                                       <p className="game-description">
                                          {displayDescription}
                                       </p>
                                       <div className="game-instructions">
                                          <p className="instructions-text">
                                             {instructionsExcerpt}
                                          </p>
                                          {instructions.tips && (
                                             <p
                                                className="game-tips"
                                                style={{
                                                   display: "flex",
                                                   alignItems: "center",
                                                   gap: "6px",
                                                }}
                                             >
                                                <LightBulbIcon
                                                   style={{
                                                      width: 16,
                                                      height: 16,
                                                      flexShrink: 0,
                                                   }}
                                                />
                                                {instructions.tips}
                                             </p>
                                          )}
                                       </div>
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
                                    <div>
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
                                       </div>
                                    </div>
                                 )}
                              </div>
                           );
                        })
                     )}
                  </div>
               )}
            </>
         )}
      </div>
   );
}
