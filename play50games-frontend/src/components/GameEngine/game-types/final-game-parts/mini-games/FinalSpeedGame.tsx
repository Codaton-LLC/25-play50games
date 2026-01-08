"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   ArrowPathIcon,
   TrophyIcon,
   ClockIcon,
   ArrowPathRoundedSquareIcon,
   ShareIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

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
   const [isMobile, setIsMobile] = useState(false);
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

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

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
                  setTimeout(() => onComplete(100), 2500);
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

      // Force re-initialize by generating new color
      setTimeout(() => {
         const colors = ["🔴", "🔵", "🟢", "🟡"];
         const randomColor = colors[Math.floor(Math.random() * colors.length)];
         setCurrentColor(randomColor);
         setGameState("playing");
      }, 0);
   }, [maxReplays, replaysUsed]);

   const progress =
      maxTargets > 0 ? Math.round(((currentTarget + 1) / maxTargets) * 100) : 0;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "16px" : "20px",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            padding: isMobile ? "12px" : "16px",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               maxWidth: "800px",
               background: "var(--card)",
               borderRadius: isMobile ? "16px" : "20px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "12px" : "16px",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: isMobile ? "8px" : "12px",
               }}
            >
               <span
                  style={{
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Target {currentTarget + 1} / {maxTargets}
               </span>
               <span
                  style={{
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--ok)",
                     }}
                  />
                  Score: {currentScore} / 100
               </span>
               <span
                  style={{
                     fontSize: isMobile ? "0.875rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     gap: "6px",
                  }}
               >
                  <ClockIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  {timeLeft.toFixed(1)}s
               </span>
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
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "999px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(250, 204, 21, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game Area */}
         {gameState === "playing" && currentColor && (
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  padding: isMobile ? "40px 20px" : "60px 32px",
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "30px" : "40px",
                  minHeight: "400px",
                  justifyContent: "center",
               }}
            >
               <div
                  style={{
                     fontSize: isMobile ? "1.1rem" : "1.3rem",
                     fontWeight: 700,
                     color: "var(--text)",
                     textAlign: "center",
                     marginBottom: "20px",
                     padding: "12px 20px",
                     background: "rgba(250, 204, 21, 0.1)",

                     border: "2px solid var(--accent)",
                  }}
               >
                  <div style={{ marginBottom: "8px" }}>
                     Click the{" "}
                     <span style={{ color: "var(--accent)", fontWeight: 800 }}>
                        OPPOSITE
                     </span>{" "}
                     color:
                  </div>
                  <div
                     style={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        opacity: 0.9,
                     }}
                  >
                     🔴 → 🟢 | 🔵 → 🟡 | 🟢 → 🔴 | 🟡 → 🔵
                  </div>
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "8rem" : "12rem",
                     fontWeight: 800,
                     textAlign: "center",
                     marginBottom: "20px",
                     padding: "20px",
                     background: "rgba(255, 255, 255, 0.05)",
                     borderRadius: "20px",
                     border: "3px solid var(--stroke)",
                  }}
               >
                  {currentColor}
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.1rem",
                     fontWeight: 600,
                     color: "var(--muted)",
                     textAlign: "center",
                     marginBottom: "20px",
                  }}
               >
                  Click:{" "}
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                     {colorMap[currentColor]}
                  </span>
               </div>
               <div
                  style={{
                     display: "grid",
                     gridTemplateColumns: "repeat(2, 1fr)",
                     gap: isMobile ? "20px" : "24px",
                     width: "100%",
                     maxWidth: "400px",
                  }}
               >
                  {colors.map((color) => (
                     <button
                        key={color}
                        onClick={() => handleColorClick(color)}
                        style={{
                           padding: isMobile ? "32px" : "40px",
                           background: "var(--background)",
                           border: "3px solid var(--stroke)",
                           borderRadius: "16px",
                           fontSize: isMobile ? "3rem" : "4rem",
                           fontWeight: 800,
                           cursor: "pointer",
                           transition: "all 0.2s ease",
                           boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                        }}
                        onMouseEnter={(e) => {
                           e.currentTarget.style.transform = "scale(1.05)";
                           e.currentTarget.style.boxShadow =
                              "0 6px 16px rgba(0, 0, 0, 0.3)";
                        }}
                        onMouseLeave={(e) => {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow =
                              "0 4px 12px rgba(0, 0, 0, 0.2)";
                        }}
                     >
                        {color}
                     </button>
                  ))}
               </div>
            </div>
         )}

         {/* Feedback */}
         {feedback && gameState === "ready" && (
            <div
               style={{
                  padding: isMobile ? "16px 20px" : "20px 24px",

                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  maxWidth: "800px",
                  justifyContent: "center",
                  background:
                     feedback === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : "rgba(252, 165, 165, 0.2)",
                  border: `1px solid ${
                     feedback === "correct" ? "var(--ok)" : "var(--warn)"
                  }`,
                  color: feedback === "correct" ? "var(--ok)" : "var(--warn)",
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
                     <span>Time's up! Try again!</span>
                  </>
               )}
            </div>
         )}

         {/* Replay and Share Buttons */}
         {(gameState === "playing" || gameState === "ready" || feedback) && (
            <div
               style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                  padding: isMobile ? "12px" : "16px",
                  background: "var(--card)",

                  width: "100%",
                  maxWidth: "800px",
               }}
            >
               {/* Share Success Message */}
               {shareSuccess && !unlimitedActivated && (
                  <div
                     style={{
                        width: "100%",
                        padding: "12px",
                        background: "rgba(134, 239, 172, 0.2)",
                        border: "2px solid rgba(134, 239, 172, 0.6)",
                        borderRadius: "8px",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--ok)",
                        textAlign: "center",
                        marginBottom: "8px",
                     }}
                  >
                     Link copied! Unlimited replay will unlock when someone
                     opens your link!
                  </div>
               )}

               {/* Unlimited Activated Message */}
               {unlimitedActivated && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isMobile ? "6px" : "8px",
                        padding: isMobile ? "10px 14px" : "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                        border: "2px solid rgba(250, 204, 21, 0.6)",
                        borderRadius: isMobile ? "10px" : "8px",
                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.9rem",
                        fontWeight: 500,
                        width: "100%",
                        justifyContent: "center",
                        textAlign: "center",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 16 : 18,
                           height: isMobile ? 16 : 18,
                           color: "rgba(250, 204, 21, 0.9)",
                           flexShrink: 0,
                        }}
                     />
                     <span>
                        🎉 Someone opened your link! Unlimited replay is now
                        active for 15 minutes!
                     </span>
                  </div>
               )}

               {/* Replay Button */}
               <button
                  onClick={handleReplay}
                  disabled={maxReplays > 0 && replaysUsed >= maxReplays}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     padding: isMobile ? "10px 16px" : "10px 20px",
                     width: isMobile ? "100%" : "auto",
                     background:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "rgba(100, 100, 100, 0.2)"
                           : "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                     border:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "1px solid rgba(100, 100, 100, 0.4)"
                           : "1px solid rgba(250, 204, 21, 0.6)",

                     color: "var(--text)",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 600,
                     cursor:
                        maxReplays > 0 && replaysUsed >= maxReplays
                           ? "not-allowed"
                           : "pointer",
                     opacity:
                        maxReplays > 0 && replaysUsed >= maxReplays ? 0.5 : 1,
                     transition: "all 0.3s ease",
                  }}
               >
                  <ArrowPathRoundedSquareIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                     }}
                  />
                  Replay
                  {maxReplays > 0 && ` (${maxReplays - replaysUsed} left)`}
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
                        "linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.1))",
                     border: "1px solid rgba(250, 204, 21, 0.6)",

                     color: "var(--text)",
                     fontSize: isMobile ? "0.85rem" : "0.95rem",
                     fontWeight: 600,
                     cursor: "pointer",
                     transition: "all 0.3s ease",
                  }}
               >
                  <ShareIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  <span>Share for unlimited</span>
               </button>
            </div>
         )}

         {/* Game Complete */}
         {currentTarget >= maxTargets && (
            <div
               style={{
                  padding: isMobile ? "24px" : "32px",
                  background: "var(--card)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  textAlign: "center" as const,
                  boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
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
                     marginTop: "16px",
                  }}
               >
                  All {maxTargets} targets completed!
               </div>
            </div>
         )}
      </div>
   );
}
