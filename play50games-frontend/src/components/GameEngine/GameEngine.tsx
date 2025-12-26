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
      const gameConfig = game.game_config || {};

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

      return (
         <div className="game-start-screen">
            <h2>{game.title}</h2>
            <p className="game-description">{displayDescription}</p>

            <div className="game-instructions-section">
               <h3>How to Play</h3>
               <p className="instructions-text">{instructions.instructions}</p>

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
