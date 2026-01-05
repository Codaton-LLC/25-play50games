"use client";

import { useState, useEffect } from "react";
import LogicGames from "./LogicGames";
import MemoryGames from "./MemoryGames";
import SpeedGames from "./SpeedGames";
import SkillGames from "./SkillGames";
import {
   CheckCircleIcon,
   TrophyIcon,
   ClockIcon,
   ArrowPathRoundedSquareIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";

// Lookup table for full game configs - maps gameType to full config
// These are the default configs from individual games in backend
// When only gameType is provided in miniGameConfigs, these full configs are used
const GAME_CONFIGS_LOOKUP: Record<string, Record<string, any>> = {
   // Logic games
   "number-order": {
      gameType: "number-order",
      numbers: 5,
      rounds: 20, // Default from NumberOrder component
   },
   // Memory games
   "number-recall": {
      gameType: "number-recall",
      rounds: 15, // Default from NumberRecall component
   },
   // Speed games
   "fast-math": {
      gameType: "fast-math",
      levels: 20,
      levelDuration: 30,
      levelRequirements: [
         { minCorrectAnswers: 5 },
         { minCorrectAnswers: 6 },
         { minCorrectAnswers: 7 },
         { minCorrectAnswers: 8 },
         { minCorrectAnswers: 9 },
         { minCorrectAnswers: 10 },
         { minCorrectAnswers: 11 },
         { minCorrectAnswers: 12 },
         { minCorrectAnswers: 13 },
         { minCorrectAnswers: 14 },
         { minCorrectAnswers: 15 },
         { minCorrectAnswers: 16 },
         { minCorrectAnswers: 17 },
         { minCorrectAnswers: 18 },
         { minCorrectAnswers: 19 },
         { minCorrectAnswers: 20 },
         { minCorrectAnswers: 21 },
         { minCorrectAnswers: 22 },
         { minCorrectAnswers: 23 },
         { minCorrectAnswers: 24 },
      ],
   },
   // Skill games
   "target-aim": {
      gameType: "target-aim",
      levels: 15,
      levelRequirements: [
         { minTargetsHit: 5, duration: 20 },
         { minTargetsHit: 7, duration: 20 },
         { minTargetsHit: 9, duration: 20 },
         { minTargetsHit: 11, duration: 20 },
         { minTargetsHit: 13, duration: 20 },
         { minTargetsHit: 15, duration: 20, movingTargets: true },
         { minTargetsHit: 17, duration: 20, movingTargets: true },
         { minTargetsHit: 19, duration: 20, multipleTargets: true },
         {
            minTargetsHit: 21,
            duration: 20,
            movingTargets: true,
            multipleTargets: true,
         },
         { minTargetsHit: 23, duration: 20, shrinkingTargets: true },
         {
            minTargetsHit: 25,
            duration: 20,
            movingTargets: true,
            shrinkingTargets: true,
         },
         {
            minTargetsHit: 27,
            duration: 20,
            multipleTargets: true,
            shrinkingTargets: true,
         },
         {
            minTargetsHit: 29,
            duration: 20,
            movingTargets: true,
            multipleTargets: true,
            shrinkingTargets: true,
         },
         {
            minTargetsHit: 31,
            duration: 20,
            movingTargets: true,
            multipleTargets: true,
            shrinkingTargets: true,
         },
         {
            minTargetsHit: 35,
            duration: 20,
            movingTargets: true,
            multipleTargets: true,
            shrinkingTargets: true,
         },
      ],
   },
};

interface FinalGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}

