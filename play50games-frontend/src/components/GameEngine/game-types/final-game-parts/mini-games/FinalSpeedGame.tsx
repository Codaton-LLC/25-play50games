"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   MiniHead,
   Feedback,
   DoneSheet,
   ReplayShareBar,
   chrome as c,
} from "../FinalChrome";
import {
   ClockIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import { useCompleteOnce } from "../useCompleteOnce";

interface FinalSpeedGameProps {
   config: Record<string, any>;
   onComplete: (score: number) => void;
   isPlaying: boolean;
}

export default function FinalSpeedGame({
   config,
   onComplete,
   isPlaying,
}: FinalSpeedGameProps) {
   const maxTargets = config.targets || 10;
   const [currentTarget, setCurrentTarget] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<"playing" | "ready" | "failed">(
      "playing"
   );
   const [currentColor, setCurrentColor] = useState<string>("");
   const [timeLeft, setTimeLeft] = useState(5);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const timerRef = useRef<NodeJS.Timeout | null>(null);
   const timeoutRef = useRef<NodeJS.Timeout | null>(null);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited
   const { completeLater, rearm } = useCompleteOnce();


   // Color mapping (opposite colors)
   const colorMap: Record<string, string> = {
      "🔴": "🟢", // Red -> Green
      "🔵": "🟡", // Blue -> Yellow
      "🟢": "🔴", // Green -> Red
      "🟡": "🔵", // Yellow -> Blue
   };

   const colors = ["🔴", "🔵", "🟢", "🟡"];

   // Get time limit based on target
   const getTimeLimit = useCallback(() => {
      // Give more time: 5s -> 4s -> 3.5s for better gameplay
      if (currentTarget < 3) return 5;
      if (currentTarget < 7) return 4;
      return 3.5;
   }, [currentTarget]);

   // Generate new target
   const generateTarget = useCallback(() => {
      const color = colors[Math.floor(Math.random() * colors.length)];
      setCurrentColor(color);
      setTimeLeft(getTimeLimit());
      setFeedback(null);
      // Add a small delay before starting to give user time to see the new target
      setTimeout(() => {
         setGameState("playing");
      }, 300);
   }, [getTimeLimit]);

   // Initialize first target
   useEffect(() => {
      if (isPlaying && currentTarget < maxTargets) {
         generateTarget();
      }
   }, [isPlaying, currentTarget, maxTargets, generateTarget]);

   // Handle color click
   const handleColorClick = useCallback(
      (clickedColor: string, isTimeout: boolean = false) => {
         if (gameState !== "playing") return;

         // Clear timers
         if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
         }
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }

         const correctColor = colorMap[currentColor];
         const isCorrect = clickedColor === correctColor && !isTimeout;

         setFeedback(isCorrect ? "correct" : "wrong");
         setGameState("ready");

         if (isCorrect) {
            const targetScore = Math.round(100 / maxTargets);
            const newScore = Math.min(100, currentScore + targetScore);
            setCurrentScore(newScore);

            setTimeout(() => {
               if (currentTarget + 1 >= maxTargets) {
                  // Wait longer before completing to show final message
                  completeLater(() => onComplete(100), 2500);
               } else {
                  setCurrentTarget((prev) => prev + 1);
               }
            }, 2000);
         } else {
            setTimeout(() => {
               setCurrentTarget((prev) => prev + 1);
            }, 2000);
         }
      },
      [
         gameState,
         currentColor,
         maxTargets,
         currentScore,
         currentTarget,
         onComplete,
         completeLater,
      ]
   );

   // Timer countdown
   useEffect(() => {
      if (gameState !== "playing" || !currentColor) return;

      // Add a small delay before starting the timer to give user time to see the target
      const startTimer = setTimeout(() => {
         timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
               if (prev <= 0.1) {
                  // Timeout - wrong answer
                  handleColorClick("", true);
                  return 0;
               }
               return prev - 0.1;
            });
         }, 100);
      }, 500); // Wait 500ms before starting timer

      return () => {
         clearTimeout(startTimer);
         if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
         }
      };
   }, [gameState, currentColor, handleColorClick]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "final-speed-game");
         const gameKey = "play50games_shared_final-speed-game";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {
         // Error registering share
      }
   };

   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      await registerShareLink(shareId);

      if (navigator.share) {
         try {
            await navigator.share({
               title: "Final Speed Game",
               text: "Check out this awesome game!",
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
         } catch (err) {
            // Failed to copy
         }
         document.body.removeChild(textArea);
      }
   };

   // Check share status
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_final-speed-game";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     share_id: currentShareId,
                     shared: true,
                     expiry: expiry,
                  })
               );

               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, 15 * 60 * 1000);

               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         } catch (error) {
            const errorMessage =
               error instanceof Error ? error.message : String(error);
            if (
               errorMessage.includes("404") ||
               errorMessage.includes("not found") ||
               errorMessage.includes("expired")
            ) {
               setUnlimitedActivated(false);
               setHasShared(false);
               localStorage.removeItem(gameKey);
               setCurrentShareId(null);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
            shareCheckIntervalRef.current = null;
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_final-speed-game";
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
               const verifyShare = async () => {
                  try {
                     const status = await getShareStatus(data.share_id);
                     const hasClicks = status.has_clicks || status.clicks > 0;
                     if (hasClicks) {
                        if (
                           data.shared &&
                           data.expiry &&
                           Date.now() < data.expiry
                        ) {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const remainingTime = data.expiry - Date.now();
                           if (remainingTime > 0) {
                              setTimeout(() => {
                                 setUnlimitedActivated(false);
                                 setHasShared(false);
                                 localStorage.removeItem(gameKey);
                              }, remainingTime);
                           }
                        } else {
                           setHasShared(true);
                           setUnlimitedActivated(true);
                           setReplaysUsed(0);
                           const expiryTime = Date.now() + 15 * 60 * 1000;
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
                     }
                  } catch (error) {
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

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         trackShareClick(sharedBy);
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing
            }
         }
      }
   }, []);

   // Handle replay
   const handleReplay = useCallback(() => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setCurrentTarget(0);
      setCurrentScore(0);
      setTimeLeft(2);
      setFeedback(null);
      setReplaysUsed((prev) => prev + 1);
      rearm();

      // Force re-initialize by generating new color
      setTimeout(() => {
         const colors = ["🔴", "🔵", "🟢", "🟡"];
         const randomColor = colors[Math.floor(Math.random() * colors.length)];
         setCurrentColor(randomColor);
         setGameState("playing");
      }, 0);
   }, [maxReplays, replaysUsed, rearm]);

   const progress =
      maxTargets > 0 ? Math.round(((currentTarget + 1) / maxTargets) * 100) : 0;

   return (
      <div className={c.mini}>
         {/* Header */}
         <MiniHead
            unit="Target"
            current={currentTarget + 1}
            total={maxTargets}
            score={currentScore}
            progress={progress}
            extra={
               <span className={c.miniStat}>
                  <ClockIcon className={c.chipIcon} aria-hidden="true" />
                  {timeLeft.toFixed(1)}s
               </span>
            }
         />

         {/* Game Area */}
         {gameState === "playing" && currentColor && (
            <div className={`${c.panel} ${c.area}`}>
               <div className={c.rule}>
                  Click the <span className={c.ruleKey}>OPPOSITE</span> color:
                  <span className={c.ruleSub}>
                     🔴 → 🟢 | 🔵 → 🟡 | 🟢 → 🔴 | 🟡 → 🔵
                  </span>
               </div>
               <div key={`${currentTarget}-${currentColor}`} className={c.bigEmoji}>
                  {currentColor}
               </div>
               <p className={c.hint}>
                  Click: <span className={c.ruleKey}>{colorMap[currentColor]}</span>
               </p>
               <div className={c.tiles2}>
                  {colors.map((color) => (
                     <button
                        key={color}
                        type="button"
                        onClick={() => handleColorClick(color)}
                        className={`${c.tile} ${c.colorTile}`}
                        aria-label={`Color ${color}`}
                     >
                        {color}
                     </button>
                  ))}
               </div>
            </div>
         )}

         {/* Feedback */}
         {feedback && gameState === "ready" && (
            <Feedback ok={feedback === "correct"}>
               {feedback === "correct"
                  ? "Correct! Great job!"
                  : "Time's up! Try again!"}
            </Feedback>
         )}

         {/* Replay and Share Buttons */}
         {(gameState === "playing" || gameState === "ready" || feedback) && (
            <ReplayShareBar
               shareSuccess={shareSuccess}
               unlimitedActivated={unlimitedActivated}
               maxReplays={maxReplays}
               replaysUsed={replaysUsed}
               onReplay={handleReplay}
               onShare={handleShare}
            />
         )}

         {/* Game Complete */}
         {currentTarget >= maxTargets && (
            <DoneSheet
               badge="Game Complete!"
               text={<>All {maxTargets} targets completed!</>}
            />
         )}
      </div>
   );
}
