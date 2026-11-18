"use client";

import { useState, useEffect, useRef } from "react";
import {
   TrophyIcon,
   CheckCircleIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import {
   FinalHead,
   ChallengeStep,
   ReplayShareBar,
   chrome as c,
   type StepState,
} from "./FinalChrome";
import { useCompleteOnce } from "./useCompleteOnce";
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


   // Check if all challenges are complete
   useEffect(() => {
      const allComplete = Object.values(puzzleState).every(
         (complete) => complete
      );
      if (allComplete) {
         onScoreUpdate(100);
         completeLater(() => onComplete(100), 1000);
      }
   }, [puzzleState, onScoreUpdate, onComplete, completeLater]);

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
      rearm();
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
      <div className={`final-game-complete final-game ${c.wrap}`}>
         <FinalHead
            title="Final Game"
            subtitle={`Complete all ${totalChallenges} challenges`}
            chips={[
               {
                  icon: CheckCircleIcon,
                  label: (
                     <>
                        {completedCount}/{totalChallenges} completed
                     </>
                  ),
               },
               { icon: TrophyIcon, label: <>Score: {score} / 100</> },
            ]}
            progress={
               totalChallenges > 0 ? (completedCount / totalChallenges) * 100 : 0
            }
         />

         <div className={c.ladder}>
            {challengeOrder.map((challengeType, index) => {
               const isUnlocked = isChallengeUnlocked(challengeType);
               const isActive = isChallengeActive(challengeType);
               const isCompleted = puzzleState[challengeType] || false;
               const previousChallenge =
                  index > 0 ? challengeOrder[index - 1] : null;
               const previousChallengeName = previousChallenge
                  ? getChallengeName(previousChallenge)
                  : "";
               const state: StepState = !isUnlocked
                  ? "locked"
                  : isCompleted
                  ? "done"
                  : isActive
                  ? "active"
                  : "waiting";

               return (
                  <ChallengeStep
                     key={challengeType}
                     index={index}
                     total={totalChallenges}
                     name={getChallengeName(challengeType)}
                     state={state}
                     lockedNote={
                        previousChallengeName
                           ? `Complete ${previousChallengeName} first`
                           : "Locked"
                     }
                     interactive={isActive}
                  >
                     {isActive ? (
                        renderMiniGame(challengeType)
                     ) : (
                        <div className={c.stepWaiting}>Click to start</div>
                     )}
                  </ChallengeStep>
               );
            })}
         </div>

         {/* Replay and Share Buttons */}
         <ReplayShareBar
            shareSuccess={shareSuccess}
            unlimitedActivated={unlimitedActivated}
            maxReplays={maxReplays}
            replaysUsed={replaysUsed}
            onReplay={handleReplay}
            onShare={handleShare}
         />
      </div>
   );
}