export default function FinalGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");
   const [score, setScore] = useState(0);
   const [round, setRound] = useState(0);

   useEffect(() => {
      if (!isPlaying) return;

      const gameType = config.gameType || "mixed-quiz";
      setCurrentGame(gameType);
      setRound(0);
      setScore(0);
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "mixed-quiz": (
         <MixedQuiz
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "survival-mode": (
         <SurvivalMode
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "boss-puzzle": (
         <BossPuzzle
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "time-challenge": (
         <TimeChallenge
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "final-test": (
         <FinalTest
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Final game "{currentGame}" not found.</div>
      )
   );
}

// Mixed Quiz Game (46)
function MixedQuiz({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const rounds = config.rounds || 5;
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [currentMiniGame, setCurrentMiniGame] = useState<string>("");
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [gameState, setGameState] = useState<"playing" | "ready" | "complete">(
      "playing"
   );

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
         setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   // Handle game completion
   useEffect(() => {
      if (round >= rounds && gameState === "complete") {
         // Score is already calculated as sum of points per round
         // Each round contributes 100/rounds, so total should be 100
         const finalScore = Math.round(score);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
   }, [round, rounds, score, gameState, onScoreUpdate, onComplete]);

   // Select random game only when round changes or game starts
   useEffect(() => {
      if (!isPlaying) return;
      if (round >= rounds) return;

      // Only select a new game when round changes or when starting
      const gameTypes = ["logic", "memory", "speed", "skill"];
      const randomType =
         gameTypes[Math.floor(Math.random() * gameTypes.length)];
      setCurrentMiniGame(randomType);
      setGameState("playing");
   }, [round, rounds, isPlaying]);

   const handleMiniGameComplete = (miniScore: number) => {
      // Each round contributes equally: 100 / rounds points
      // For example: 2 rounds = 50 + 50, 5 rounds = 20 + 20 + 20 + 20 + 20
      const pointsPerRound = 100 / rounds;

      // Add points for this completed round
      setScore((prevScore) => prevScore + pointsPerRound);

      // Increment round immediately when game completes
      setRound((prevRound) => {
         const newRound = prevRound + 1;

         // Check if this was the last round
         if (newRound >= rounds) {
            setGameState("complete");
         } else {
            setGameState("ready");
         }

         return newRound;
      });
   };

   const handleNextRound = () => {
      // Round is already incremented in handleMiniGameComplete
      // Just change state to playing to start next game
      setGameState("playing");
   };

   // Get mini game configs from config prop
   // If miniGameConfigs exists, use it; otherwise use defaults
   // If a config only has gameType, look up the full config from GAME_CONFIGS_LOOKUP
   const getFullGameConfig = (
      gameType: string,
      partialConfig: Record<string, any>
   ): Record<string, any> => {
      // If config already has full details (like levels, levelRequirements, etc.), use it as is
      if (
         partialConfig.levels ||
         partialConfig.rounds ||
         partialConfig.levelRequirements
      ) {
         return partialConfig;
      }

      // Otherwise, look up the full config from lookup table
      const fullConfig = GAME_CONFIGS_LOOKUP[gameType];
      if (fullConfig) {
         // Merge partial config (if any additional params) with full config
         return { ...fullConfig, ...partialConfig };
      }

      // Fallback: return partial config as is
      return partialConfig;
   };

   const defaultMiniGameConfigs: Record<string, Record<string, any>> = {
      logic: { gameType: "number-order" },
      memory: { gameType: "number-recall" },
      speed: { gameType: "fast-math" },
      skill: { gameType: "target-aim" },
   };

   const rawMiniGameConfigs: Record<
      string,
      Record<string, any>
   > = config.miniGameConfigs || config.gameConfigs || defaultMiniGameConfigs;

   // Expand configs: if only gameType is provided, get full config from lookup
   const miniGameConfigs: Record<string, Record<string, any>> = {};
   Object.keys(rawMiniGameConfigs).forEach((key) => {
      const partialConfig = rawMiniGameConfigs[key];
      const gameType = partialConfig.gameType;
      if (gameType) {
         miniGameConfigs[key] = getFullGameConfig(gameType, partialConfig);
      } else {
         miniGameConfigs[key] = partialConfig;
      }
   });

   const getGameTypeName = (type: string) => {
      const names: Record<string, string> = {
         logic: "Logic Challenge",
         memory: "Memory Challenge",
         speed: "Speed Challenge",
         skill: "Skill Challenge",
      };
      return names[type] || "Challenge";
   };

   const renderMiniGame = () => {
      const miniConfig = miniGameConfigs[currentMiniGame];
      if (!miniConfig) return <div>Loading...</div>;

      switch (currentMiniGame) {
         case "logic":
            return (
               <LogicGames
                  config={miniConfig}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleMiniGameComplete(s || 0)}
                  isPlaying={isPlaying && gameState === "playing"}
               />
            );
         case "memory":
            return (
               <MemoryGames
                  config={miniConfig}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleMiniGameComplete(s || 0)}
                  isPlaying={isPlaying && gameState === "playing"}
               />
            );
         case "speed":
            return (
               <SpeedGames
                  config={miniConfig}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleMiniGameComplete(s || 0)}
                  isPlaying={isPlaying && gameState === "playing"}
               />
            );
         case "skill":
            return (
               <SkillGames
                  config={miniConfig}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleMiniGameComplete(s || 0)}
                  isPlaying={isPlaying && gameState === "playing"}
               />
            );
         default:
            return <div>Unknown game type</div>;
      }
   };

   // Calculate current score based on completed rounds
   // Each round contributes 100/rounds points, so score is already the sum
   const currentScore = Math.round(score);
   const progress = rounds > 0 ? Math.round((round / rounds) * 100) : 0;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "16px" : "20px",
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: isMobile ? "16px" : "24px",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "12px" : "16px",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "8px" : "12px",
                  width: "100%",
               }}
            >
               <TrophyIcon
                  style={{
                     width: isMobile ? 24 : 28,
                     height: isMobile ? 24 : 28,
                     color: "var(--accent)",
                  }}
               />
               <h2
                  style={{
                     fontSize: isMobile
                        ? "1.5rem"
                        : isTablet
                        ? "1.75rem"
                        : "2rem",
                     fontWeight: 700,
                     margin: 0,
                     background:
                        "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                     WebkitBackgroundClip: "text",
                     WebkitTextFillColor: "transparent",
                     backgroundClip: "text",
                  }}
               >
                  Mixed Quiz
               </h2>
            </div>

            {/* Round and Score Info */}
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "12px" : "20px",
                  flexWrap: "wrap",
                  width: "100%",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "8px 14px" : "10px 18px",
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))",
                     border: "1px solid rgba(59, 130, 246, 0.3)",
                     borderRadius: "12px",
                  }}
               >
                  <ClockIcon
                     style={{
                        width: isMobile ? 16 : 18,
                        height: isMobile ? 16 : 18,
                        color: "var(--accent)",
                     }}
                  />
                  <span
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     Round {round + 1} / {rounds}
                  </span>
               </div>
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: isMobile ? "8px 14px" : "10px 18px",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.15), rgba(134, 239, 172, 0.08))",
                     border: "1px solid rgba(134, 239, 172, 0.3)",
                     borderRadius: "12px",
                  }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 16 : 18,
                        height: isMobile ? 16 : 18,
                        color: "var(--ok)",
                     }}
                  />
                  <span
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     Score: {currentScore}
                  </span>
               </div>
            </div>

            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "600px",
                  height: isMobile ? "8px" : "10px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "999px",
                  overflow: "hidden",
                  border: "1px solid var(--border)",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Current Challenge Type */}
         {currentMiniGame && gameState === "playing" && (
            <div
               style={{
                  padding: isMobile ? "10px 16px" : "12px 20px",
                  background:
                     "linear-gradient(135deg, rgba(125, 211, 252, 0.15), rgba(125, 211, 252, 0.08))",
                  border: "1px solid rgba(125, 211, 252, 0.3)",
                  borderRadius: "12px",
                  fontSize: isMobile ? "0.95rem" : "1.05rem",
                  fontWeight: 600,
                  color: "var(--text)",
               }}
            >
               Current: {getGameTypeName(currentMiniGame)}
            </div>
         )}

         {/* Ready for Next Round */}
         {gameState === "ready" && round + 1 < rounds && (
            <div
               style={{
                  padding: isMobile ? "20px 24px" : "24px 32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--stroke)",
                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               <div
                  style={{
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: "8px 14px",
                     borderRadius: "999px",
                     fontWeight: 800,
                     fontSize: isMobile ? "0.95rem" : "1.05rem",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.1))",
                     border: "2px solid rgba(134, 239, 172, 0.6)",
                     color: "var(--text)",
                     marginBottom: "16px",
                  }}
               >
                  <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  Round {round + 1} Complete
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "1.05rem" : "1.1rem",
                     fontWeight: 600,
                     marginBottom: "20px",
                     marginTop: "16px",
                  }}
               >
                  Are you ready for next round?
               </div>
               <button
                  onClick={handleNextRound}
                  style={{
                     padding: isMobile ? "12px 24px" : "14px 28px",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                     border: "2px solid rgba(134, 239, 172, 0.6)",
                     borderRadius: "12px",
                     color: "var(--text)",
                     fontSize: isMobile ? "1rem" : "1.05rem",
                     fontWeight: 700,
                     cursor: "pointer",
                     transition: "all 0.3s ease",
                  }}
               >
                  Next Round
               </button>
            </div>
         )}

         {/* Game Complete */}
         {gameState === "complete" && (
            <div
               style={{
                  padding: isMobile ? "20px 24px" : "24px 32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  border: "1px solid var(--stroke)",
                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               <div
                  style={{
                     display: "inline-flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: "8px 14px",
                     borderRadius: "999px",
                     fontWeight: 800,
                     fontSize: isMobile ? "0.95rem" : "1.05rem",
                     background:
                        "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.1))",
                     border: "2px solid rgba(134, 239, 172, 0.6)",
                     color: "var(--text)",
                     marginBottom: "16px",
                  }}
               >
                  <TrophyIcon style={{ width: 20, height: 20 }} />
                  Game Complete!
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "1.05rem" : "1.1rem",
                     fontWeight: 600,
                     marginBottom: "20px",
                     marginTop: "16px",
                  }}
               >
                  Final Score: {Math.round(score)}
               </div>
            </div>
         )}

         {/* Mini Game */}
         {gameState === "playing" && renderMiniGame()}
      </div>
   );
}

