"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   TrophyIcon,
   PuzzlePieceIcon,
   SparklesIcon,
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
         setTimeout(() => setShareSuccess(false), 15000);
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
            setTimeout(() => setShareSuccess(false), 15000);
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
               title: "Path Memory Game",
               text: "Check out this awesome Path Memory game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
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

      // Flash path sequence using state
      newPath.forEach((idx, i) => {
         setTimeout(() => {
            setFlashingCellIndex(idx);
            setTimeout(() => {
               setFlashingCellIndex(null);
            }, 320);
         }, 600 + i * 480);
      });

      // Switch to input phase after path is shown
      setTimeout(() => {
         setGameState("input");
         setFlashingCellIndex(null);
      }, 600 + newPath.length * 480 + 200);
   }, [currentRound, getPathLength, generateRandomPath]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
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
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

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
               setTimeout(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 900);
            }
         } else {
            // Wrong step
            setGameState("wrong");
            setFeedback("wrong");
            // Allow retry - reset after showing feedback
            setTimeout(() => {
               setPlayerPath([]);
               setGameState("input");
               setFeedback(null);
            }, 1300);
         }
      },
      [gameState, playerPath, path]
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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            padding: isMobile ? "16px" : "24px",
            maxWidth: "100%",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "12px" : "16px",
               paddingBottom: isMobile ? "12px" : "16px",
               borderBottom: "1px solid var(--stroke)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "8px" : "12px",
                  paddingBottom: isMobile ? "12px" : "16px",
                  marginBottom: isMobile ? "12px" : "16px",
                  borderBottom: "1px solid var(--stroke)",
               }}
            >
               <PuzzlePieceIcon
                  style={{
                     width: isMobile ? 24 : 28,
                     height: isMobile ? 24 : 28,
                     color: "var(--accent)",
                  }}
               />
               <h2
                  style={{
                     fontSize: isMobile ? "1.25rem" : "1.5rem",
                     fontWeight: 700,
                     margin: 0,
                     background:
                        "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                     WebkitBackgroundClip: "text",
                     WebkitTextFillColor: "transparent",
                     backgroundClip: "text",
                     textShadow: "0 2px 8px rgba(125, 211, 252, 0.3)",
                  }}
               >
                  Path Memory
               </h2>
               <SparklesIcon
                  style={{
                     width: isMobile ? 24 : 28,
                     height: isMobile ? 24 : 28,
                     color: "var(--ok)",
                  }}
               />
            </div>
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: isMobile ? "8px" : "12px",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     color: "var(--text)",
                  }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 16 : 18,
                        height: isMobile ? 16 : 18,
                        color: "var(--accent)",
                     }}
                  />
                  <span>
                     Round {currentRound + 1} / {maxRounds}
                  </span>
               </div>
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     color: "var(--text)",
                  }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 16 : 18,
                        height: isMobile ? 16 : 18,
                        color: "var(--ok)",
                     }}
                  />
                  <span>Score: {currentScore} / 100</span>
               </div>
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     color: "var(--text)",
                  }}
               >
                  <span>Path length: {pathLength}</span>
               </div>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "999px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               padding: isMobile ? "12px 16px" : "16px 24px",
               borderRadius: "12px",
               background: "rgba(255, 255, 255, 0.05)",
               border: "1px solid var(--stroke)",
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               gap: "12px",
            }}
         >
            <div>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.1rem",
                     color: "var(--text)",
                  }}
               >
                  {gameState === "memorizing"
                     ? "Watch the path…"
                     : gameState === "input"
                     ? "Your turn: recreate the path"
                     : gameState === "correct"
                     ? "Correct! Great job!"
                     : "Wrong! Try again."}
               </b>
               {gameState === "memorizing" && (
                  <small
                     style={{
                        display: "block",
                        color: "var(--muted)",
                        marginTop: "4px",
                        fontSize: isMobile ? "0.75rem" : "0.875rem",
                     }}
                  >
                     After it disappears, click the cells in the same order
                  </small>
               )}
            </div>
            <span
               style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background:
                     gameState === "correct"
                        ? "rgba(54, 211, 153, 0.15)"
                        : gameState === "wrong"
                        ? "rgba(251, 113, 133, 0.15)"
                        : "rgba(15, 27, 51, 0.55)",
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--text)",
               }}
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
            style={{
               display: "flex",
               justifyContent: "center",
               alignItems: "center",
               padding: isMobile ? "12px" : "16px",
            }}
         >
            <div
               style={{
                  borderRadius: "18px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background:
                     "radial-gradient(320px 220px at 30% 30%, rgba(110, 168, 255, 0.1), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                  boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                  padding: isMobile ? "12px" : "16px",
                  width: "max-content",
                  margin: "0 auto",
               }}
            >
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: `repeat(${gridSize}, ${
                        isMobile ? "48px" : "52px"
                     })`,
                     gap: isMobile ? "9px" : "10px",
                  }}
               >
                  {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                     const isInPath = path.includes(idx);
                     const isSelected = playerPath.includes(idx);
                     const isHinted = hintRevealed.some(
                        (hintIdx) => path[hintIdx] === idx
                     );
                     const isFlashing = flashingCellIndex === idx;
                     const orderInPath = path.indexOf(idx);
                     const orderInInput = playerPath.indexOf(idx);
                     const isCorrect =
                        isSelected && orderInInput === orderInPath;
                     const isWrong = isSelected && orderInInput !== orderInPath;

                     return (
                        <button
                           key={idx}
                           className={
                              isFlashing ? "path-cell flash" : "path-cell"
                           }
                           data-idx={idx}
                           onClick={() => handleCellClick(idx)}
                           disabled={gameState !== "input" || isSelected}
                           style={{
                              width: isMobile ? "48px" : "52px",
                              height: isMobile ? "48px" : "52px",
                              borderRadius: "16px",
                              border: `${
                                 isFlashing
                                    ? "2px solid rgba(110, 168, 255, 0.9)"
                                    : isCorrect
                                    ? "2px solid rgba(54, 211, 153, 0.55)"
                                    : isWrong
                                    ? "2px solid rgba(251, 113, 133, 0.55)"
                                    : isSelected
                                    ? "2px solid rgba(110, 168, 255, 0.35)"
                                    : isHinted
                                    ? "2px solid rgba(251, 191, 36, 0.6)"
                                    : selectedCellIndex === idx
                                    ? "2px solid rgba(251, 191, 36, 0.8)"
                                    : "1px solid rgba(255, 255, 255, 0.1)"
                              }`,
                              outline:
                                 selectedCellIndex === idx &&
                                 !isSelected &&
                                 !isFlashing
                                    ? "2px solid rgba(251, 191, 36, 0.5)"
                                    : "none",
                              outlineOffset:
                                 selectedCellIndex === idx ? "2px" : "0",
                              background: isFlashing
                                 ? "rgba(110, 168, 255, 0.25)"
                                 : isCorrect
                                 ? "rgba(54, 211, 153, 0.1)"
                                 : isWrong
                                 ? "rgba(251, 113, 133, 0.1)"
                                 : isSelected
                                 ? "rgba(110, 168, 255, 0.1)"
                                 : isHinted
                                 ? "rgba(251, 191, 36, 0.15)"
                                 : selectedCellIndex === idx && !isSelected
                                 ? "rgba(251, 191, 36, 0.1)"
                                 : "rgba(15, 27, 51, 0.45)",
                              boxShadow: isFlashing
                                 ? "0 0 30px rgba(110, 168, 255, 0.8), 0 0 50px rgba(110, 168, 255, 0.5), inset 0 0 20px rgba(110, 168, 255, 0.3)"
                                 : isCorrect || isWrong
                                 ? `0 10px 24px ${
                                      isCorrect
                                         ? "rgba(54, 211, 153, 0.18)"
                                         : "rgba(251, 113, 133, 0.18)"
                                   }`
                                 : "0 10px 18px rgba(0, 0, 0, 0.16)",
                              cursor:
                                 gameState === "input" && !isSelected
                                    ? "pointer"
                                    : "not-allowed",
                              userSelect: "none",
                              position: "relative",
                              overflow: "hidden",
                              transition: isFlashing
                                 ? "all 0.32s ease-out"
                                 : "all 0.12s",
                              transform: isFlashing
                                 ? "translateY(-2px) scale(1.05)"
                                 : "translateY(0)",
                              zIndex: isFlashing ? 10 : 1,
                           }}
                        >
                           {(isSelected || isHinted) && (
                              <div
                                 style={{
                                    position: "absolute",
                                    inset: "auto 10px 10px auto",
                                    width: "26px",
                                    height: "26px",
                                    borderRadius: "999px",
                                    background: "rgba(15, 27, 51, 0.62)",
                                    border:
                                       "1px solid rgba(255, 255, 255, 0.12)",
                                    display: "grid",
                                    placeItems: "center",
                                    fontWeight: 900,
                                    fontSize: "12px",
                                    color: "rgba(232, 238, 252, 0.95)",
                                    zIndex: 2,
                                 }}
                              >
                                 {isSelected
                                    ? orderInInput + 1
                                    : orderInPath + 1}
                              </div>
                           )}
                        </button>
                     );
                  })}
               </div>
            </div>
         </div>

         {/* Feedback Message (from Match the Shapes) */}
         {feedback !== null && (
            <div
               style={{
                  padding: "16px 24px",
                  borderRadius: "12px",
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  animation: "slideIn 0.3s ease-out",
                  background:
                     feedback === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : "rgba(252, 165, 165, 0.2)",
                  border: `1px solid ${
                     feedback === "correct" ? "var(--ok)" : "var(--warn)"
                  }`,
                  color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon style={{ width: 24, height: 24 }} />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}

         {/* Action Buttons: Hint, Share */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "12px" : "16px",
               flexWrap: "wrap",
               justifyContent: "center",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  gameState !== "input" ||
                  hintRevealed.length >= path.length
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(100, 100, 100, 0.2)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `1px solid ${
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(100, 100, 100, 0.3)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,
                  borderRadius: "12px",
                  color:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.4)"
                        : "var(--text)",
                  fontSize: isMobile ? "0.875rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= path.length
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= path.length
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < path.length
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(251, 191, 36, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(251, 191, 36, 0.3)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < path.length
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(251, 191, 36, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
               }}
            >
               <LightBulbIcon style={{ width: 18, height: 18 }} />
               <span>
                  Hint ({hintsUsed}/{maxHints === 0 ? "∞" : maxHints})
               </span>
            </button>

            {/* Share Button */}
            <button
               onClick={handleShare}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "1px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.8)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                     "0 4px 12px rgba(59, 130, 246, 0.3)";
               }}
               onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                  e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.6)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
               }}
            >
               <ShareIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color: "rgba(59, 130, 246, 0.9)",
                  }}
               />
               <span>{isMobile ? "Share" : "Share for Unlimited Hints"}</span>
            </button>
         </div>

         {/* Share Success Messages */}
         {shareSuccess && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  background:
                     "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                  border: "2px solid rgba(34, 197, 94, 0.6)",
                  borderRadius: isMobile ? "10px" : "8px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.9rem",
                  fontWeight: 500,
                  width: "100%",
                  justifyContent: "center",
                  textAlign: "center",
                  flexWrap: "wrap",
                  animation: "slideIn 0.3s ease",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 16 : 18,
                     height: isMobile ? 16 : 18,
                     color: "rgba(34, 197, 94, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span>
                  {isMobile
                     ? "Link copied! Unlimited hints unlock when someone opens it!"
                     : "Link copied! Unlimited hints will unlock when someone opens your link!"}
               </span>
            </div>
         )}

         {unlimitedActivated && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 14px" : "8px 16px",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "2px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: isMobile ? "10px" : "8px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.9rem",
                  fontWeight: 500,
                  width: "100%",
                  justifyContent: "center",
                  textAlign: "center",
                  flexWrap: "wrap",
                  animation: "slideIn 0.3s ease",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 16 : 18,
                     height: isMobile ? 16 : 18,
                     color: "rgba(59, 130, 246, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span>
                  {isMobile
                     ? "🎉 Unlimited hints active for 15 minutes!"
                     : "🎉 Someone opened your link! Unlimited hints are now active for 15 minutes!"}
               </span>
            </div>
         )}
      </div>
   );
}

export default PathMemory;
