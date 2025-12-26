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
   ArrowUpIcon,
   MoonIcon,
   BoltIcon,
   ArrowDownIcon,
   InformationCircleIcon,
   ArrowRightIcon,
   CircleStackIcon,
   HomeIcon,
   StarIcon,
   HeartIcon,
   ScaleIcon,
   ArrowPathIcon,
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
      
      // If game_config is null or undefined, set to empty object
      if (!gameConfig || (typeof gameConfig === 'object' && Object.keys(gameConfig).length === 0 && gameConfig.constructor === Object)) {
         console.warn('[GameEngine] game_config is empty or null for game:', game.title, game.id);
         gameConfig = {};
      }
      
      // Debug logging removed to reduce console noise.

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

               {/* Enhanced Start Screen for Mirror Match */}
               {gameType === "mirror-match" && (
                  <div style={{
                     background: "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(54, 211, 153, 0.1) 100%)",
                     border: "2px solid var(--stroke)",
                     borderRadius: "20px",
                     padding: "32px",
                     marginTop: "24px",
                     boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)"
                  }}>
                     <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "12px",
                        marginBottom: "24px"
                     }}>
                        <ScaleIcon style={{ width: 28, height: 28, color: "var(--accent)" }} />
                        <h3 style={{
                           fontSize: "24px",
                           fontWeight: 700,
                           margin: 0,
                           background: "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                           WebkitBackgroundClip: "text",
                           WebkitTextFillColor: "transparent",
                           backgroundClip: "text"
                        }}>
                           Mirror Types Explained
                        </h3>
                     </div>

                     <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(3, 1fr)", 
                        gap: "20px",
                        marginBottom: "24px"
                     }}>
                        {/* Horizontal Mirror */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center",
                           transition: "all 0.3s ease",
                           boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                           }}>
                              <ArrowPathIcon style={{ width: 18, height: 18 }} />
                              Horizontal
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "12px",
                              minHeight: "180px"
                           }}>
                              <div style={{
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "20px", 
                                 color: "var(--accent)",
                                 fontWeight: 600
                              }}>→</div>
                              <div style={{
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)",
                                 transform: "scaleX(-1)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "13px", 
                                 color: "var(--muted)", 
                                 marginTop: "8px",
                                 fontWeight: 600
                              }}>
                                 Flips left ↔ right
                              </div>
                           </div>
                        </div>

                        {/* Vertical Mirror */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center",
                           transition: "all 0.3s ease",
                           boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                           }}>
                              <ArrowPathIcon style={{ width: 18, height: 18, transform: "rotate(90deg)" }} />
                              Vertical
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "12px",
                              minHeight: "180px"
                           }}>
                              <div style={{
                                 background: "rgba(54, 211, 153, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "20px", 
                                 color: "var(--ok)",
                                 fontWeight: 600
                              }}>↓</div>
                              <div style={{
                                 background: "rgba(54, 211, 153, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)",
                                 transform: "scaleY(-1)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "13px", 
                                 color: "var(--muted)", 
                                 marginTop: "8px",
                                 fontWeight: 600
                              }}>
                                 Flips top ↔ bottom
                              </div>
                           </div>
                        </div>

                        {/* Diagonal Mirror */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center",
                           transition: "all 0.3s ease",
                           boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px"
                           }}>
                              <ArrowPathIcon style={{ width: 18, height: 18, transform: "rotate(45deg)" }} />
                              Diagonal
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: "12px",
                              minHeight: "180px"
                           }}>
                              <div style={{
                                 background: "rgba(168, 85, 247, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "20px", 
                                 color: "#a855f7",
                                 fontWeight: 600
                              }}>↻</div>
                              <div style={{
                                 background: "rgba(168, 85, 247, 0.1)",
                                 borderRadius: "12px",
                                 padding: "16px",
                                 border: "1px solid var(--stroke)",
                                 transform: "scale(-1, -1)"
                              }}>
                                 <svg viewBox="0 0 100 100" width="80" height="80" style={{ stroke: "rgba(232, 238, 252, 0.92)", strokeWidth: "10", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
                                    <path d="M20 60 L52 28" />
                                    <path d="M52 28 L66 42" />
                                    <path d="M66 42 L60 48" />
                                    <circle cx="22" cy="62" r="4" fill="rgba(232, 238, 252, 0.92)" />
                                 </svg>
                              </div>
                              <div style={{ 
                                 fontSize: "13px", 
                                 color: "var(--muted)", 
                                 marginTop: "8px",
                                 fontWeight: 600
                              }}>
                                 Flips both ways
                              </div>
                           </div>
                        </div>
                     </div>

                     <div style={{
                        background: "rgba(11, 22, 48, 0.4)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "12px",
                        padding: "20px",
                        marginTop: "24px"
                     }}>
                        <div style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "12px",
                           marginBottom: "12px"
                        }}>
                           <LightBulbIcon style={{ width: 20, height: 20, color: "var(--accent)" }} />
                           <h4 style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              margin: 0,
                              color: "var(--text)"
                           }}>
                              How to Play
                           </h4>
                        </div>
                        <ul style={{
                           margin: 0,
                           paddingLeft: "24px",
                           color: "var(--muted)",
                           fontSize: "14px",
                           lineHeight: "1.8"
                        }}>
                           <li>Look at the main shape at the top</li>
                           <li>Read the mirror type (Horizontal, Vertical, or Diagonal)</li>
                           <li>Select the option that shows the correct mirror transformation</li>
                           <li>You have 3 options - only one is correct!</li>
                           <li>Use number keys <strong style={{ color: "var(--accent)" }}>1, 2, 3</strong> for quick selection</li>
                        </ul>
                     </div>
                  </div>
               )}

               {/* Sequence Arrows Start Screen Preview */}
               {gameType === "sequence-arrows" && (
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
                        How Sequence Arrows Works
                     </h4>
                     <div style={{ marginBottom: "20px" }}>
                        <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "16px" }}>
                           You will see a sequence of arrows (↑ ↓ ← →) with one missing arrow shown as <strong style={{ color: "var(--accent)" }}>?</strong>. 
                           Your task is to predict which arrow should come next in the sequence.
                        </p>
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginBottom: "16px"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                           }}>
                              <ArrowPathIcon style={{ width: 18, height: 18 }} />
                              Example Sequence
                           </div>
                           <div style={{
                              display: "flex",
                              gap: "16px",
                              justifyContent: "center",
                              alignItems: "center",
                              marginBottom: "16px",
                              flexWrap: "wrap"
                           }}>
                              <div style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "64px",
                                 height: "64px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px"
                              }}>
                                 <ArrowUpIcon style={{ width: 40, height: 40, color: "var(--accent)" }} />
                              </div>
                              <div style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "64px",
                                 height: "64px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px"
                              }}>
                                 <ArrowRightIcon style={{ width: 40, height: 40, color: "var(--accent)" }} />
                              </div>
                              <div style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "64px",
                                 height: "64px",
                                 background: "rgba(255, 255, 255, 0.05)",
                                 border: "2px solid var(--stroke)",
                                 borderRadius: "12px"
                              }}>
                                 <ArrowDownIcon style={{ width: 40, height: 40, color: "var(--accent)" }} />
                              </div>
                              <div style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "64px",
                                 height: "64px",
                                 background: "rgba(125, 211, 252, 0.2)",
                                 border: "2px solid var(--accent)",
                                 borderRadius: "12px",
                                 fontSize: "1.5rem",
                                 fontWeight: 700,
                                 color: "var(--accent)"
                              }}>
                                 ?
                              </div>
                              <div style={{
                                 fontSize: "24px",
                                 color: "var(--muted)",
                                 fontWeight: 600,
                                 margin: "0 8px"
                              }}>
                                 →
                              </div>
                              <div style={{
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 width: "64px",
                                 height: "64px",
                                 background: "rgba(134, 239, 172, 0.2)",
                                 border: "2px solid var(--ok)",
                                 borderRadius: "12px",
                                 position: "relative"
                              }}>
                                 <ArrowLeftIcon style={{ width: 40, height: 40, color: "var(--ok)" }} />
                                 <CheckCircleIcon style={{
                                    position: "absolute",
                                    top: "-8px",
                                    right: "-8px",
                                    width: "20px",
                                    height: "20px",
                                    color: "var(--ok)",
                                    background: "var(--card)",
                                    borderRadius: "50%"
                                 }} />
                              </div>
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              marginTop: "12px"
                           }}>
                              <p style={{ fontSize: "0.85rem", color: "var(--muted)", textAlign: "center", fontStyle: "italic" }}>
                                 Pattern: Clockwise rotation (↑ → ↓ ←)
                              </p>
                              <p style={{ 
                                 fontSize: "0.9rem", 
                                 color: "var(--ok)", 
                                 textAlign: "center", 
                                 fontWeight: 600,
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 gap: "6px"
                              }}>
                                 <CheckCircleIcon style={{ width: 16, height: 16 }} />
                                 Answer: ← (Left Arrow)
                              </p>
                           </div>
                        </div>
                        <div style={{
                           background: "rgba(125, 211, 252, 0.1)",
                           border: "1px solid var(--stroke)",
                           borderRadius: "12px",
                           padding: "16px",
                           fontSize: "0.9rem",
                           color: "var(--text)",
                           marginBottom: "16px"
                        }}>
                           <strong style={{ color: "var(--accent)" }}>Tip:</strong> The sequence length increases as you progress. 
                           Pay attention to the pattern direction and repetition!
                        </div>
                        
                        {/* Patterns to Look For */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           marginTop: "16px"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px"
                           }}>
                              <LightBulbIcon style={{ width: 18, height: 18 }} />
                              What Patterns to Look For
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              fontSize: "0.9rem"
                           }}>
                              <div style={{
                                 padding: "12px",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "8px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <strong style={{ color: "var(--accent)" }}>Clockwise rotation:</strong> 
                                 <span style={{ color: "var(--text)", marginLeft: "8px" }}>↑ → ↓ ← (then repeats)</span>
                              </div>
                              <div style={{
                                 padding: "12px",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "8px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <strong style={{ color: "var(--accent)" }}>Counter-clockwise rotation:</strong> 
                                 <span style={{ color: "var(--text)", marginLeft: "8px" }}>↑ ← ↓ → (then repeats)</span>
                              </div>
                              <div style={{
                                 padding: "12px",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "8px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <strong style={{ color: "var(--accent)" }}>Repeating loops:</strong> 
                                 <span style={{ color: "var(--text)", marginLeft: "8px" }}>e.g., ↑ ↑ → → ↓ ↓ ← ←</span>
                              </div>
                              <div style={{
                                 padding: "12px",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "8px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <strong style={{ color: "var(--accent)" }}>Alternating directions:</strong> 
                                 <span style={{ color: "var(--text)", marginLeft: "8px" }}>e.g., ↑ → ↑ → …</span>
                              </div>
                              <div style={{
                                 padding: "12px",
                                 background: "rgba(125, 211, 252, 0.1)",
                                 borderRadius: "8px",
                                 border: "1px solid var(--stroke)"
                              }}>
                                 <strong style={{ color: "var(--accent)" }}>Step jumps:</strong> 
                                 <span style={{ color: "var(--text)", marginLeft: "8px" }}>skipping one direction each time</span>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {/* Interactive Example for Logic Gates */}
               {gameType === "logic-gates" && (
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
                        Logic Gates Explained
                     </h4>
                     
                     <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(3, 1fr)", 
                        gap: "20px",
                        marginBottom: "20px"
                     }}>
                        {/* AND Gate */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px"
                           }}>
                              AND Gate
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              fontSize: "14px",
                              color: "var(--muted)"
                           }}>
                              <div style={{ fontWeight: 600, color: "var(--text)" }}>Truth Table:</div>
                              <table style={{ width: "100%", fontSize: "12px" }}>
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>B</th>
                                       <th style={{ padding: "4px" }}>Output</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr><td>0</td><td>0</td><td>0</td></tr>
                                    <tr><td>0</td><td>1</td><td>0</td></tr>
                                    <tr><td>1</td><td>0</td><td>0</td></tr>
                                    <tr><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td></tr>
                                 </tbody>
                              </table>
                              <div style={{ fontSize: "12px", marginTop: "8px", fontStyle: "italic" }}>
                                 Output is 1 only when both inputs are 1
                              </div>
                           </div>
                        </div>

                        {/* OR Gate */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px"
                           }}>
                              OR Gate
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              fontSize: "14px",
                              color: "var(--muted)"
                           }}>
                              <div style={{ fontWeight: 600, color: "var(--text)" }}>Truth Table:</div>
                              <table style={{ width: "100%", fontSize: "12px" }}>
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>B</th>
                                       <th style={{ padding: "4px" }}>Output</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr><td>0</td><td>0</td><td>0</td></tr>
                                    <tr><td style={{ color: "var(--ok)", fontWeight: 700 }}>0</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td></tr>
                                    <tr><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td>0</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td></tr>
                                    <tr><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td></tr>
                                 </tbody>
                              </table>
                              <div style={{ fontSize: "12px", marginTop: "8px", fontStyle: "italic" }}>
                                 Output is 1 if at least one input is 1
                              </div>
                           </div>
                        </div>

                        {/* NOT Gate */}
                        <div style={{
                           background: "var(--card)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "16px",
                           padding: "24px",
                           textAlign: "center"
                        }}>
                           <div style={{ 
                              fontSize: "16px", 
                              fontWeight: 700, 
                              color: "var(--accent)",
                              marginBottom: "16px"
                           }}>
                              NOT Gate
                           </div>
                           <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "12px",
                              fontSize: "14px",
                              color: "var(--muted)"
                           }}>
                              <div style={{ fontWeight: 600, color: "var(--text)" }}>Truth Table:</div>
                              <table style={{ width: "100%", fontSize: "12px" }}>
                                 <thead>
                                    <tr>
                                       <th style={{ padding: "4px" }}>A</th>
                                       <th style={{ padding: "4px" }}>Output</th>
                                    </tr>
                                 </thead>
                                 <tbody>
                                    <tr><td>0</td><td style={{ color: "var(--ok)", fontWeight: 700 }}>1</td></tr>
                                    <tr><td>1</td><td>0</td></tr>
                                 </tbody>
                              </table>
                              <div style={{ fontSize: "12px", marginTop: "8px", fontStyle: "italic" }}>
                                 Output is the opposite of input
                              </div>
                           </div>
                        </div>
                     </div>

                     <div style={{
                        background: "rgba(11, 22, 48, 0.4)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "12px",
                        padding: "20px",
                        marginTop: "24px"
                     }}>
                        <div style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "12px",
                           marginBottom: "12px"
                        }}>
                           <LightBulbIcon style={{ width: 20, height: 20, color: "var(--accent)" }} />
                           <h4 style={{
                              fontSize: "16px",
                              fontWeight: 600,
                              margin: 0,
                              color: "var(--text)"
                           }}>
                              How to Play
                           </h4>
                        </div>
                        <ul style={{
                           margin: 0,
                           paddingLeft: "24px",
                           color: "var(--muted)",
                           fontSize: "14px",
                           lineHeight: "1.8"
                        }}>
                           <li>Look at the inputs (A and B) - they are either 0 or 1</li>
                           <li>Check the gate type (AND, OR, or NOT)</li>
                           <li>Calculate the output based on the gate's logic</li>
                           <li>Select the correct output (0 or 1)</li>
                           <li>When output is 1, the lamp lights up! 💡</li>
                           <li>Use number keys <strong style={{ color: "var(--accent)" }}>0</strong> or <strong style={{ color: "var(--accent)" }}>1</strong> for quick selection</li>
                        </ul>
                     </div>
                  </div>
               )}

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