// Survival Mode Game (47)
function SurvivalMode({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const games = config.games || 5;
   const [currentGameIndex, setCurrentGameIndex] = useState(0);
   const [score, setScore] = useState(0);
   const [failed, setFailed] = useState(false);

   const gameSequence = [
      { type: "logic", config: { gameType: "number-order", numbers: 5 } },
      {
         type: "memory",
         config: { gameType: "card-flip", gridSize: 3, pairs: 4 },
      },
      { type: "speed", config: { gameType: "fast-math", rounds: 5 } },
      { type: "skill", config: { gameType: "target-aim", targets: 5 } },
      { type: "logic", config: { gameType: "balance-scale" } },
   ];

   const handleGameComplete = (gameScore: number) => {
      if (gameScore < 70) {
         setFailed(true);
         onScoreUpdate(score);
         setTimeout(() => onComplete(score), 1000);
         return;
      }

      setScore(score + gameScore);
      if (currentGameIndex < games - 1) {
         setCurrentGameIndex(currentGameIndex + 1);
      } else {
         onScoreUpdate(score + gameScore);
         setTimeout(() => onComplete(score + gameScore), 1000);
      }
   };

   if (failed) {
      return (
         <div className="survival-mode-game">
            <h3>Survival Mode - Failed!</h3>
            <p>You didn't pass round {currentGameIndex + 1}</p>
            <p>Final Score: {score}</p>
         </div>
      );
   }

   const currentGame = gameSequence[currentGameIndex % gameSequence.length];

   const renderGame = () => {
      switch (currentGame.type) {
         case "logic":
            return (
               <LogicGames
                  config={currentGame.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "memory":
            return (
               <MemoryGames
                  config={currentGame.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "speed":
            return (
               <SpeedGames
                  config={currentGame.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "skill":
            return (
               <SkillGames
                  config={currentGame.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         default:
            return <div>Unknown game</div>;
      }
   };

   return (
      <div className="survival-mode-game">
         <h3>
            Survival Mode - Game {currentGameIndex + 1}/{games}
         </h3>
         {renderGame()}
      </div>
   );
}

// Boss Puzzle Game (48)
function BossPuzzle({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const [puzzleState, setPuzzleState] = useState({
      logic: false,
      memory: false,
      speed: false,
      skill: false,
   });
   const [score, setScore] = useState(0);

   useEffect(() => {
      const allComplete = Object.values(puzzleState).every(
         (complete) => complete
      );
      if (allComplete) {
         onScoreUpdate(100);
         setTimeout(() => onComplete(100), 1000);
      }
   }, [puzzleState, onScoreUpdate, onComplete]);

   const handlePuzzleComplete = (type: keyof typeof puzzleState) => {
      setPuzzleState((prev) => ({ ...prev, [type]: true }));
      setScore(score + 25);
   };

   return (
      <div className="boss-puzzle-game">
         <h3>Boss Puzzle</h3>
         <p>Complete all 4 challenges</p>
         <div className="puzzle-grid">
            <div className="puzzle-challenge">
               <h4>Logic Challenge</h4>
               {!puzzleState.logic ? (
                  <LogicGames
                     config={{ gameType: "tile-slider", gridSize: 3 }}
                     onScoreUpdate={() => {}}
                     onComplete={(s) =>
                        s && s >= 70 && handlePuzzleComplete("logic")
                     }
                     isPlaying={isPlaying}
                  />
               ) : (
                  <div
                     className="completed"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <CheckCircleIcon style={{ width: 18, height: 18 }} />
                     Completed
                  </div>
               )}
            </div>
            <div className="puzzle-challenge">
               <h4>Memory Challenge</h4>
               {!puzzleState.memory ? (
                  <MemoryGames
                     config={{ gameType: "card-flip", gridSize: 4, pairs: 8 }}
                     onScoreUpdate={() => {}}
                     onComplete={(s) =>
                        s && s >= 70 && handlePuzzleComplete("memory")
                     }
                     isPlaying={isPlaying}
                  />
               ) : (
                  <div
                     className="completed"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <CheckCircleIcon style={{ width: 18, height: 18 }} />
                     Completed
                  </div>
               )}
            </div>
            <div className="puzzle-challenge">
               <h4>Speed Challenge</h4>
               {!puzzleState.speed ? (
                  <SpeedGames
                     config={{ gameType: "reaction-test", rounds: 5 }}
                     onScoreUpdate={() => {}}
                     onComplete={(s) =>
                        s && s >= 70 && handlePuzzleComplete("speed")
                     }
                     isPlaying={isPlaying}
                  />
               ) : (
                  <div
                     className="completed"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <CheckCircleIcon style={{ width: 18, height: 18 }} />
                     Completed
                  </div>
               )}
            </div>
            <div className="puzzle-challenge">
               <h4>Skill Challenge</h4>
               {!puzzleState.skill ? (
                  <SkillGames
                     config={{ gameType: "target-aim", targets: 10 }}
                     onScoreUpdate={() => {}}
                     onComplete={(s) =>
                        s && s >= 70 && handlePuzzleComplete("skill")
                     }
                     isPlaying={isPlaying}
                  />
               ) : (
                  <div
                     className="completed"
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                     }}
                  >
                     <CheckCircleIcon style={{ width: 18, height: 18 }} />
                     Completed
                  </div>
               )}
            </div>
         </div>
      </div>
   );
}

// Time Challenge Game (49)
function TimeChallenge({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const duration = config.duration || 60;
   const [timeLeft, setTimeLeft] = useState(duration);
   const [currentGame, setCurrentGame] = useState<string>("");
   const [score, setScore] = useState(0);
   const [gamesCompleted, setGamesCompleted] = useState(0);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               const finalScore = Math.round(score / gamesCompleted || 0);
               onScoreUpdate(finalScore);
               setTimeout(() => onComplete(finalScore), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isPlaying, duration, score, gamesCompleted, onScoreUpdate, onComplete]);

   useEffect(() => {
      if (!isPlaying || timeLeft <= 0) return;

      const gameTypes = [
         "number-order",
         "card-flip",
         "fast-math",
         "target-aim",
      ];
      const randomGame =
         gameTypes[Math.floor(Math.random() * gameTypes.length)];
      setCurrentGame(randomGame);
   }, [isPlaying, timeLeft, gamesCompleted]);

   const handleGameComplete = (gameScore: number) => {
      setScore(score + gameScore);
      setGamesCompleted(gamesCompleted + 1);
   };

   const getGameComponent = () => {
      switch (currentGame) {
         case "number-order":
            return (
               <LogicGames
                  config={{ gameType: "number-order", numbers: 5 }}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "card-flip":
            return (
               <MemoryGames
                  config={{ gameType: "card-flip", gridSize: 3, pairs: 4 }}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "fast-math":
            return (
               <SpeedGames
                  config={{ gameType: "fast-math", rounds: 3 }}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "target-aim":
            return (
               <SkillGames
                  config={{ gameType: "target-aim", targets: 3 }}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleGameComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         default:
            return <div>Loading challenge...</div>;
      }
   };

   return (
      <div className="time-challenge-game">
         <h3>Time Challenge</h3>
         <p>
            Time: {timeLeft}s | Completed: {gamesCompleted}
         </p>
         {getGameComponent()}
      </div>
   );
}

// Final Certification Test (50)
function FinalTest({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGamesProps) {
   const rounds = config.rounds || 10;
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [currentChallenge, setCurrentChallenge] = useState<{
      type: string;
      config: Record<string, any>;
   } | null>(null);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      const challenges = [
         { type: "logic", config: { gameType: "tile-slider", gridSize: 3 } },
         { type: "memory", config: { gameType: "color-sequence", rounds: 5 } },
         { type: "speed", config: { gameType: "reaction-test", rounds: 5 } },
         { type: "skill", config: { gameType: "ball-balance" } },
         { type: "logic", config: { gameType: "sudoku-4x4" } },
         {
            type: "memory",
            config: { gameType: "card-flip", gridSize: 4, pairs: 8 },
         },
         { type: "speed", config: { gameType: "fast-math", rounds: 5 } },
         { type: "skill", config: { gameType: "target-aim", targets: 10 } },
         { type: "logic", config: { gameType: "balance-scale" } },
         { type: "memory", config: { gameType: "number-recall", digits: 5 } },
      ];

      setCurrentChallenge(challenges[round % challenges.length]);
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleChallengeComplete = (challengeScore: number) => {
      setScore(score + challengeScore);
      setRound(round + 1);
   };

   const renderChallenge = () => {
      if (!currentChallenge) return <div>Loading...</div>;

      switch (currentChallenge.type) {
         case "logic":
            return (
               <LogicGames
                  config={currentChallenge.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleChallengeComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "memory":
            return (
               <MemoryGames
                  config={currentChallenge.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleChallengeComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "speed":
            return (
               <SpeedGames
                  config={currentChallenge.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleChallengeComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         case "skill":
            return (
               <SkillGames
                  config={currentChallenge.config}
                  onScoreUpdate={() => {}}
                  onComplete={(s) => handleChallengeComplete(s || 0)}
                  isPlaying={isPlaying}
               />
            );
         default:
            return <div>Unknown challenge</div>;
      }
   };

   return (
      <div className="final-test-game">
         <h3>Final Certification Test</h3>
         <p>
            Round {round + 1}/{rounds}
         </p>
         {renderChallenge()}
      </div>
   );
}
