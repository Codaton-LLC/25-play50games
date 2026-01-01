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

// Click the Green Game (26) - Now imported from speedgames-parts/ClickGreen.tsx
// The implementation has been moved to a separate file for better organization

// Avoid the Red Game (27) - Now imported from speedgames-parts/AvoidRed.tsx
// The implementation has been moved to a separate file for better organization

// Reaction Test Game (28) - Now imported from speedgames-parts/ReactionTest.tsx
// The implementation has been moved to a separate file for better organization

// Fast Math Game (29) - Now imported from speedgames-parts/FastMath.tsx
// The implementation has been moved to a separate file for better organization

// Whack-a-Shape Game (30) - Now imported from speedgames-parts/WhackShape.tsx
// The implementation has been moved to a separate file for better organization

// Typing Sprint Game (31)
function TypingSprint({
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
   const words = config.words || 10;
   const [currentWord, setCurrentWord] = useState("");
   const [input, setInput] = useState("");
   const [wordIndex, setWordIndex] = useState(0);
   const [score, setScore] = useState(0);
   const wordList = [
      "apple",
      "banana",
      "cherry",
      "date",
      "elderberry",
      "fig",
      "grape",
      "honeydew",
      "kiwi",
      "lemon",
   ];

   useEffect(() => {
      if (wordIndex >= words) {
         const finalScore = Math.round((score / words) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      setCurrentWord(wordList[wordIndex % wordList.length]);
      setInput("");
   }, [wordIndex, words, score, onScoreUpdate, onComplete]);

   useEffect(() => {
      if (input === currentWord && currentWord) {
         setScore(score + 10);
         setWordIndex(wordIndex + 1);
      }
   }, [input, currentWord, wordIndex, score]);

   return (
      <div className="typing-sprint-game">
         <h3>
            Typing Sprint - Word {wordIndex + 1}/{words}
         </h3>
         <div className="word-display">{currentWord}</div>
         <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="typing-input"
            autoFocus
         />
         <p>Type the word as fast as you can!</p>
      </div>
   );
}

// Quick Compare Game (32)
function QuickCompare({
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
   const [numbers, setNumbers] = useState<{ a: number; b: number } | null>(
      null
   );
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }

      setNumbers({
         a: Math.floor(Math.random() * 100),
         b: Math.floor(Math.random() * 100),
      });
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const handleSelect = (choice: "greater" | "less" | "equal") => {
      if (!numbers) return;

      let isCorrect = false;
      if (choice === "greater") isCorrect = numbers.a > numbers.b;
      else if (choice === "less") isCorrect = numbers.a < numbers.b;
      else isCorrect = numbers.a === numbers.b;

      if (isCorrect) {
         setScore(score + 6);
      }
      setRound(round + 1);
   };

   return (
      <div className="quick-compare-game">
         <h3>
            Quick Compare - Round {round + 1}/{rounds}
         </h3>
         {numbers && (
            <div>
               <div className="compare-numbers">
                  <div className="number">{numbers.a}</div>
                  <div className="vs">vs</div>
                  <div className="number">{numbers.b}</div>
               </div>
               <div className="compare-options">
                  <button onClick={() => handleSelect("greater")}>
                     A &gt; B
                  </button>
                  <button onClick={() => handleSelect("equal")}>A = B</button>
                  <button onClick={() => handleSelect("less")}>A &lt; B</button>
               </div>
            </div>
         )}
      </div>
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
