"use client";

import { useState, useEffect, useRef } from "react";
import MatchShapes from "./logicgames-parts/MatchShapes";
import ColorSequence from "./logicgames-parts/ColorSequence";
import NumberOrder from "./logicgames-parts/NumberOrder";
import FindOddOne from "./logicgames-parts/FindOddOne";
import TileSlider from "./logicgames-parts/TileSlider";
import BalanceScale from "./logicgames-parts/BalanceScale";
import CircuitPath from "./logicgames-parts/CircuitPath";
import MazeEscape from "./logicgames-parts/MazeEscape";
import PatternCompletion from "./logicgames-parts/PatternCompletion";
import Sudoku4x4 from "./logicgames-parts/Sudoku4x4";
import RotateToFit from "./logicgames-parts/RotateToFit";
import MirrorMatch from "./logicgames-parts/MirrorMatch";
import LogicGates from "./logicgames-parts/LogicGates";
import SequenceArrows from "./logicgames-parts/SequenceArrows";
import BlockFill from "./logicgames-parts/BlockFill";

interface LogicGamesProps {
   config: Record<string, any>;
   gameTitle?: string;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

// Map game titles to gameType as fallback
const titleToGameType: Record<string, string> = {
   "balance the scale": "balance-scale",
   "match the shapes": "match-shapes",
   "color sequence": "color-sequence",
   "number order": "number-order",
   "find the odd one": "find-odd-one",
   "tile slider": "tile-slider",
   "light switch puzzle": "circuit-path",
   "circuit path": "circuit-path",
   "maze escape": "maze-escape",
   "pattern completion": "pattern-completion",
   "sudoku 4x4": "sudoku-4x4",
   "rotate to fit": "rotate-to-fit",
   "mirror match": "mirror-match",
   "logic gates": "logic-gates",
   "sequence arrows": "sequence-arrows",
   "block fill": "block-fill",
};

export default function LogicGames({
   config,
   gameTitle,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: LogicGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");
   const [score, setScore] = useState(0);
   const [round, setRound] = useState(0);
   const rotateToFitAdvanceRef = useRef<number | null>(null);

   // Determine max rounds based on game type
   // Balance the Scale, Match Shapes, Maze Escape, and Pattern Completion should have 20 rounds by default
   const getMaxRounds = () => {
      // Check for totalRounds first (new format), then rounds (backward compatibility)
      if (config.totalRounds) return config.totalRounds;
      if (config.rounds) return config.rounds;
      const gameType = config.gameType || currentGame;
      if (
         gameType === "block-fill" &&
         Array.isArray(config.levels) &&
         config.levels.length
      ) {
         return config.levels.length;
      }
      if (
         gameType === "balance-scale" ||
         gameType === "match-shapes" ||
         gameType === "maze-escape" ||
         gameType === "pattern-completion" ||
         gameTitle?.toLowerCase().includes("balance") ||
         gameTitle?.toLowerCase().includes("match") ||
         gameTitle?.toLowerCase().includes("maze") ||
         gameTitle?.toLowerCase().includes("pattern")
      ) {
         return 20;
      }
      return 5;
   };
   const maxRounds = getMaxRounds();

   useEffect(() => {
      if (!isPlaying) return;

      // Determine which logic game to play based on config
      let gameType = config.gameType;

      // Check if gameType is empty string or invalid
      if (!gameType || gameType.trim() === "") {
         // Fallback: try to determine from game title if gameType is missing
         if (gameTitle) {
            const titleLower = gameTitle.toLowerCase();
            gameType = titleToGameType[titleLower] || "match-shapes";
         } else {
            // Final fallback
            gameType = "match-shapes";
         }
      }

      setCurrentGame(gameType);
      setRound(0);
      setScore(0);
      rotateToFitAdvanceRef.current = null;
   }, [isPlaying, config, gameTitle]);

   useEffect(() => {
      if (round >= maxRounds && isPlaying) {
         // Calculate final score
         // For balance-scale with 20 rounds: score is already 0-100 (5 points per round * 20 = 100 max)
         // For other games: calculate percentage
         const isBalanceScale =
            currentGame === "balance-scale" ||
            gameTitle?.toLowerCase().includes("balance");
         const isMazeEscape = currentGame === "maze-escape";
         const finalScore =
            isBalanceScale && maxRounds === 20
               ? score // Already 0-100 (5 points per round * 20 rounds = 100 max)
               : isMazeEscape && maxRounds === 20
               ? Math.round((score / (maxRounds * 100)) * 100) // Maze Escape: score is 0-2000, convert to 0-100
               : Math.round((score / maxRounds) * 100);

         onScoreUpdate(finalScore);
         // Pass the final score directly to onComplete
         onComplete(finalScore);
      }
   }, [
      round,
      maxRounds,
      score,
      isPlaying,
      onScoreUpdate,
      onComplete,
      currentGame,
      gameTitle,
   ]);

   const gameComponents: Record<string, JSX.Element> = {
      "match-shapes": (
         <MatchShapes
            config={config}
            onScoreUpdate={(s) => {
               // MatchShapes manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "color-sequence": (
         <ColorSequence
            config={config}
            onScoreUpdate={(s) => {
               // ColorSequence manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "number-order": (
         <NumberOrder
            config={config}
            onScoreUpdate={(s) => {
               // NumberOrder manages its own rounds and score internally
               // This callback is for updating parent score
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "find-odd-one": (
         <FindOddOne
            config={config}
            onScoreUpdate={(s) => {
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "tile-slider": (
         <TileSlider
            config={config}
            passingScore={passingScore}
            onScoreUpdate={(s) => {
               // Tile Slider sends final score directly, not incremental
               setScore(s);
            }}
            onComplete={onComplete}
         />
      ),
      "balance-scale": (
         <BalanceScale
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score and move to next round
               const newScore = score + s;
               const newRound = round + 1;
               setScore(newScore);
               setRound(newRound);
            }}
         />
      ),
      "light-switch": (
         <CircuitPath
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // CircuitPath reports the running total score
               setScore(s);
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               setRound((prev) => prev + 1);
            }}
         />
      ),
      "circuit-path": (
         <CircuitPath
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // CircuitPath reports the running total score
               setScore(s);
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               setRound((prev) => prev + 1);
            }}
         />
      ),
      "maze-escape": (
         <MazeEscape
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score only - round will be updated by onRoundComplete
               const newScore = score + s;
               setScore(newScore);
               // Score update
            }}
            onComplete={onComplete}
            onRoundComplete={() => {
               // Move to next round
               // onRoundComplete called
               setRound((prev) => {
                  const nextRound = prev + 1;
                  // Updating round
                  return nextRound;
               });
            }}
         />
      ),
      "pattern-completion": (
         <PatternCompletion
            config={config}
            currentRound={round + 1}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               // Add score and move to next round
               const newScore = score + s;
               setScore(newScore);
               setRound(round + 1);
            }}
            onComplete={onComplete}
         />
      ),
      "sudoku-4x4": (
         <Sudoku4x4
            config={config}
            onScoreUpdate={(s) => {
               setScore(score + s);
               setRound(round + 1);
            }}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "rotate-to-fit": (
         <RotateToFit
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
               // Don't increment round here - RotateToFit manages its own round
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  if (rotateToFitAdvanceRef.current === prevRound) {
                     return prevRound;
                  }
                  rotateToFitAdvanceRef.current = prevRound;
                  const nextRound = prevRound + 1;
                  // Don't exceed maxRounds (round starts at 0, so maxRounds = 20 means rounds 0-19 = rounds 1-20)
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
      "mirror-match": (
         <MirrorMatch
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  const nextRound = prevRound + 1;
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
      "logic-gates": (
         <LogicGates
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  const nextRound = prevRound + 1;
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
      "sequence-arrows": (
         <SequenceArrows
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  const nextRound = prevRound + 1;
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
      "block-fill": (
         <BlockFill
            config={config}
            currentRound={Math.min(round + 1, maxRounds)}
            maxRounds={maxRounds}
            currentScore={score}
            onScoreUpdate={(s) => {
               setScore(score + s);
            }}
            onRoundComplete={() => {
               setRound((prevRound) => {
                  const nextRound = prevRound + 1;
                  if (nextRound >= maxRounds) {
                     return prevRound;
                  }
                  return nextRound;
               });
            }}
            onComplete={onComplete}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Game "{currentGame}" not found. Loading default...</div>
      )
   );
}
