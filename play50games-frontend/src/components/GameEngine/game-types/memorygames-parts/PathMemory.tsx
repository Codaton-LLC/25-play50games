"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import m from "./mobile.module.css";
import ir from "./SequenceRecall.module.css";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   PuzzlePieceIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function PathMemory({
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
   const maxRounds = config.rounds || 15;
   const gridSize = config.gridSize || 5; // Default 5x5 grid
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [path, setPath] = useState<number[]>([]);
   const [playerPath, setPlayerPath] = useState<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );
   const [flashingCellIndex, setFlashingCellIndex] = useState<number | null>(
      null
   );

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
   // result / advance / completion timers: cleared on unmount (delays unchanged)
   const resultTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
         resultTimersRef.current.delete(t);
         fn();
      }, ms);
      resultTimersRef.current.add(t);
   }, []);
   useEffect(() => {
      const timers = resultTimersRef.current;
      return () => {
         timers.forEach(clearTimeout);
         timers.clear();
      };
   }, []);
   // the flash timers of the current round, cleared on a new round and on unmount
   const roundTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

   // Max hints: 10 for Path Memory, unlimited if shared
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

   // Convert index to row/column
   const idxToRC = useCallback(
      (idx: number) => {
         return { r: Math.floor(idx / gridSize), c: idx % gridSize };
      },
      [gridSize]
   );

   // Convert row/column to index
   const rcToIdx = useCallback(
      (r: number, c: number) => {
         return r * gridSize + c;
      },
      [gridSize]
   );

   // Get neighbors (up, down, left, right)
   const getNeighbors = useCallback(
      (idx: number): number[] => {
         const { r, c } = idxToRC(idx);
         const list: number[] = [];
         const dirs = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
         ];
         for (const [dr, dc] of dirs) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr >= 0 && cc >= 0 && rr < gridSize && cc < gridSize) {
               list.push(rcToIdx(rr, cc));
            }
         }
         return list;
      },
      [gridSize, idxToRC, rcToIdx]
   );

   // Generate random path (random walk without revisiting)
   const generateRandomPath = useCallback(
      (length: number): number[] => {
         const start = Math.floor(Math.random() * gridSize * gridSize);
         const used = new Set([start]);
         const out = [start];

         while (out.length < length) {
            const current = out[out.length - 1];
            const nextOptions = getNeighbors(current).filter(
               (n) => !used.has(n)
            );

            if (nextOptions.length === 0) {
               // Restart if stuck
               return generateRandomPath(length);
            }
            const next =
               nextOptions[Math.floor(Math.random() * nextOptions.length)];
            out.push(next);
            used.add(next);
         }

         return out;
      },
      [gridSize, getNeighbors]
   );

   // Get path length for round
   const getPathLength = useCallback((round: number): number => {
      const base = 3;
      const max = 9;
      return Math.min(base + Math.floor(round / 2), max);
   }, []);

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
         await registerShare(shareId, "path-memory");
         const gameKey = "play50games_shared_path-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            // Check if currentShareId still exists before making the API call
            if (!currentShareId) {
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               return;
            }

            // Check expiry from localStorage before making API call
            const gameKey = "play50games_shared_path-memory";
            const stored = localStorage.getItem(gameKey);
            if (stored) {
               try {
                  const data = JSON.parse(stored);
                  // Check if share has expired (15 minutes)
                  if (data.expiry && Date.now() > data.expiry) {
                     // Share expired - clean up
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
                  // Invalid data, clean up
                  localStorage.removeItem(gameKey);
               }
            }

            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  // Store expiry time (15 minutes from now)
                  const gameKey = "play50games_shared_path-memory";
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
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, 15 * 60 * 1000);
               }
            } catch (error) {
               // Handle 404 as expired share
               const errorMessage =
                  error instanceof Error ? error.message : String(error);
               if (
                  errorMessage.includes("404") ||
                  errorMessage.includes("not found") ||
                  errorMessage.includes("expired")
               ) {
                  // Share expired or not found - clean up
                  const gameKey = "play50games_shared_path-memory";
                  localStorage.removeItem(gameKey);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setCurrentShareId(null);
                  setHasShared(false);
                  setUnlimitedActivated(false);
               }
            }
         }, 10000); // Check every 10 seconds
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_path-memory";
      const stored = localStorage.getItem(gameKey);
      if (stored) {
         try {
            const data = JSON.parse(stored);
            // Check if share has expired
            if (data.expiry && Date.now() > data.expiry) {
               // Share expired - clean up
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
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

   // Handle copy link to clipboard
   const handleCopyLink = async (shareId: string) => {
      const currentUrl = window.location.href.split("?")[0];
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         setShareSuccess(true);
         shareTimeout(() => setShareSuccess(false), 15000);
      } catch (error) {
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            setShareSuccess(true);
            shareTimeout(() => setShareSuccess(false), 15000);
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Path Recall Game",
               text: "Check out this awesome Path Recall game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            shareTimeout(() => setShareSuccess(false), 15000);
         } catch (error: any) {
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         handleCopyLink(shareId);
      }
   };

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return;
      if (gameState !== "input") return;
      if (path.length === 0) return;

      // Find the next position in path that needs to be revealed
      // Start from the position after the last clicked cell OR the last revealed hint
      const lastClickedIndex = playerPath.length - 1; // Last clicked position in path
      const lastRevealedHint =
         hintRevealed.length > 0 ? Math.max(...hintRevealed) : -1; // Last revealed hint position

      // Next position should be after both the last clicked and last revealed hint
      const nextPositionIndex = Math.max(
         lastClickedIndex + 1,
         lastRevealedHint + 1
      );

      if (nextPositionIndex < path.length) {
         // Check if this position hasn't been revealed yet
         if (!hintRevealed.includes(nextPositionIndex)) {
            setHintRevealed([...hintRevealed, nextPositionIndex]);
            setHintsUsed(hintsUsed + 1);
         }
      }
   };

   // Start round
   const startRound = useCallback(() => {
      const pathLength = getPathLength(currentRound + 1);
      const newPath = generateRandomPath(pathLength);

      setPath(newPath);
      setPlayerPath([]);
      setGameState("memorizing");
      setFeedback(null);
      setHintRevealed([]);
      setSelectedCellIndex(null);
      setFlashingCellIndex(null);

      // Flash path sequence using state (same delays as before; every timer is kept so it can be cleared)
      roundTimersRef.current.forEach(clearTimeout);
      const timers: ReturnType<typeof setTimeout>[] = [];
      roundTimersRef.current = timers;
      newPath.forEach((idx, i) => {
         timers.push(
            setTimeout(() => {
               setFlashingCellIndex(idx);
               timers.push(
                  setTimeout(() => {
                     setFlashingCellIndex(null);
                  }, 320)
               );
            }, 600 + i * 480)
         );
      });

      // Switch to input phase after path is shown
      timers.push(
         setTimeout(() => {
            setGameState("input");
            setFlashingCellIndex(null);
         }, 600 + newPath.length * 480 + 200)
      );
   }, [currentRound, getPathLength, generateRandomPath]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
      return () => {
         roundTimersRef.current.forEach(clearTimeout);
         roundTimersRef.current = [];
      };
   }, [currentRound, maxRounds, startRound]);

   // Update score
   useEffect(() => {
      const completedRounds = currentRound;
      const newScore = Math.round((completedRounds / maxRounds) * 100);
      setCurrentScore(newScore);
      if (onScoreUpdate) {
         setTimeout(() => onScoreUpdate(newScore), 0);
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
      (idx: number) => {
         if (gameState !== "input") return;
         if (playerPath.includes(idx)) return; // Already selected

         const step = playerPath.length;
         const newPlayerPath = [...playerPath, idx];
         setPlayerPath(newPlayerPath);

         // Check if correct
         if (idx === path[step]) {
            // Correct step
            if (newPlayerPath.length === path.length) {
               // Path complete
               setGameState("correct");
               setFeedback("correct");
               later(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 900);
            }
         } else {
            // Wrong step
            setGameState("wrong");
            setFeedback("wrong");
            // Allow retry - reset after showing feedback
            later(() => {
               setPlayerPath([]);
               setGameState("input");
               setFeedback(null);
            }, 1300);
         }
      },
      [gameState, playerPath, path, later]
   );

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const key = e.key;
         const keyLower = key.toLowerCase();
         const totalCells = gridSize * gridSize;

         // Arrow keys or WASD: Navigate
         if (selectedCellIndex === null) {
            if (
               key === "ArrowUp" ||
               key === "ArrowDown" ||
               key === "ArrowLeft" ||
               key === "ArrowRight" ||
               keyLower === "w" ||
               keyLower === "s" ||
               keyLower === "a" ||
               keyLower === "d"
            ) {
               e.preventDefault();
               // Find first cell that's not selected
               for (let i = 0; i < totalCells; i++) {
                  if (!playerPath.includes(i)) {
                     setSelectedCellIndex(i);
                     return;
                  }
               }
            }
            return;
         }

         // Navigate with arrow keys
         let newIndex = selectedCellIndex;
         const { r, c } = idxToRC(selectedCellIndex);

         switch (key) {
            case "ArrowUp":
            case "w":
               e.preventDefault();
               if (r > 0) {
                  newIndex = rcToIdx(r - 1, c);
               }
               break;
            case "ArrowDown":
            case "s":
               e.preventDefault();
               if (r < gridSize - 1) {
                  newIndex = rcToIdx(r + 1, c);
               }
               break;
            case "ArrowLeft":
            case "a":
               e.preventDefault();
               if (c > 0) {
                  newIndex = rcToIdx(r, c - 1);
               }
               break;
            case "ArrowRight":
            case "d":
               e.preventDefault();
               if (c < gridSize - 1) {
                  newIndex = rcToIdx(r, c + 1);
               }
               break;
            case "Enter":
            case " ":
               e.preventDefault();
               if (!playerPath.includes(selectedCellIndex)) {
                  handleCellClick(selectedCellIndex);
               }
               return;
         }

         // Ensure newIndex is within bounds and not already selected
         if (
            newIndex !== selectedCellIndex &&
            newIndex >= 0 &&
            newIndex < totalCells
         ) {
            if (!playerPath.includes(newIndex)) {
               setSelectedCellIndex(newIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedCellIndex,
      gridSize,
      playerPath,
      handleCellClick,
      idxToRC,
      rcToIdx,
   ]);

   const completedRounds = currentRound;
   const pathLength = path.length;
   const hintDisabled =
      (maxHints > 0 && hintsUsed >= maxHints) ||
      gameState !== "input" ||
      hintRevealed.length >= path.length;

   return (
      <div className={`${m.root} ${m.tight}`} style={{ maxWidth: "700px" }}>
         {/* Header */}
         <div className={m.panel}>
            <div className={`${ir.title} ${m.landHide}`}>
               <PuzzlePieceIcon className={ir.titleIcon} />
               <h2 className={ir.titleText}>Path Recall</h2>
            </div>
            <div className={m.stats}>
               <span className={m.stat}>
                  <ArrowPathIcon className={m.statIcon} />
                  Round <b>{Math.min(currentRound + 1, maxRounds)} / {maxRounds}</b>
               </span>
               <span className={m.stat}>
                  <TrophyIcon className={m.statIcon} />
                  Score <b>{currentScore} / 100</b>
               </span>
               <span className={m.stat}>
                  Path length <b>{pathLength}</b>
               </span>
            </div>
            {/* Progress Bar */}
            <div className={m.progress}>
               <div
                  className={m.progressFill}
                  style={{
                     transform: `scaleX(${Math.min((currentRound + 1) / maxRounds, 1)})`,
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div key={gameState} className={`${m.panel} ${ir.statusRow}`}>
            <div>
               <div className={ir.statusLine}>
                  {gameState === "memorizing"
                     ? "Watch the path…"
                     : gameState === "input"
                     ? "Your turn: recreate the path"
                     : gameState === "correct"
                     ? "Correct! Great job!"
                     : "Wrong! Try again."}
               </div>
               {gameState === "memorizing" && (
                  <div className={ir.statusSub}>
                     After it disappears, click the cells in the same order
                  </div>
               )}
            </div>
            <span
               className={`${ir.chip} ${
                  gameState === "correct"
                     ? ir.chipOk
                     : gameState === "wrong"
                     ? ir.chipBad
                     : ""
               }`}
            >
               {gameState === "memorizing"
                  ? "Memorizing"
                  : gameState === "input"
                  ? "Your Turn"
                  : gameState === "correct"
                  ? "Correct"
                  : "Wrong"}
            </span>
         </div>

         {/* Game Board */}
         <div
            key={currentRound}
            className={`${m.board} ${m.stagger}`}
            style={{
               gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
               // square board: fits the screen height, and a cell never grows past 72 px
               maxWidth: `min(100%, calc(100dvh - 170px), ${gridSize * 72}px)`,
            }}
         >
            {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
               const isSelected = playerPath.includes(idx);
               const isHinted = hintRevealed.some(
                  (hintIdx) => path[hintIdx] === idx
               );
               const isFlashing = flashingCellIndex === idx;
               const orderInPath = path.indexOf(idx);
               const orderInInput = playerPath.indexOf(idx);
               const isCorrect = isSelected && orderInInput === orderInPath;
               const isWrong = isSelected && orderInInput !== orderInPath;
               const stateClass = isFlashing
                  ? ir.flashCue
                  : isCorrect
                  ? `${m.cardMatched} ${m.matched}`
                  : isWrong
                  ? `${m.cardWrong} ${m.wrong}`
                  : isHinted
                  ? m.cardHint
                  : selectedCellIndex === idx
                  ? m.cardSelected
                  : "";

               return (
                  <button
                     key={idx}
                     className={`path-cell ${m.card} ${stateClass}`}
                     data-idx={idx}
                     onClick={() => handleCellClick(idx)}
                     disabled={gameState !== "input" || isSelected}
                     aria-label={`Cell ${idx + 1}`}
                     style={{ ["--i" as string]: idx }}
                  >
                     <span className={`${m.face} ${ir.step}`}>
                        {isSelected
                           ? orderInInput + 1
                           : isHinted
                           ? orderInPath + 1
                           : ""}
                     </span>
                  </button>
               );
            })}
         </div>

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               role="status"
               className={`${m.feedback} ${
                  feedback === "correct" ? m.feedbackOk : m.feedbackBad
               }`}
               style={{ maxWidth: "none" }}
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

         {/* Action Buttons: Hint, Share */}
         <div className={ir.actions}>
            {/* Hint Button */}
            <button
               onClick={handleHint}
               className={`${m.btn} ${m.pill}`}
               disabled={hintDisabled}
            >
               <LightBulbIcon className={m.pillIcon} />
               <span>
                  Hint ({hintsUsed}/{maxHints === 0 ? "∞" : maxHints})
               </span>
            </button>

            {/* Share Button */}
            <button onClick={handleShare} className={`${m.btn} ${m.pill}`}>
               <ShareIcon className={m.pillIcon} />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>

         {/* Share Success Messages */}
         {shareSuccess && (
            <div className={`${m.note} ${m.noteOk}`} style={{ width: "100%" }}>
               <CheckCircleIcon className={m.noteIcon} />
               <span>
                  {isMobile
                     ? "Link copied! Unlimited hints unlock when someone opens it!"
                     : "Link copied! Unlimited hints will unlock when someone opens your link!"}
               </span>
            </div>
         )}

         {unlimitedActivated && (
            <div className={m.note} style={{ width: "100%" }}>
               <CheckCircleIcon className={m.noteIcon} />
               <span>
                  {isMobile
                     ? "Unlimited hints active for 15 minutes!"
                     : "Someone opened your link! Unlimited hints are now active for 15 minutes!"}
               </span>
            </div>
         )}
      </div>
   );
}

export default PathMemory;
