"use client";

import { useState, useEffect, useRef } from "react";
import {
   TrophyIcon,
   LockClosedIcon,
   ArrowPathRoundedSquareIcon,
   ShareIcon,
   CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import FinalLogicGame from "./mini-games/FinalLogicGame";
import FinalMemoryGame from "./mini-games/FinalMemoryGame";
import FinalSpeedGame from "./mini-games/FinalSpeedGame";
import FinalSkillGame from "./mini-games/FinalSkillGame";

interface FinalGameCompleteProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
}

export default function FinalGameComplete({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
}: FinalGameCompleteProps) {
   // Challenge order: logic, memory, speed, skill
   const challengeOrder = ["logic", "memory", "speed", "skill"];

   // Initialize puzzle state
   const [puzzleState, setPuzzleState] = useState<Record<string, boolean>>(
      () => {
         const state: Record<string, boolean> = {};
         challengeOrder.forEach((key) => {
            state[key] = false;
         });
         return state;
      }
   );

   const [score, setScore] = useState(0);
   const [isMobile, setIsMobile] = useState(false);

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

   // Check if all challenges are complete
   useEffect(() => {
      const allComplete = Object.values(puzzleState).every(
         (complete) => complete
      );
      if (allComplete) {
         onScoreUpdate(100);
         setTimeout(() => onComplete(100), 1000);
      }
   }, [puzzleState, onScoreUpdate, onComplete]);

   // Check if a challenge is unlocked
   const isChallengeUnlocked = (challengeType: string): boolean => {
      const index = challengeOrder.indexOf(challengeType);
      if (index === 0) return true; // First challenge is always unlocked
      const previousChallenge = challengeOrder[index - 1];
      return puzzleState[previousChallenge] || false;
   };

   const handleChallengeComplete = (challengeType: string) => {
      setPuzzleState((prev) => ({ ...prev, [challengeType]: true }));
      const newScore = score + Math.round(100 / challengeOrder.length);
      setScore(newScore);
      onScoreUpdate(newScore);
   };

   const isChallengeActive = (challengeType: string): boolean => {
      if (!isPlaying) return false;
      // Check if this challenge is already completed - if so, it's not active
      if (puzzleState[challengeType]) return false;
      // Check if challenge is unlocked (previous challenge completed)
      if (!isChallengeUnlocked(challengeType)) return false;
      // For challenges after the first, only activate if previous is completed
      const index = challengeOrder.indexOf(challengeType);
      if (index > 0) {
         const previousChallenge = challengeOrder[index - 1];
         return puzzleState[previousChallenge] === true;
      }
      // First challenge is always active if playing and not completed
      return true;
   };

   // Get challenge name
   const getChallengeName = (challengeType: string): string => {
      const names: Record<string, string> = {
         logic: "Logic Challenge",
         memory: "Memory Challenge",
         speed: "Speed Challenge",
         skill: "Skill Challenge",
      };
      return names[challengeType] || "Challenge";
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
         await registerShare(shareId, "final-test");
         const gameKey = "play50games_shared_final-test";
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
               title: "Final Game",
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
         const gameKey = "play50games_shared_final-test";
         try {
            const status = await getShareStatus(currentShareId);
            const hasClicks = status.has_clicks || status.clicks > 0;
            if (hasClicks && !hasShared) {
               setHasShared(true);
               setUnlimitedActivated(true);
               setReplaysUsed(0);

               const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes
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
      const gameKey = "play50games_shared_final-test";
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
   const handleReplay = () => {
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      // Reset all challenges
      const resetState: Record<string, boolean> = {};
      challengeOrder.forEach((key) => {
         resetState[key] = false;
      });
      setPuzzleState(resetState);
      setScore(0);
      setReplaysUsed((prev) => prev + 1);
   };

   // Count total challenges and completed ones
   const totalChallenges = challengeOrder.length;
   const completedCount = Object.values(puzzleState).filter(Boolean).length;

   // Render mini-game component
   const renderMiniGame = (challengeType: string) => {
      // Default configs for each mini-game
      const defaultConfigs: Record<string, Record<string, any>> = {
         logic: { rounds: 5 },
         memory: { rounds: 5 },
         speed: { targets: 10 },
         skill: { targets: 10 },
      };

      const commonProps = {
         config: config[challengeType] || defaultConfigs[challengeType] || {},
         onComplete: (s: number) => {
            if (s >= 70) {
               handleChallengeComplete(challengeType);
            }
         },
         isPlaying: isPlaying && isChallengeActive(challengeType),
      };

      switch (challengeType) {
         case "logic":
            return <FinalLogicGame {...commonProps} />;
         case "memory":
            return <FinalMemoryGame {...commonProps} />;
         case "speed":
            return <FinalSpeedGame {...commonProps} />;
         case "skill":
            return <FinalSkillGame {...commonProps} />;
         default:
            return <div>Unknown challenge</div>;
      }
   };

   return (
      <div className="final-game-complete final-game">
         <h3>Final Game</h3>
         <p>
            Complete all {totalChallenges} challenges ({completedCount}/
            {totalChallenges} completed)
         </p>

         {/* Header with Score */}
         <div
            style={{
               width: "100%",
               maxWidth: "800px",
               margin: "0 auto 20px",
               background: "var(--card)",
               borderRadius: isMobile ? "16px" : "20px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               display: "flex",
               alignItems: "center",
               justifyContent: "center",
               gap: "12px",
            }}
         >
            <TrophyIcon
               style={{
                  width: isMobile ? 18 : 20,
                  height: isMobile ? 18 : 20,
                  color: "var(--ok)",
               }}
            />
            <span
               style={{
                  fontSize: isMobile ? "1rem" : "1.1rem",
                  fontWeight: 700,
                  color: "var(--text)",
               }}
            >
               Score: {score} / 100
            </span>
         </div>

         <div className="puzzle-grid">
            {challengeOrder.map((challengeType, index) => {
               const isUnlocked = isChallengeUnlocked(challengeType);
               const isActive = isChallengeActive(challengeType);
               const isCompleted = puzzleState[challengeType] || false;
               const previousChallenge =
                  index > 0 ? challengeOrder[index - 1] : null;
               const previousChallengeName = previousChallenge
                  ? getChallengeName(previousChallenge)
                  : "";

               return (
                  <div
                     key={challengeType}
                     className="puzzle-challenge"
                     style={{
                        outline: "none",
                        outlineOffset: "2px",
                        opacity: isUnlocked ? 1 : 0.5,
                        filter: isUnlocked ? "none" : "grayscale(0.8)",
                        pointerEvents: isActive ? "auto" : "none",
                        position: "relative",
                        paddingTop: index === 0 ? "0" : "100px",
                        paddingBottom: "100px",
                        marginTop: "100px",
                        marginBottom: "100px",
                        width: "100%",
                        height: !isUnlocked || isCompleted ? "500px" : "auto",
                     }}
                  >
                     {!isUnlocked && (
                        <div
                           style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              zIndex: 10,
                              background: "#0b1020",
                              color: "white",
                              padding: "12px 20px",

                              fontSize: "30px",
                              fontWeight: 700,
                              textAlign: "center",
                              height: "100%",
                              width: "100%",
                              maxWidth: "100%",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           <LockClosedIcon
                              style={{
                                 position: "absolute",
                                 top: "12px",
                                 right: "12px",
                                 width: "24px",
                                 height: "24px",
                                 color: "white",
                              }}
                           />
                           {getChallengeName(challengeType)}
                           <br />
                           <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              {previousChallengeName
                                 ? `Complete ${previousChallengeName} first`
                                 : "Locked"}
                           </span>
                        </div>
                     )}
                     <h4 style={{ textAlign: "center", margin: "0 0 20px 0" }}>
                        {getChallengeName(challengeType)} ({index + 1}/
                        {totalChallenges})
                     </h4>
                     {!isCompleted ? (
                        <div
                           style={{
                              pointerEvents: isActive ? "auto" : "none",
                           }}
                        >
                           {isActive ? (
                              renderMiniGame(challengeType)
                           ) : (
                              <div
                                 style={{
                                    padding: "20px",
                                    textAlign: "center",
                                    color: "var(--muted)",
                                 }}
                              >
                                 Click to start
                              </div>
                           )}
                        </div>
                     ) : (
                        <div
                           style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              zIndex: 10,
                              background: "rgb(34, 95, 67)",
                              color: "white",
                              padding: "12px 20px",

                              fontSize: "30px",
                              fontWeight: 700,
                              textAlign: "center",
                              height: "500px",
                              width: "100%",
                              maxWidth: "100%",
                              marginTop: "100px",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {getChallengeName(challengeType)}
                           <br />
                           <span style={{ fontSize: "0.75rem", opacity: 0.8 }}>
                              Completed
                           </span>
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Replay and Share Buttons */}
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
               margin: "20px auto 0",
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
                  Link copied! Unlimited replay will unlock when someone opens
                  your link!
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
                     marginBottom: "8px",
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
                     🎉 Someone opened your link! Unlimited replay is now active
                     for 15 minutes!
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
                        : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))",
                  border:
                     maxReplays > 0 && replaysUsed >= maxReplays
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(125, 211, 252, 0.6)",

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
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "1px solid rgba(59, 130, 246, 0.6)",

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
      </div>
   );
}
