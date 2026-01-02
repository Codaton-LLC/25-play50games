"use client";

import React, {
   useState,
   useEffect,
   useCallback,
   useRef,
   useMemo,
} from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   TrophyIcon,
   ClockIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import FastMath from "./speedgames-parts/FastMath";
import WhackShape from "./speedgames-parts/WhackShape";
import ClickGreen from "./speedgames-parts/ClickGreen";
import AvoidRed from "./speedgames-parts/AvoidRed";
import ReactionTest from "./speedgames-parts/ReactionTest";
import TypingSprint from "./speedgames-parts/TypingSprint";
import QuickCompare from "./speedgames-parts/QuickCompare";

interface SpeedGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}

export default function SpeedGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: SpeedGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      const gameType = config.gameType;

      if (!gameType) {
         return;
      }

      setCurrentGame(gameType);
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "click-green": (
         <ClickGreen
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "avoid-red": (
         <AvoidRed
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reaction-test": (
         <ReactionTest
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "fast-math": (
         <FastMath
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
            passingScore={70}
         />
      ),
      "whack-shape": (
         <WhackShape
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
            passingScore={70}
         />
      ),
      "typing-sprint": (
         <TypingSprint
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "quick-compare": (
         <QuickCompare
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "falling-objects": (
         <FallingObjects
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "tap-counter": (
         <TapCounter
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
      "reflex-arrows": (
         <ReflexArrows
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            isPlaying={isPlaying}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Speed game "{currentGame}" not found.</div>
      )
   );
}

// Falling Objects Game (33)
function FallingObjects({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const duration = config.duration || 30;
   const [objects, setObjects] = useState<
      Array<{ id: number; type: "good" | "bad"; y: number }>
   >([]);
   const [timeLeft, setTimeLeft] = useState(duration);
   const [score, setScore] = useState(0);
   const [missed, setMissed] = useState(0);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               const finalScore = Math.max(0, 100 - missed * 5);
               onScoreUpdate(finalScore);
               setTimeout(() => onComplete(finalScore), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      const objectTimer = setInterval(() => {
         setObjects((prev) => [
            ...prev,
            {
               id: Date.now(),
               type: Math.random() > 0.5 ? "good" : "bad",
               y: 0,
            },
         ]);
      }, 1000);

      const fallTimer = setInterval(() => {
         setObjects((prev) =>
            prev
               .map((obj) => ({ ...obj, y: obj.y + 2 }))
               .filter((obj) => {
                  if (obj.y > 100) {
                     if (obj.type === "good") setMissed(missed + 1);
                     return false;
                  }
                  return true;
               })
         );
      }, 50);

      return () => {
         clearInterval(timer);
         clearInterval(objectTimer);
         clearInterval(fallTimer);
      };
   }, [isPlaying, duration, missed, onScoreUpdate, onComplete]);

   const handleObjectClick = (id: number, type: "good" | "bad") => {
      setObjects((prev) => prev.filter((obj) => obj.id !== id));
      if (type === "good") {
         setScore(score + 5);
      } else {
         setScore(Math.max(0, score - 3));
      }
   };

   return (
      <div className="falling-objects-game">
         <h3>Falling Objects</h3>
         <p>
            Time: {timeLeft}s | Score: {score}
         </p>
         <div className="falling-area">
            {objects.map((obj) => (
               <button
                  key={obj.id}
                  onClick={() => handleObjectClick(obj.id, obj.type)}
                  className={`falling-object ${obj.type}`}
                  style={{
                     top: `${obj.y}%`,
                     left: `${Math.random() * 80 + 10}%`,
                  }}
               >
                  {obj.type === "good" ? (
                     <CheckCircleIcon style={{ width: 20, height: 20 }} />
                  ) : (
                     <XCircleIcon style={{ width: 20, height: 20 }} />
                  )}
               </button>
            ))}
         </div>
         <p
            style={{
               display: "flex",
               alignItems: "center",
               gap: "8px",
               justifyContent: "center",
            }}
         >
            Catch good items (
            <CheckCircleIcon
               style={{ width: 16, height: 16, display: "inline" }}
            />
            ), avoid bad ones (
            <XCircleIcon style={{ width: 16, height: 16, display: "inline" }} />
            )
         </p>
      </div>
   );
}

// Tap Counter Game (34)
function TapCounter({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const duration = config.duration || 10;
   const [taps, setTaps] = useState(0);
   const [timeLeft, setTimeLeft] = useState(duration);

   useEffect(() => {
      if (!isPlaying) return;

      const timer = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (prev <= 1) {
               const finalScore = Math.min(100, taps * 2);
               onScoreUpdate(finalScore);
               setTimeout(() => onComplete(finalScore), 1000);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timer);
   }, [isPlaying, duration, taps, onScoreUpdate, onComplete]);

   const handleTap = () => {
      setTaps(taps + 1);
   };

   return (
      <div className="tap-counter-game">
         <h3>Tap Counter</h3>
         <p>Time: {timeLeft}s</p>
         <div className="tap-area" onClick={handleTap}>
            <div className="tap-count">{taps}</div>
            <p>Tap as fast as you can!</p>
         </div>
      </div>
   );
}

// Reflex Arrows Game (35)
function ReflexArrows({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}) {
   const rounds = config.rounds || 15;
   const [targetArrow, setTargetArrow] = useState<string>("");
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [startTime, setStartTime] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      const arrow = arrows[Math.floor(Math.random() * arrows.length)];
      setTargetArrow(arrow);
      setStartTime(Date.now());
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === targetArrow) {
         const reactionTime = Date.now() - startTime;
         const roundScore = Math.max(0, 100 - reactionTime / 10);
         setScore(score + roundScore);
         setRound(round + 1);
      }
   };

   const arrowSymbols: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
   };

   return (
      <div
         className="reflex-arrows-game"
         onKeyDown={handleKeyPress}
         tabIndex={0}
      >
         <h3>
            Reflex Arrows - Round {round + 1}/{rounds}
         </h3>
         <div className="arrow-display">
            <div className="target-arrow">{arrowSymbols[targetArrow]}</div>
         </div>
         <p>Press the arrow key shown!</p>
      </div>
   );
}
