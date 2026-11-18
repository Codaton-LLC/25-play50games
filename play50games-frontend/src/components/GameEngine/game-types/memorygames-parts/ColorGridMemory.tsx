"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import c from "./ColorGridMemory.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function ColorGridMemory({
   config,
   onScoreUpdate,
   onComplete,
   passingScore = 70,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   passingScore?: number;
}) {
   const maxRounds = config.rounds || 20;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<number[]>([]);
   const [userInput, setUserInput] = useState<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [flashingCellIndex, setFlashingCellIndex] = useState<number | null>(
      null
   );
   const [wrongCellIndex, setWrongCellIndex] = useState<number | null>(null);
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );
   const sequenceTimersRef = useRef<NodeJS.Timeout[]>([]);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
   // 15 s share-message timers: cleared on unmount
   const shareTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const shareTimeout = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         shareTimersRef.current.delete(t);
         fn();
      }, ms);
      shareTimersRef.current.add(t);
   };
   useEffect(() => {
      const timers = shareTimersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

   // Round-flow timers (next round, retry, completion): the same delays as before, but cleared
   // when the game unmounts so a timer never fires into a closed game.
   const roundTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         roundTimersRef.current.delete(t);
         fn();
      }, ms);
      roundTimersRef.current.add(t);
   }, []);
   useEffect(() => {
      const timers = roundTimersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);

   // Max hints: 10, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Check if mobile/tablet device
   useEffect(() => {
      const checkDevice = () => {
         const width = window.innerWidth;
         setIsMobile(width < 768);
         setIsTablet(width >= 768 && width < 1024);
      };
      checkDevice();
      window.addEventListener("resize", checkDevice);
      return () => window.removeEventListener("resize", checkDevice);
   }, []);

   // Calculate grid size based on round (3x3, 4x4, 5x5)
   const gridSize = useMemo(() => {
      if (currentRound < 5) return 3; // Rounds 1-5: 3x3
      if (currentRound < 12) return 4; // Rounds 6-12: 4x4
      return 5; // Rounds 13+: 5x5
   }, [currentRound]);

   // Calculate sequence length (starts at 3, increases by 1 per round)
   const sequenceLength = useMemo(() => {
      return 3 + currentRound;
   }, [currentRound]);

   // Color palette for cells
   const colors = useMemo(
      () => [
         "rgba(110, 168, 255, 0.9)", // Blue
         "rgba(54, 211, 153, 0.9)", // Green
         "rgba(251, 191, 36, 0.9)", // Yellow
         "rgba(251, 113, 133, 0.9)", // Pink
         "rgba(168, 85, 247, 0.9)", // Purple
         "rgba(236, 72, 153, 0.9)", // Rose
      ],
      []
   );

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "color-grid-memory");
         const gameKey = "play50games_shared_color-grid-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            if (!currentShareId) {
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               return;
            }

            const gameKey = "play50games_shared_color-grid-memory";
            const stored = localStorage.getItem(gameKey);
            if (stored) {
               try {
                  const data = JSON.parse(stored);
                  if (data.expiry && Date.now() > data.expiry) {
                     localStorage.removeItem(gameKey);
                     if (shareCheckIntervalRef.current) {
                        clearInterval(shareCheckIntervalRef.current);
                     }
                     setCurrentShareId(null);
                     setHasShared(false);
                     setUnlimitedActivated(false);
                     return;
                  }
               } catch (error) {
                  localStorage.removeItem(gameKey);
               }
            }

            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  const gameKey = "play50games_shared_color-grid-memory";
                  const expiryTime = Date.now() + 15 * 60 * 1000;
                  localStorage.setItem(
                     gameKey,
                     JSON.stringify({
                        share_id: currentShareId,
                        expiry: expiryTime,
                        shared: true,
                     })
                  );
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  // Show message for 15 seconds
                  shareTimeout(() => {
                     setUnlimitedActivated(false);
                  }, 15000);
                  // Expire after 15 minutes
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
               }
            } catch (error) {
               const errorMessage =
                  error instanceof Error ? error.message : String(error);
               if (
                  errorMessage.includes("404") ||
                  errorMessage.includes("not found") ||
                  errorMessage.includes("expired")
               ) {
                  const gameKey = "play50games_shared_color-grid-memory";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000);
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_color-grid-memory";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            if (data.expiry && Date.now() > data.expiry) {
               localStorage.removeItem(gameKey);
               return;
            }
            if (data.share_id) {
               setCurrentShareId(data.share_id);
               // Verify with backend before activating unlimited
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     if (status && status.clicks > 0) {
                        // Share exists in backend and has clicks - activate unlimited
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           // Already activated and not expired
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, data.expiry - Date.now());
                        } else {
                           // Has clicks but not activated yet - activate now
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
                           localStorage.setItem(
                              gameKey,
                              JSON.stringify({
                                 share_id: data.share_id,
                                 expiry: expiryTime,
                                 shared: true,
                              })
                           );
                           setTimeout(() => {
                              setUnlimitedActivated(false);
                              setHasShared(false);
                              localStorage.removeItem(gameKey);
                           }, 15 * 60 * 1000);
                        }
                     } else {
                        // Share doesn't exist in backend or has no clicks - clean up
                        localStorage.removeItem(gameKey);
                        setCurrentShareId(null);
                     }
                  } catch (error) {
                     // Error checking share (404 or other) - clean up
                     localStorage.removeItem(gameKey);
                     setCurrentShareId(null);
                  }
               };
               verifyShare();
            }
         } catch (error) {
            localStorage.removeItem(gameKey);
         }
      }

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("shared");
      if (sharedId) {
         trackShareClick(sharedId);
      }
   }, []);

   // Clear all sequence timers
   const clearSequenceTimers = useCallback(() => {
      sequenceTimersRef.current.forEach((timer) => clearTimeout(timer));
      sequenceTimersRef.current = [];
   }, []);

   // Generate random sequence
   const generateSequence = useCallback((): number[] => {
      const totalCells = gridSize * gridSize;
      const sequence: number[] = [];
      const used = new Set<number>();

      while (sequence.length < sequenceLength) {
         const cell = Math.floor(Math.random() * totalCells);
         if (!used.has(cell)) {
            sequence.push(cell);
            used.add(cell);
         }
      }

      return sequence;
   }, [gridSize, sequenceLength]);

   // Start new round
   const startNewRound = useCallback(() => {
      clearSequenceTimers();
      setSequence([]);
      setUserInput([]);
      setHintRevealed([]);
      setWrongCellIndex(null);
      setFlashingCellIndex(null);
      setFeedback(null);
      setGameState("memorizing");

      // Generate new sequence
      const newSequence = generateSequence();
      setSequence(newSequence);

      // Play sequence animation
      newSequence.forEach((cellIndex, stepIndex) => {
         const timer = setTimeout(() => {
            setFlashingCellIndex(cellIndex);
            setTimeout(() => {
               setFlashingCellIndex(null);
            }, 400);
         }, stepIndex * 600);

         sequenceTimersRef.current.push(timer);
      });

      // After sequence finishes, switch to input mode
      const finalTimer = setTimeout(() => {
         setGameState("input");
         setFlashingCellIndex(null);
      }, newSequence.length * 600 + 500);

      sequenceTimersRef.current.push(finalTimer);
   }, [gridSize, sequenceLength, generateSequence, clearSequenceTimers]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startNewRound();
      }
   }, [currentRound, maxRounds, startNewRound]);

   // Update score
   useEffect(() => {
      const completedRounds = currentRound;
      const newScore = Math.round((completedRounds / maxRounds) * 100);
      setCurrentScore(newScore);
      if (completedRounds > 0) {
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);
      }
   }, [currentRound, maxRounds, onScoreUpdate]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         later(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete, later]);

   // Handle cell click
   const handleCellClick = useCallback(
      (cellIndex: number) => {
         if (gameState !== "input") return;
         if (userInput.includes(cellIndex)) return; // Already clicked

         const newInput = [...userInput, cellIndex];
         setUserInput(newInput);

         // Check if this click is correct
         const expectedIndex = sequence[newInput.length - 1];
         if (cellIndex !== expectedIndex) {
            // Wrong cell clicked
            setWrongCellIndex(cellIndex);
            setGameState("wrong");
            setFeedback("wrong");

            later(() => {
               // Reset and repeat the same round
               setUserInput([]);
               setWrongCellIndex(null);
               setFeedback(null);
               setHintRevealed([]);
               startNewRound();
            }, 2000);
            return;
         }

         // Check if sequence is complete
         if (newInput.length === sequence.length) {
            // All cells clicked correctly
            setGameState("correct");
            setFeedback("correct");

            later(() => {
               setCurrentRound((prev) => prev + 1);
            }, 1500);
         }
      },
      [gameState, userInput, sequence, startNewRound, later]
   );

   // Handle hint
   const handleHint = useCallback(() => {
      if (gameState !== "input") return;
      if (maxHints > 0 && hintsUsed >= maxHints) return;

      // Find next unrevealed cell in sequence
      const nextPositionIndex = Math.max(
         userInput.length,
         hintRevealed.length > 0 ? Math.max(...hintRevealed) + 1 : 0
      );

      if (nextPositionIndex < sequence.length) {
         const cellIndex = sequence[nextPositionIndex];
         if (!hintRevealed.includes(nextPositionIndex)) {
            setHintRevealed((prev) => [...prev, nextPositionIndex]);
            setHintsUsed((prev) => prev + 1);
         }
      }
   }, [gameState, maxHints, hintsUsed, sequence, userInput, hintRevealed]);

   // Handle share
   const handleShare = useCallback(async () => {
      try {
         const shareLink = getShareableLink();
         const shareId = shareLink.split("shared=")[1];

         if (navigator.share) {
            await navigator.share({
               title: "Color Grid Recall",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareId);
            setShareSuccess(true);
            shareTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } else {
            await navigator.clipboard.writeText(shareLink);
            await registerShareLink(shareId);
            setShareSuccess(true);
            shareTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         }
      } catch (error) {
         // User cancelled or error occurred
      }
   }, []);

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const totalCells = gridSize * gridSize;

         // Prevent default for game controls
         if (
            (e.key >= "1" && e.key <= "9") ||
            e.key === "0" ||
            e.key === "-" ||
            e.key === "=" ||
            e.key.startsWith("Arrow") ||
            ["w", "W", "s", "S", "a", "A", "d", "D", "Enter", " "].includes(
               e.key
            )
         ) {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
               e.preventDefault();
            }
         }

         // Direct selection with number keys (1-9, 0, -, =)
         if (e.key >= "1" && e.key <= "9") {
            const num = parseInt(e.key);
            if (num <= totalCells && !userInput.includes(num - 1)) {
               handleCellClick(num - 1);
            }
            return;
         }

         if (e.key === "0" && totalCells >= 10 && !userInput.includes(9)) {
            handleCellClick(9);
            return;
         }

         if (e.key === "-" && totalCells >= 11 && !userInput.includes(10)) {
            handleCellClick(10);
            return;
         }

         if (e.key === "=" && totalCells >= 12 && !userInput.includes(11)) {
            handleCellClick(11);
            return;
         }

         // Initialize selectedCellIndex if null
         if (selectedCellIndex === null) {
            setSelectedCellIndex(0);
            return;
         }

         // Navigate with arrow keys or WASD
         let newIndex = selectedCellIndex;

         if (
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "w" ||
            e.key === "W" ||
            e.key === "a" ||
            e.key === "A"
         ) {
            if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
               // Move up
               newIndex = Math.max(0, selectedCellIndex - gridSize);
            } else {
               // Move left
               newIndex = Math.max(0, selectedCellIndex - 1);
            }
            setSelectedCellIndex(newIndex);
            return;
         }

         if (
            e.key === "ArrowDown" ||
            e.key === "ArrowRight" ||
            e.key === "s" ||
            e.key === "S" ||
            e.key === "d" ||
            e.key === "D"
         ) {
            if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
               // Move down
               newIndex = Math.min(
                  totalCells - 1,
                  selectedCellIndex + gridSize
               );
            } else {
               // Move right
               newIndex = Math.min(totalCells - 1, selectedCellIndex + 1);
            }
            setSelectedCellIndex(newIndex);
            return;
         }

         // Select with Enter or Space
         if (e.key === "Enter" || e.key === " ") {
            if (
               selectedCellIndex !== null &&
               !userInput.includes(selectedCellIndex)
            ) {
               handleCellClick(selectedCellIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, selectedCellIndex, gridSize, userInput, handleCellClick]);

   // Cleanup on unmount
   useEffect(() => {
      return () => {
         clearSequenceTimers();
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [clearSequenceTimers]);

   const progress = (currentRound / maxRounds) * 100;

   const hintDisabled =
      gameState !== "input" ||
      (maxHints > 0 && hintsUsed >= maxHints) ||
      hintRevealed.length >= sequence.length;

   return (
      <div
         className={`${m.root} ${m.tight}`}
         style={{ maxWidth: "800px" }}
      >
         {/* Header */}
         <div className={m.panel}>
            <div className={m.stats}>
               <span className={m.stat}>
                  <ArrowPathIcon className={m.statIcon} />
                  Round <b>{currentRound + 1} / {maxRounds}</b>
               </span>
               <span className={m.stat}>
                  <TrophyIcon className={m.statIcon} />
                  Score <b>{currentScore} / 100</b>
               </span>
               <span className={m.stat}>
                  <Squares2X2Icon className={m.statIcon} />
                  Grid <b>{gridSize}x{gridSize}</b>
               </span>
               <span className={m.stat}>
                  <LightBulbIcon className={m.statIcon} />
                  Hints{" "}
                  <b>{hasShared ? "∞" : `${Math.max(0, maxHints - hintsUsed)}/${maxHints}`}</b>
               </span>
            </div>
            {/* Progress Bar */}
            <div className={m.progress}>
               <div
                  className={m.progressFill}
                  style={{ transform: `scaleX(${progress / 100})` }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            style={{
               width: "100%",
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "14px" : "18px",
            }}
         >
            {/* Status Message */}
            <div className={c.status} role="status">
               <p key={gameState} className={c.statusMain}>
                  {gameState === "memorizing" && "Watch the sequence…"}
                  {gameState === "input" && "Now click in the same order"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           className={c.statusIcon}
                           style={{ color: "var(--ok)" }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           className={c.statusIcon}
                           style={{ color: "var(--warn)" }}
                        />
                        Wrong! Try again
                     </>
                  )}
               </p>
               <p className={c.statusSub}>
                  {gameState === "memorizing" &&
                     "After it disappears, click in the same order"}
                  {gameState === "input" && "Click the cells in order"}
               </p>
            </div>

            {/* Grid */}
            <div
               key={`${currentRound}-${gridSize}`}
               className={`${m.board} ${m.stagger}`}
               style={{
                  gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                  // fits the screen height, and a small grid never balloons on a wide screen
                  maxWidth: `min(100%, calc(100dvh - 170px), ${gridSize * 128}px)`,
                  margin: "0 auto",
               }}
            >
               {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                  const sequenceIndex = sequence.indexOf(idx);
                  const isSelected = userInput.includes(idx);
                  const inputIndex = userInput.indexOf(idx);
                  const isHinted = hintRevealed.includes(sequenceIndex);
                  const isFlashing = flashingCellIndex === idx;
                  const isWrong = wrongCellIndex === idx;
                  const isKeySelected = selectedCellIndex === idx && !isSelected;

                  // Get color for this cell in sequence
                  const colorIndex =
                     sequenceIndex >= 0 ? sequenceIndex % colors.length : -1;
                  const cellColor = colorIndex >= 0 ? colors[colorIndex] : null;
                  const showColor =
                     !!cellColor && !isWrong && (isFlashing || isSelected || isHinted);

                  const stateClass = isFlashing
                     ? c.flashCue
                     : isWrong
                     ? `${m.cardWrong} ${m.wrong}`
                     : isSelected
                     ? c.picked
                     : isHinted
                     ? m.cardHint
                     : isKeySelected
                     ? m.cardSelected
                     : "";

                  return (
                     <button
                        key={idx}
                        onClick={() => handleCellClick(idx)}
                        className={`${m.card} ${stateClass}`}
                        disabled={gameState !== "input" || isSelected}
                        aria-label={`Cell ${idx + 1}`}
                        style={{ ["--i" as string]: idx }}
                     >
                        {showColor && (
                           <span
                              key={isFlashing ? `flash-${idx}` : `on-${idx}`}
                              className={`${c.fill} ${isFlashing ? c.fillFlash : c.fillIn}`}
                              style={{ background: cellColor! }}
                           />
                        )}
                        {isSelected && (
                           <span className={`${c.badge} ${c.order}`}>
                              {inputIndex + 1}
                           </span>
                        )}
                        {isHinted && !isSelected && (
                           <span className={`${c.badge} ${c.hint}`}>
                              {sequenceIndex + 1}
                           </span>
                        )}
                        {gameState === "input" && !isSelected && !isHinted && (
                           <span className={`${c.badge} ${c.key}`}>
                              {idx < 9
                                 ? idx + 1
                                 : idx === 9
                                 ? "0"
                                 : idx === 10
                                 ? "-"
                                 : idx === 11
                                 ? "="
                                 : ""}
                           </span>
                        )}
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               role="status"
               className={`${m.feedback} ${
                  feedback === "correct" ? m.feedbackOk : m.feedbackBad
               }`}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon className={m.feedbackIcon} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon className={m.feedbackIcon} />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}

         {/* Share Success Messages */}
         {shareSuccess && (
            <div className={`${m.note} ${m.noteOk}`}>
               <CheckCircleIcon className={m.noteIcon} />
               <span>
                  {isMobile
                     ? "Link copied! Unlimited hints unlock when someone opens it!"
                     : "Link copied! Unlimited hints will unlock when someone opens your link!"}
               </span>
            </div>
         )}
         {unlimitedActivated && (
            <div className={m.note}>
               <CheckCircleIcon className={m.noteIcon} />
               <span>
                  {isMobile
                     ? "Unlimited hints active for 15 minutes!"
                     : "Someone opened your link! Unlimited hints are now active for 15 minutes!"}
               </span>
            </div>
         )}

         {/* Hint and Share Buttons */}
         <div className={c.actions}>
            <button
               type="button"
               onClick={handleHint}
               className={`${m.btn} ${m.pill}`}
               disabled={hintDisabled}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  {hasShared
                     ? "Hint (∞)"
                     : `Hint (${Math.max(0, maxHints - hintsUsed)} left)`}
               </span>
            </button>

            <button
               type="button"
               onClick={handleShare}
               className={`${m.btn} ${m.pill}`}
            >
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>
      </div>
   );
}

export default ColorGridMemory;
