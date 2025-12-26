"use client";

import { useState, useEffect, useCallback } from "react";
import { Game } from "@/types/game";
import { saveProgress } from "@/lib/storage/progressStorage";
import { getGameInstructions } from "@/lib/utils/gameInstructions";
import {
   XMarkIcon,
   CheckCircleIcon,
   XCircleIcon,
   ClockIcon,
   TrophyIcon,
   LightBulbIcon,
   PlayIcon,
   ArrowLeftIcon,
   MoonIcon,
   BoltIcon,
   ArrowDownIcon,
   InformationCircleIcon,
   ArrowRightIcon,
   CircleStackIcon,
   HomeIcon,
   StarIcon,
   HeartIcon,
} from "@heroicons/react/24/outline";
import LogicGames from "./game-types/LogicGames";
import MemoryGames from "./game-types/MemoryGames";
import SpeedGames from "./game-types/SpeedGames";
import SkillGames from "./game-types/SkillGames";
import FinalGames from "./game-types/FinalGames";
import KeyboardControls, { MouseControls } from "./KeyboardControls";

interface GameEngineProps {
   game: Game;
   onComplete: (score: number) => void;
   onExit: () => void;
}

export default function GameEngine({
   game,
   onComplete,
   onExit,
}: GameEngineProps) {
   const [score, setScore] = useState(0);
   const [timeLeft, setTimeLeft] = useState(game.time_limit);
   const [isPlaying, setIsPlaying] = useState(false);
   const [isCompleted, setIsCompleted] = useState(false);

   useEffect(() => {
      if (!isPlaying || isCompleted) return;

      const timer = setInterval(() => {
         setTimeLeft((prev) => {
            if (prev <= 1) {
               handleGameEnd();
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isPlaying, isCompleted]);

   const handleGameEnd = useCallback(
      async (finalScore?: number) => {
         if (isCompleted) return;

         setIsCompleted(true);
         setIsPlaying(false);

         // Use provided finalScore or fall back to current score state
         const actualScore = finalScore !== undefined ? finalScore : score;

         const completed = actualScore >= game.passing_score;

         // Update score state if finalScore was provided
         if (finalScore !== undefined) {
            setScore(finalScore);
         }

         // Save progress
         await saveProgress(game.id, actualScore, completed);

         // Call completion callback
         onComplete(actualScore);
      },
      [score, game, isCompleted, onComplete]
   );

   const startGame = () => {
      setIsPlaying(true);
      setTimeLeft(game.time_limit);
      setScore(0);
      setIsCompleted(false);
   };

   const updateScore = (newScore: number) => {
      setScore(newScore);
   };

   const renderGame = () => {
      // Ensure game_config is parsed correctly (it should already be an object from API)
      let gameConfig = game.game_config || {};
      
      // If game_config is a string, parse it
      if (typeof gameConfig === 'string') {
         try {
            gameConfig = JSON.parse(gameConfig);
         } catch (e) {
            console.error('[GameEngine] Failed to parse game_config:', e);
            gameConfig = {};
         }
      }
      
      // Debug log for Pattern Completion
      if (gameConfig?.gameType === 'pattern-completion') {
         console.log('[GameEngine] Pattern Completion config:', gameConfig);
      }

      switch (game.game_type) {
         case "logic":
            return (
               <LogicGames
                  config={gameConfig}
                  gameTitle={game.title}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
                  passingScore={game.passing_score}
               />
            );
         case "memory":
            return (
               <MemoryGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         case "speed":
            return (
               <SpeedGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         case "skill":
            return (
               <SkillGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         case "final":
            return (
               <FinalGames
                  config={gameConfig}
                  onScoreUpdate={updateScore}
                  onComplete={handleGameEnd}
                  isPlaying={isPlaying}
               />
            );
         default:
            return <div>Unknown game type</div>;
      }
   };

   if (!isPlaying && !isCompleted) {
      const gameType = game.game_config?.gameType || "";
      const instructions = getGameInstructions(gameType, game.title);
      const displayDescription = game.description || instructions.description;
      const gridSize = game.game_config?.gridSize || 3;

      return (
         <div className="game-start-screen">
            <h2>{game.title}</h2>
            <p className="game-description">{displayDescription}</p>

            <div className="game-instructions-section">
               <h3>How to Play</h3>
               <p className="instructions-text">{instructions.instructions}</p>

               {/* Interactive Example for Pattern Completion */}
               {gameType === "pattern-completion" && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        How It Works
                     </h4>
                     
                     {/* Example: Pattern Completion */}
                     <div style={{ marginBottom: "20px" }}>
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--muted)",
                              marginBottom: "12px",
                              fontWeight: 600,
                           }}
                        >
                           Look at the pattern and find the missing shape
                        </p>
                        
                        {/* Example Pattern */}
                        <div
                           style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "16px",
                              background: "rgba(255, 255, 255, 0.02)",
                              borderRadius: "12px",
                              border: "2px solid var(--stroke)",
                              marginBottom: "16px",
                              flexWrap: "nowrap",
                              overflowX: "auto",
                           }}
                        >
                           {/* Pattern: Home, Star, Home, ?, Star */}
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "linear-gradient(135deg, rgba(125, 211, 252, 0.2) 0%, rgba(125, 211, 252, 0.1) 100%)",
                                 border: "2px dashed var(--accent)",
                                 borderRadius: "12px",
                                 position: "relative",
                              }}
                           >
                              <span
                                 style={{
                                    fontSize: "1.5rem",
                                    fontWeight: 700,
                                    color: "var(--accent)",
                                 }}
                              >
                                 ?
                              </span>
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 minWidth: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--accent)",
                                 }}
                              />
                           </div>
                        </div>

                        {/* Options */}
                        <p
                           style={{
                              fontSize: "0.85rem",
                              color: "var(--muted)",
                              marginBottom: "8px",
                              fontWeight: 600,
                           }}
                        >
                           Choose the correct shape:
                        </p>
                        <div
                           style={{
                              display: "flex",
                              gap: "12px",
                              alignItems: "center",
                              justifyContent: "center",
                              marginBottom: "12px",
                           }}
                        >
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "linear-gradient(135deg, rgba(134, 239, 172, 0.2) 0%, rgba(134, 239, 172, 0.1) 100%)",
                                 border: "2px solid #86efac",
                                 borderRadius: "12px",
                                 position: "relative",
                              }}
                           >
                              <HomeIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "#86efac",
                                 }}
                              />
                              <CheckCircleIcon
                                 style={{
                                    position: "absolute",
                                    top: "-4px",
                                    right: "-4px",
                                    width: 20,
                                    height: 20,
                                    color: "#86efac",
                                    background: "var(--bg)",
                                    borderRadius: "50%",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <StarIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <HeartIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                           <div
                              style={{
                                 width: "60px",
                                 height: "60px",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 background: "var(--card)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px",
                                 opacity: 0.5,
                              }}
                           >
                              <CircleStackIcon
                                 style={{
                                    width: 40,
                                    height: 40,
                                    color: "var(--muted)",
                                 }}
                              />
                           </div>
                        </div>

                        {/* Explanation */}
                        <div
                           style={{
                              marginTop: "16px",
                              padding: "12px",
                              background: "rgba(134, 239, 172, 0.1)",
                              borderRadius: "12px",
                              border: "2px solid rgba(134, 239, 172, 0.3)",
                           }}
                        >
                           <p
                              style={{
                                 fontSize: "0.85rem",
                                 color: "#86efac",
                                 margin: 0,
                                 fontWeight: 600,
                              }}
                           >
                              Pattern: Home → Star → Home → ? → Star
                           </p>
                           <p
                              style={{
                                 fontSize: "0.8rem",
                                 color: "var(--muted)",
                                 margin: "4px 0 0 0",
                              }}
                           >
                              The pattern repeats: Home, Star, Home, Star... So the missing shape is <strong style={{ color: "#86efac" }}>Home</strong> ✓
                           </p>
                        </div>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Circuit Path */}
               {(gameType === "light-switch" ||
                  gameType === "circuit-path") && (
                  <div className="solution-preview">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                           marginBottom: "12px",
                        }}
                     >
                        <InformationCircleIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--accent)",
                           }}
                        />
                        How It Works
                     </h4>
                     
                     {/* Example: Circuit Path */}
                     <div style={{ marginBottom: "20px" }}>
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--muted)",
                              marginBottom: "8px",
                              fontWeight: 600,
                           }}
                        >
                           Click nodes to create a path from Start (green) to End (red)
                        </p>
                        <div
                           className="light-grid-preview"
                           style={{
                              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                              display: "grid",
                              gap: "8px",
                              padding: "12px",
                              background: "rgba(255, 255, 255, 0.02)",
                              borderRadius: "12px",
                              border: "2px solid var(--stroke)",
                              maxWidth: "300px",
                              margin: "0 auto",
                           }}
                        >
                           {Array(gridSize * gridSize)
                              .fill(null)
                              .map((_, i) => {
                                 const row = Math.floor(i / gridSize);
                                 const col = i % gridSize;
                                 const isStart = row === 0 && col === 0;
                                 const isEnd =
                                    row === gridSize - 1 &&
                                    col === gridSize - 1;
                                 const inPath =
                                    (row === 0 && col === 1) ||
                                    (row === 1 && col === 1) ||
                                    (row === 1 && col === 2) ||
                                    (row === 2 && col === 2);

                                 return (
                                    <div
                                       key={i}
                                       className={`light-cell-preview ${
                                          isStart ? "start" : ""
                                       } ${isEnd ? "end" : ""} ${
                                          inPath ? "in-path" : ""
                                       }`}
                                       style={{
                                          aspectRatio: "1",
                                          minWidth: "60px",
                                          minHeight: "60px",
                                          display: "flex",
                                          flexDirection: "column",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          border: `2px solid ${
                                             isStart
                                                ? "rgba(34, 197, 94, 0.6)"
                                                : isEnd
                                                ? "rgba(239, 68, 68, 0.6)"
                                                : inPath
                                                ? "var(--accent)"
                                                : "var(--stroke)"
                                          }`,
                                          borderRadius: "12px",
                                          background: isStart
                                             ? "linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.15) 100%)"
                                             : isEnd
                                             ? "linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0.15) 100%)"
                                             : inPath
                                             ? "linear-gradient(135deg, rgba(125, 211, 252, 0.3) 0%, rgba(125, 211, 252, 0.15) 100%)"
                                             : "linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)",
                                       }}
                                    >
                                       {isStart ? (
                                          <span
                                             style={{
                                                fontSize: "0.6rem",
                                                color: "#22c55e",
                                                fontWeight: 600,
                                             }}
                                          >
                                             Start
                                          </span>
                                       ) : isEnd ? (
                                          <>
                                             <TrophyIcon
                                                style={{
                                                   width: 24,
                                                   height: 24,
                                                   color: "#ef4444",
                                                }}
                                             />
                                             <span
                                                style={{
                                                   fontSize: "0.6rem",
                                                   color: "#ef4444",
                                                   marginTop: "2px",
                                                   fontWeight: 600,
                                                }}
                                             >
                                                End
                                             </span>
                                          </>
                                       ) : inPath ? (
                                          <CircleStackIcon
                                             style={{
                                                width: 24,
                                                height: 24,
                                                color: "var(--accent)",
                                             }}
                                          />
                                       ) : (
                                          <CircleStackIcon
                                             style={{
                                                width: 24,
                                                height: 24,
                                                color: "var(--muted)",
                                                opacity: 0.3,
                                             }}
                                          />
                                       )}
                                    </div>
                                 );
                              })}
                        </div>
                     </div>

                     {/* Goal */}
                     <div
                        style={{
                           marginTop: "20px",
                           padding: "12px",
                           background: "rgba(134, 239, 172, 0.1)",
                           borderRadius: "12px",
                           border: "2px solid rgba(134, 239, 172, 0.3)",
                        }}
                     >
                        <p
                           style={{
                              fontSize: "0.9rem",
                              color: "var(--ok)",
                              textAlign: "center",
                              fontWeight: 600,
                              margin: 0,
                           }}
                        >
                            Goal: Create a continuous path from Start (green) to End (red) by clicking adjacent nodes!
                        </p>
                     </div>
                  </div>
               )}

               {instructions.tips && (
                  <div className="game-tips">
                     <h4
                        style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "8px",
                        }}
                     >
                        <LightBulbIcon
                           style={{
                              width: 20,
                              height: 20,
                              color: "var(--secondary)",
                           }}
                        />
                        Tips
                     </h4>
                     <p className="tips-text">{instructions.tips}</p>

                     {/* Mouse Controls - General Component */}
                     {instructions.mouseControls && (
                        <MouseControls controls={instructions.mouseControls} />
                     )}

                     {/* Keyboard Controls - General Component */}
                     {instructions.keyboardControls && (
                        <KeyboardControls
                           controls={instructions.keyboardControls}
                        />
                     )}
                  </div>
               )}
            </div>

            <div className="game-info">
               <div className="info-item">
                  <span
                     className="info-label"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <ClockIcon style={{ width: 18, height: 18 }} />
                     Time Limit:
                  </span>
                  <span className="info-value">{game.time_limit} seconds</span>
               </div>
               <div className="info-item">
                  <span
                     className="info-label"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     <TrophyIcon style={{ width: 18, height: 18 }} />
                     Passing Score:
                  </span>
                  <span className="info-value">{game.passing_score}</span>
               </div>
            </div>

            <div className="game-start-actions">
               <button
                  onClick={startGame}
                  className="start-button"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
               >
                  <PlayIcon style={{ width: 20, height: 20 }} />
                  Start Game
               </button>
               <button
                  onClick={onExit}
                  className="exit-button"
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
               >
                  <ArrowLeftIcon style={{ width: 18, height: 18 }} />
                  Exit
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className="game-engine">
         <div className="game-header">
            <div className="game-title">{game.title}</div>
            <div className="game-stats">
               <div className="stat">
                  <span>Score:</span>
                  <strong>{score}</strong>
               </div>
               <div className="stat">
                  <span>Time:</span>
                  <strong>{timeLeft}s</strong>
               </div>
               <div className="stat">
                  <span>Target:</span>
                  <strong>{game.passing_score}</strong>
               </div>
            </div>
            <button onClick={onExit} className="exit-button-small">
               <XMarkIcon style={{ width: 20, height: 20 }} />
            </button>
         </div>

         <div className="game-content">{renderGame()}</div>

         {isCompleted && (
            <div className="game-complete-overlay">
               <div className="completion-message">
                  <h2>Game Complete!</h2>
                  <p>Final Score: {score}</p>
                  <div
                     className={
                        score >= game.passing_score ? "success" : "failure"
                     }
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                     }}
                  >
                     {score >= game.passing_score ? (
                        <>
                           <CheckCircleIcon style={{ width: 20, height: 20 }} />
                           <span>Passed!</span>
                        </>
                     ) : (
                        <>
                           <XCircleIcon style={{ width: 20, height: 20 }} />
                           <span>Try Again</span>
                        </>
                     )}
                  </div>
                  <button
                     onClick={onExit}
                     className="continue-button"
                     style={{
                        marginTop: "20px",
                        padding: "12px 24px",
                        fontSize: "16px",
                        fontWeight: "600",
                        cursor: "pointer",
                     }}
                  >
                     Continue
                  </button>
               </div>
            </div>
         )}
      </div>
   );
}
