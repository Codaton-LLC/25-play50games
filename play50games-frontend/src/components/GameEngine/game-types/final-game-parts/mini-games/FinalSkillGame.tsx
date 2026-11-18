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
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import { useCompleteOnce } from "../useCompleteOnce";

// One 60 Hz frame. The circle shrinks by elapsed time scaled to this, so the
// deadline is the same on every refresh rate (and exactly as before at 60 Hz).
const FRAME_MS = 1000 / 60;
// Cap one step (tab switch, long stall) so the circle never jumps far.
const MAX_STEP_MS = 100;

interface FinalSkillGameProps {
   config: Record<string, any>;
   onComplete: (score: number) => void;
   isPlaying: boolean;
}

export default function FinalSkillGame({
   config,
   onComplete,
   isPlaying,
}: FinalSkillGameProps) {
   const maxTargets = config.targets || 10;
   const [currentTarget, setCurrentTarget] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<"playing" | "ready" | "failed">(
      "playing"
   );
   const [circleSize, setCircleSize] = useState(100);
   const [isShrinking, setIsShrinking] = useState(true);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const animationRef = useRef<number | null>(null);
   const startTimeRef = useRef<number>(0);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   // Hides the "shared" notice after 15 s; cleared on unmount
   const shareSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
   );
   useEffect(
      () => () => {
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
      },
      []
   );
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited
   const { completeLater, rearm } = useCompleteOnce();


   // Get target zone based on target number
   const getTargetZone = useCallback(() => {
      // Zone becomes narrower as targets increase
      // Target 0-2: 30-50%
      // Target 3-6: 35-45%
      // Target 7-9: 38-42%
      if (currentTarget < 3) return { min: 30, max: 50 };
      if (currentTarget < 7) return { min: 35, max: 45 };
      return { min: 38, max: 42 };
   }, [currentTarget]);

   // Initialize target
   const startTarget = useCallback(() => {
      setCircleSize(100);
      setIsShrinking(true);
      setFeedback(null);
      setGameState("playing");
      startTimeRef.current = Date.now();
   }, []);

   // Initialize first target
   useEffect(() => {
      if (isPlaying && currentTarget < maxTargets) {
         startTarget();
      }
   }, [isPlaying, currentTarget, maxTargets, startTarget]);

   // Animation loop
   useEffect(() => {
      if (gameState !== "playing" || !isShrinking) return;

      let lastTs: number | null = null;
      const animate = (ts: number) => {
         const dt =
            lastTs === null ? FRAME_MS : Math.min(ts - lastTs, MAX_STEP_MS);
         lastTs = ts;
         setCircleSize((prev) => {
            if (prev <= 0) {
               setIsShrinking(false);
               // Timeout - wrong answer
               handleCircleClick(true);
               return 0;
            }
            // Shrink by 0.5% per 60 Hz frame
            return Math.max(0, prev - 0.5 * (dt / FRAME_MS));
         });
         animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
         if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
         }
      };
   }, [gameState, isShrinking]);

   // Handle circle click
   const handleCircleClick = (isTimeout: boolean = false) => {
      if (gameState !== "playing") return;

      // Stop animation
      if (animationRef.current) {
         cancelAnimationFrame(animationRef.current);
         animationRef.current = null;
      }

      const zone = getTargetZone();
      const isCorrect =
         !isTimeout && circleSize >= zone.min && circleSize <= zone.max;

      setFeedback(isCorrect ? "correct" : "wrong");
      setGameState("ready");

      if (isCorrect) {
         const targetScore = Math.round(100 / maxTargets);
         const newScore = Math.min(100, currentScore + targetScore);
         setCurrentScore(newScore);

         setTimeout(() => {
            if (currentTarget + 1 >= maxTargets) {
               completeLater(() => onComplete(100), 1000);
            } else {
               setCurrentTarget((prev) => prev + 1);
            }
         }, 1500);
      } else {
         // If wrong, stay on the same level and restart it
         setTimeout(() => {
            startTarget();
         }, 1500);
      }
   };

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "final-skill-game");
         const gameKey = "play50games_shared_final-skill-game";
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
               title: "Final Skill Game",
               text: "Check out this awesome game!",
               url: shareableLink,
            });
            setShareSuccess(true);
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         if (shareSuccessTimeoutRef.current) {
            clearTimeout(shareSuccessTimeoutRef.current);
         }
         shareSuccessTimeoutRef.current = setTimeout(
            () => setShareSuccess(false),
            15000
         );
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
            if (shareSuccessTimeoutRef.current) {
               clearTimeout(shareSuccessTimeoutRef.current);
            }
            shareSuccessTimeoutRef.current = setTimeout(
               () => setShareSuccess(false),
               15000
            );
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
         const gameKey = "play50games_shared_final-skill-game";
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
      const gameKey = "play50games_shared_final-skill-game";
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
      setFeedback(null);
      setReplaysUsed((prev) => prev + 1);
      rearm();

      // Force re-initialize by calling startTarget
      setTimeout(() => {
         startTarget();
      }, 0);
   }, [maxReplays, replaysUsed, startTarget, rearm]);

   const progress =
      maxTargets > 0 ? Math.round(((currentTarget + 1) / maxTargets) * 100) : 0;
   const zone = getTargetZone();

   const inZone = circleSize >= zone.min && circleSize <= zone.max;

   return (
      <div className={c.mini}>
         {/* Header */}
         <MiniHead
            unit="Target"
            current={currentTarget + 1}
            total={maxTargets}
            score={currentScore}
            progress={progress}
         />

         {/* Game Area */}
         {gameState === "playing" && (
            <div className={`${c.panel} ${c.area}`}>
               <div className={c.rule}>
                  Click when circle is between{" "}
                  <span className={c.ruleKey}>
                     {zone.min}% - {zone.max}%
                  </span>
               </div>
               <div className={c.skillStage}>
                  {/* Target zone indicator (for visual reference) */}
                  <div
                     className={c.zoneRing}
                     style={{ width: `${zone.max}%`, height: `${zone.max}%` }}
                  />
                  <div
                     className={c.zoneRing}
                     style={{ width: `${zone.min}%`, height: `${zone.min}%` }}
                  />
                  {/* Shrinking circle: a full-size disc scaled by transform, so the board never
                      re-lays out while it shrinks */}
                  <button
                     type="button"
                     onClick={() => handleCircleClick()}
                     className={`${c.circle} ${inZone ? c.circleIn : c.circleOut}`}
                     aria-label={`Circle at ${Math.round(circleSize)}%`}
                     style={{ transform: `scale(${circleSize / 100})` }}
                  />
                  <span className={c.circleLabel}>{Math.round(circleSize)}%</span>
               </div>
            </div>
         )}

         {/* Feedback */}
         {feedback && gameState === "ready" && (
            <Feedback ok={feedback === "correct"}>
               {feedback === "correct"
                  ? "Perfect timing! Great job!"
                  : "Missed! Try again!"}
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
