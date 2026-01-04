"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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

interface TypingSprintProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function TypingSprint({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: TypingSprintProps) {
   const maxLevels = config?.levels ? Number(config.levels) : 15;
   const defaultLevelDuration = 30; // Fallback duration if not specified in levelRequirements
   const levelRequirements = config?.levelRequirements || null;

   // Get duration for current level
   const getLevelDuration = useCallback(
      (level: number) => {
         if (levelRequirements && levelRequirements[level]) {
            return levelRequirements[level].duration || defaultLevelDuration;
         }
         return defaultLevelDuration;
      },
      [levelRequirements, defaultLevelDuration]
   );

   const [currentLevel, setCurrentLevel] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [gameState, setGameState] = useState<
      "playing" | "ready" | "failed" | "paused"
   >("playing");
   const [requirementsMet, setRequirementsMet] = useState(false);
   const [timeLeft, setTimeLeft] = useState(() => {
      // Initialize with first level duration
      return getLevelDuration(0);
   });
   const [correctWords, setCorrectWords] = useState(0);
   const [wrongWords, setWrongWords] = useState(0);
   const [currentText, setCurrentText] = useState("");
   const [input, setInput] = useState("");
   const [wordIndex, setWordIndex] = useState(0);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   const maxReplays = hasShared ? 0 : 5;

   const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
   const levelScoreRef = useRef(0);
   const gameStateRef = useRef<"playing" | "ready" | "failed" | "paused">(
      "playing"
   );
   const prevWrongCountRef = useRef(0);
   const requirementsMetRef = useRef(false);
   const startLevelRef = useRef<() => void>(() => {});
   const startTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const prevLevelRef = useRef<number | null>(null);
   const forceStartLevelRef = useRef<number | null>(null);
   const completionCalledRef = useRef(false);
   const inputRef = useRef<HTMLInputElement>(null);

   // Responsive design
   useEffect(() => {
      const checkResponsive = () => {
         setIsMobile(window.innerWidth < 640);
         setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024);
      };
      checkResponsive();
      window.addEventListener("resize", checkResponsive);
      return () => window.removeEventListener("resize", checkResponsive);
   }, []);

   useEffect(() => {
      if (!isPlaying) return;
      prevLevelRef.current = null;
      forceStartLevelRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      completionCalledRef.current = false;
      setCurrentLevel(0);
      setCurrentScore(0);
      setRequirementsMet(false);
      setGameState("playing");
   }, [isPlaying]);

   // Default word lists for different levels (fallback if not in config)
   const getDefaultWordsForLevel = useCallback((level: number): string[] => {
      switch (level) {
         case 0: // Level 1: Simple words (3-4 letters)
            return [
               "cat",
               "dog",
               "sun",
               "moon",
               "star",
               "tree",
               "bird",
               "fish",
               "book",
               "pen",
               "cup",
               "hat",
               "car",
               "bus",
               "key",
               "door",
            ];
         case 1: // Level 2: Medium words (5-6 letters)
            return [
               "apple",
               "banana",
               "orange",
               "purple",
               "yellow",
               "green",
               "computer",
               "keyboard",
               "window",
               "garden",
               "forest",
               "ocean",
               "planet",
               "camera",
               "guitar",
               "pencil",
            ];
         case 2: // Level 3: Longer words (7-8 letters)
            return [
               "beautiful",
               "wonderful",
               "adventure",
               "mountain",
               "elephant",
               "butterfly",
               "chocolate",
               "dinosaur",
               "hospital",
               "university",
               "keyboard",
               "computer",
               "internet",
               "software",
               "hardware",
            ];
         case 3: // Level 4: Words with special characters
            return [
               "don't",
               "can't",
               "won't",
               "it's",
               "we're",
               "they're",
               "you're",
               "I'm",
               "he's",
               "she's",
               "let's",
               "that's",
            ];
         case 4: // Level 5: Sentences
            return [
               "The quick brown fox jumps over the lazy dog",
               "Practice makes perfect in everything you do",
               "Learning new skills takes time and dedication",
               "Success comes to those who never give up",
            ];
         case 5: // Level 6: Numbers
            return [
               "12345",
               "67890",
               "246813579",
               "9876543210",
               "314159265",
               "271828182",
               "1000000",
               "9999999",
            ];
         case 6: // Level 7: Mixed case
            return [
               "JavaScript",
               "TypeScript",
               "React",
               "NodeJS",
               "Python",
               "Java",
               "CSharp",
               "GoLang",
               "Swift",
               "Kotlin",
            ];
         case 7: // Level 8: No spaces (concatenated)
            return [
               "helloworld",
               "goodmorning",
               "thankyou",
               "welcomeback",
               "seeyoulater",
               "haveaniceday",
               "goodluck",
               "congratulations",
            ];
         case 8: // Level 9: Reverse typing (display reversed, type normal)
            return [
               "racecar",
               "level",
               "radar",
               "civic",
               "rotor",
               "deified",
               "repaper",
               "redder",
            ];
         case 9: // Level 10: Speed typing (very short words)
            return [
               "go",
               "hi",
               "ok",
               "no",
               "yes",
               "run",
               "fly",
               "jump",
               "fast",
               "quick",
               "rapid",
               "swift",
               "speed",
               "haste",
            ];
         case 10: // Level 11: Long sentences
            return [
               "The early bird catches the worm in the morning",
               "A picture is worth a thousand words they say",
               "Actions speak louder than words in real life",
               "Better late than never is a common saying",
            ];
         case 11: // Level 12: Special characters and symbols
            return [
               "hello@world.com",
               "user_name",
               "price$99",
               "score#1",
               "item&item",
               "test+test",
               "value=100",
               "key:value",
            ];
         case 12: // Level 13: Mixed numbers and letters
            return [
               "abc123",
               "test456",
               "user789",
               "code2024",
               "game50",
               "level15",
               "score100",
               "time60",
            ];
         case 13: // Level 14: Complex sentences
            return [
               "The quick brown fox jumps over the lazy dog in the park",
               "She sells seashells by the seashore every single day",
               "How much wood would a woodchuck chuck if he could",
               "Peter Piper picked a peck of pickled peppers today",
            ];
         case 14: // Level 15: Master challenge (very difficult)
            return [
               "Supercalifragilisticexpialidocious",
               "Pneumonoultramicroscopicsilicovolcanoconiosis",
               "The quick brown fox jumps over the lazy dog quickly",
               "JavaScript TypeScript React NodeJS Python Java CSharp",
            ];
         default:
            return ["default", "word", "list"];
      }
   }, []);

   // Word lists for different levels - reads from config or uses defaults
   const getWordsForLevel = useCallback(
      (level: number): string[] => {
         // First check if words are provided in levelRequirements
         if (
            levelRequirements &&
            levelRequirements[level] &&
            levelRequirements[level].words
         ) {
            const words = levelRequirements[level].words;
            // Support both array and comma-separated string
            if (Array.isArray(words)) {
               return words;
            } else if (typeof words === "string") {
               return words
                  .split(",")
                  .map((w) => w.trim())
                  .filter((w) => w.length > 0);
            }
         }

         // Fallback to default words
         return getDefaultWordsForLevel(level);
      },
      [levelRequirements, getDefaultWordsForLevel]
   );

   // Get minimum required words for level
   const getMinCorrectWords = useCallback(() => {
      if (levelRequirements && levelRequirements[currentLevel]) {
         return (
            levelRequirements[currentLevel].minCorrectWords || 3 + currentLevel
         );
      }
      return 3 + currentLevel;
   }, [currentLevel, levelRequirements]);

   // Generate next word for current level
   const generateNextWord = useCallback(() => {
      const words = getWordsForLevel(currentLevel);
      const randomIndex = Math.floor(Math.random() * words.length);
      const word = words[randomIndex];

      // Special handling for level 9 (reverse typing)
      if (currentLevel === 8) {
         setCurrentText(word.split("").reverse().join(""));
      } else {
         setCurrentText(word);
      }

      setInput("");
      setWordIndex((prev) => prev + 1);
      prevWrongCountRef.current = 0;

      // Focus input
      setTimeout(() => {
         inputRef.current?.focus();
      }, 100);
   }, [currentLevel, getWordsForLevel]);

   // Start level
   const startLevel = useCallback(() => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      setCorrectWords(0);
      setWrongWords(0);
      setWordIndex(0);
      levelScoreRef.current = 0;
      requirementsMetRef.current = false;
      gameStateRef.current = "playing";
      setGameState("playing");
      prevWrongCountRef.current = 0;
      setRequirementsMet(false);
      generateNextWord();

      // Start countdown
      countdownTimerRef.current = setInterval(() => {
         setTimeLeft((prev: number) => {
            if (requirementsMetRef.current) {
               return prev;
            }
            if (prev <= 1) {
               if (
                  gameStateRef.current !== "paused" &&
                  gameStateRef.current !== "ready"
               ) {
                  endLevel();
               }
               return 0;
            }
            return prev - 1;
         });
      }, 1000);
   }, [currentLevel, getLevelDuration, generateNextWord]);

   useEffect(() => {
      startLevelRef.current = startLevel;
   }, [startLevel]);

   const finalizeGame = useCallback(() => {
      if (completionCalledRef.current) return;
      completionCalledRef.current = true;

      const finalScore = 100;
      setCurrentScore(finalScore);
      setGameState("ready");
      onScoreUpdate(finalScore);

      setTimeout(() => {
         onComplete(finalScore);
      }, 1000);
   }, [onComplete, onScoreUpdate]);

   // Handle next round button click
   const handleNextRound = useCallback(() => {
      const completedLevels = currentLevel + 1;

      if (completedLevels >= maxLevels) {
         finalizeGame();
      } else {
         if (!requirementsMetRef.current) {
            const roundScore = Math.round(100 / maxLevels);
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }

         forceStartLevelRef.current = currentLevel + 1;
         setCurrentLevel((prev) => prev + 1);
         setRequirementsMet(false);
      }
   }, [currentLevel, maxLevels, onScoreUpdate, finalizeGame]);

   // Handle repeat round button click
   const handleReplay = useCallback(() => {
      if (gameState !== "playing" && gameState !== "failed") return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return;

      setRequirementsMet(false);
      requirementsMetRef.current = false;
      setGameState("playing");
      gameStateRef.current = "playing";
      setCorrectWords(0);
      setWrongWords(0);
      setWordIndex(0);
      prevWrongCountRef.current = 0;
      const levelDur = getLevelDuration(currentLevel);
      setTimeLeft(levelDur);
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      startLevel();
      setReplaysUsed((prev) => prev + 1);
   }, [
      gameState,
      maxReplays,
      replaysUsed,
      startLevel,
      currentLevel,
      getLevelDuration,
   ]);

   // Share functionality
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0];
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      return `${currentUrl}?shared=${shareId}`;
   };

   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "typing-sprint");
         const gameKey = "play50games_shared_typing-sprint";
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
               title: "Typing Sprint Game",
               text: "Check out this awesome Typing Sprint game!",
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

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_typing-sprint";
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
               }
            }
         }
      };

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Check for existing share on mount
   useEffect(() => {
      const gameKey = "play50games_shared_typing-sprint";
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
         // Only set currentShareId if this is the share we created (exists in localStorage)
         // This prevents the person opening the link from activating unlimited for themselves
         const stored = localStorage.getItem(gameKey);
         if (stored) {
            try {
               const data = JSON.parse(stored);
               if (data.share_id === sharedBy) {
                  // This is our share - set it to check for clicks
                  setCurrentShareId(sharedBy);
               }
            } catch (error) {
               // Error parsing stored data
            }
         }
      }
   }, []);

   // End level
   const endLevel = useCallback(() => {
      if (requirementsMetRef.current) {
         return;
      }
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }

      const minCorrectWords = getMinCorrectWords();
      const levelPassed = correctWords >= minCorrectWords;

      if (levelPassed && !requirementsMet) {
         handleNextRound();
      } else if (!levelPassed) {
         setGameState("failed");
      }
   }, [correctWords, requirementsMet, getMinCorrectWords, handleNextRound]);

   useEffect(() => {
      if (!isPlaying || currentLevel >= maxLevels) {
         prevLevelRef.current = null;
         if (startTimeoutRef.current) {
            clearTimeout(startTimeoutRef.current);
            startTimeoutRef.current = null;
         }
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         return;
      }

      if (prevLevelRef.current === currentLevel) {
         return;
      }

      prevLevelRef.current = currentLevel;
      const isForcedStart = forceStartLevelRef.current === currentLevel;
      if (isForcedStart) {
         forceStartLevelRef.current = null;
      }
      const delay = isForcedStart || currentLevel === 0 ? 0 : 1200;

      if (startTimeoutRef.current) {
         clearTimeout(startTimeoutRef.current);
      }

      if (delay === 0) {
         startLevelRef.current();
      } else {
         startTimeoutRef.current = setTimeout(() => {
            startLevelRef.current();
            startTimeoutRef.current = null;
         }, delay);
      }
   }, [isPlaying, currentLevel, maxLevels]);

   // Check if level requirements are met during gameplay
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet) return;

      const minCorrectWords = getMinCorrectWords();

      if (correctWords >= minCorrectWords) {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
         }
         setTimeLeft(0);

         requirementsMetRef.current = true;
         setRequirementsMet(true);
         setGameState("ready");
         setCurrentText("");

         if (currentLevel + 1 >= maxLevels) {
            finalizeGame();
         } else {
            const roundScore = Math.round(100 / maxLevels);
            const completedLevels = currentLevel + 1;
            const newScore = Math.min(100, completedLevels * roundScore);
            setCurrentScore(newScore);
            onScoreUpdate(newScore);
         }
      }
   }, [
      correctWords,
      gameState,
      requirementsMet,
      getMinCorrectWords,
      currentLevel,
      maxLevels,
      onScoreUpdate,
      finalizeGame,
   ]);

   useEffect(() => {
      requirementsMetRef.current = requirementsMet;
   }, [requirementsMet]);

   useEffect(() => {
      gameStateRef.current = gameState;
   }, [gameState]);

   // Handle input change and check for correct word
   useEffect(() => {
      if (gameState !== "playing" || requirementsMet || !currentText) return;

      // Get the actual word to compare (for level 9, we need to reverse it back)
      let wordToCompare = currentText;
      if (currentLevel === 8) {
         // Level 9: Display is reversed, but input should be normal
         wordToCompare = currentText.split("").reverse().join("");
      }

      // Count wrong characters in current input
      if (input.length > 0) {
         let wrongCount = 0;
         for (let i = 0; i < input.length && i < wordToCompare.length; i++) {
            if (input[i] !== wordToCompare[i]) {
               wrongCount++;
            }
         }
         // If input is longer than expected, count extra characters as wrong
         if (input.length > wordToCompare.length) {
            wrongCount += input.length - wordToCompare.length;
         }

         // Update wrong words based on wrong characters
         // We track the previous wrong count to only increment new wrong characters
         if (wrongCount > prevWrongCountRef.current) {
            const newWrongChars = wrongCount - prevWrongCountRef.current;
            setWrongWords((prev) => prev + newWrongChars);
            prevWrongCountRef.current = wrongCount;
         } else if (wrongCount < prevWrongCountRef.current) {
            // Input was reset or corrected, reset the counter
            prevWrongCountRef.current = wrongCount;
         }
      }

      if (input === wordToCompare) {
         setCorrectWords((prev) => prev + 1);
         setInput("");
         // Reset wrong count when word is completed
         prevWrongCountRef.current = 0;
         setTimeout(() => {
            if (
               gameStateRef.current === "playing" &&
               !requirementsMetRef.current
            ) {
               generateNextWord();
            }
         }, 300);
      }
   }, [
      input,
      currentText,
      gameState,
      requirementsMet,
      currentLevel,
      generateNextWord,
   ]);

   // Handle Enter key for manual submit (space is allowed for typing sentences)
   const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (gameState !== "playing" || requirementsMet) return;

      if (e.key === "Enter") {
         e.preventDefault();

         let wordToCompare = currentText;
         if (currentLevel === 8) {
            wordToCompare = currentText.split("").reverse().join("");
         }

         // If input matches, it will be handled by the useEffect automatically
         // If input doesn't match and user presses Enter, count as wrong
         if (input !== wordToCompare && input.length > 0) {
            setWrongWords((prev) => prev + 1);
            setInput("");
         }
      }
      // Allow space to be typed normally (don't preventDefault for space)
   };

   const progress = ((currentLevel + 1) / maxLevels) * 100;

   // Render text with character highlighting
   const renderHighlightedText = useCallback(() => {
      if (!currentText) return null;

      let displayText = currentText;
      let isReverseLevel = currentLevel === 8;

      // For reverse level: currentText is already reversed for display
      // We need to compare with the normal word
      let normalText = isReverseLevel
         ? currentText.split("").reverse().join("")
         : currentText;

      return displayText.split("").map((char, index) => {
         let status: "correct" | "wrong" | "pending" = "pending";

         if (input && input.length > 0) {
            if (isReverseLevel) {
               // For reverse level: display is reversed, input is normal
               // Map display position to input position
               const inputIndex = displayText.length - 1 - index;
               if (
                  inputIndex >= 0 &&
                  inputIndex < input.length &&
                  inputIndex < normalText.length
               ) {
                  status =
                     input[inputIndex] === normalText[inputIndex]
                        ? "correct"
                        : "wrong";
               } else if (inputIndex < input.length) {
                  status = "wrong";
               }
            } else {
               // Normal level: compare directly
               if (index < input.length && index < normalText.length) {
                  status =
                     input[index] === normalText[index] ? "correct" : "wrong";
               } else if (index < input.length) {
                  status = "wrong";
               }
            }
         }

         let color = "var(--text)";
         let backgroundColor = "transparent";

         if (status === "correct") {
            color = "var(--ok)";
            backgroundColor = "rgba(134, 239, 172, 0.2)";
         } else if (status === "wrong") {
            color = "var(--warn)";
            backgroundColor = "rgba(252, 165, 165, 0.2)";
         }

         return (
            <span
               key={index}
               style={{
                  color: color,
                  backgroundColor: backgroundColor,
                  padding: "2px 1px",
                  borderRadius: "3px",
                  transition: "all 0.2s ease",
               }}
            >
               {char === " " ? "\u00A0" : char}
            </span>
         );
      });
   }, [currentText, input, currentLevel]);

   // Get level description
   const getLevelDescription = (level: number): string => {
      const descriptions = [
         "Simple Words (3-4 letters)",
         "Medium Words (5-6 letters)",
         "Longer Words (7-8 letters)",
         "Words with Special Characters",
         "Sentences",
         "Numbers",
         "Mixed Case",
         "No Spaces (Concatenated)",
         "Reverse Typing",
         "Speed Typing (Short words)",
         "Long Sentences",
         "Special Characters & Symbols",
         "Mixed Numbers & Letters",
         "Complex Sentences",
         "Master Challenge (Very Difficult)",
      ];
      return descriptions[level] || "Typing Challenge";
   };

   return (
      <>
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               justifyContent: "center",
               minHeight: "100%",
               width: "100%",
               padding: isMobile ? "12px" : "20px",
               gap: isMobile ? "16px" : "24px",
            }}
         >
            {/* Header Section */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  background: "var(--card)",
                  border: "1px solid var(--stroke)",
                  borderRadius: isMobile ? "14px" : "16px",
                  padding: isMobile ? "16px" : "20px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               <div
                  style={{
                     display: "flex",
                     justifyContent: "space-between",
                     alignItems: "center",
                     fontSize: isMobile ? "0.75rem" : "0.875rem",
                     color: "var(--muted)",
                     fontWeight: 500,
                     marginBottom: isMobile ? "10px" : "12px",
                     flexWrap: isMobile ? "wrap" : "nowrap",
                     gap: isMobile ? "8px" : "0",
                  }}
               >
                  <span
                     style={{
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
                     Level {currentLevel + 1} / {maxLevels}
                  </span>
                  <span
                     style={{
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
                     Score:{" "}
                     {currentLevel + 1 >= maxLevels && gameState === "ready"
                        ? 100
                        : currentScore}{" "}
                     / 100
                  </span>
                  <span
                     style={{
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
                     Time: {timeLeft}s
                  </span>
               </div>
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
                        boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                     }}
                  />
               </div>
            </div>

            {/* Game Board */}
            <div
               style={{
                  width: "100%",
                  maxWidth: "800px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: isMobile ? "16px" : "24px",
               }}
            >
               {/* Stats */}
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "12px" : "16px",
                     width: "100%",
                     justifyContent: "center",
                     flexWrap: "wrap",
                  }}
               >
                  <div
                     style={{
                        padding: isMobile ? "8px 12px" : "10px 16px",
                        background:
                           "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                        border: "2px solid rgba(134, 239, 172, 0.6)",
                        borderRadius: "12px",
                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Correct: {correctWords} / {getMinCorrectWords()}
                  </div>
                  <div
                     style={{
                        padding: isMobile ? "8px 12px" : "10px 16px",
                        background:
                           "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.12))",
                        border: "2px solid rgba(252, 165, 165, 0.6)",
                        borderRadius: "12px",
                        color: "var(--text)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        fontWeight: 600,
                     }}
                  >
                     Wrong: {wrongWords}
                  </div>
               </div>

               {/* Level Description */}
               <div
                  style={{
                     padding: isMobile ? "8px 12px" : "10px 16px",
                     background: "var(--card)",
                     border: "1px solid var(--stroke)",
                     borderRadius: "12px",
                     color: "var(--text)",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     textAlign: "center",
                  }}
               >
                  {getLevelDescription(currentLevel)}
               </div>

               {/* Typing Area */}
               {gameState === "playing" && currentText && (
                  <div
                     style={{
                        width: "100%",
                        maxWidth: "600px",
                        padding: isMobile ? "24px" : "32px",
                        background: "var(--card)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "var(--radius)",
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.2)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "24px",
                     }}
                  >
                     <div
                        style={{
                           fontSize: isMobile ? "1.5rem" : "2rem",
                           fontWeight: 800,
                           textAlign: "center",
                           wordBreak: "break-word",
                           minHeight: isMobile ? "60px" : "80px",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           flexWrap: "wrap",
                           lineHeight: "1.5",
                        }}
                     >
                        {renderHighlightedText()}
                     </div>
                     <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={gameState !== "playing" || requirementsMet}
                        style={{
                           width: "100%",
                           padding: isMobile ? "16px" : "20px",
                           fontSize: isMobile ? "1.2rem" : "1.5rem",
                           fontWeight: 600,
                           background: "var(--background)",
                           border: "2px solid var(--stroke)",
                           borderRadius: "12px",
                           color: "var(--text)",
                           textAlign: "center",
                           outline: "none",
                        }}
                        autoFocus
                        placeholder="Type here..."
                     />
                     <p
                        style={{
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           color: "var(--muted)",
                           textAlign: "center",
                        }}
                     >
                        Type the text above. It will auto-submit when correct,
                        or press Enter to reset if wrong.
                     </p>
                  </div>
               )}

               {/* Ready for Next Round Message */}
               {gameState === "ready" && currentLevel + 1 < maxLevels && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--stroke)",
                        width: "100%",
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
                        <CheckCircleIcon style={{ width: 20, height: 20 }} />
                        Level {currentLevel + 1} Complete
                     </div>
                     <div
                        style={{
                           fontSize: isMobile ? "1.05rem" : "1.1rem",
                           fontWeight: 600,
                           marginBottom: "20px",
                           marginTop: "16px",
                        }}
                     >
                        Are you ready for next round?
                     </div>
                     <button
                        onClick={handleNextRound}
                        style={{
                           padding: isMobile ? "12px 24px" : "14px 28px",
                           background:
                              "linear-gradient(135deg, rgba(134, 239, 172, 0.25), rgba(134, 239, 172, 0.12))",
                           border: "2px solid rgba(134, 239, 172, 0.6)",
                           borderRadius: "12px",
                           color: "var(--text)",
                           fontSize: isMobile ? "1rem" : "1.05rem",
                           fontWeight: 700,
                           cursor: "pointer",
                           transition: "all 0.3s ease",
                        }}
                     >
                        Next Round
                     </button>
                  </div>
               )}

               {/* Game Complete Message */}
               {gameState === "ready" && currentLevel + 1 >= maxLevels && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--stroke)",
                        width: "100%",
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
                           marginBottom: "20px",
                        }}
                     >
                        All {maxLevels} levels completed!
                     </div>
                  </div>
               )}

               {/* Level Failed Message */}
               {gameState === "failed" && (
                  <div
                     style={{
                        padding: isMobile ? "20px 24px" : "24px 32px",
                        background: "var(--card)",
                        borderRadius: "var(--radius)",
                        color: "var(--text)",
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 700,
                        textAlign: "center" as const,
                        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.25)",
                        border: "1px solid var(--stroke)",
                        width: "100%",
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
                              "linear-gradient(135deg, rgba(252, 165, 165, 0.25), rgba(252, 165, 165, 0.1))",
                           border: "2px solid rgba(252, 165, 165, 0.6)",
                           color: "var(--text)",
                           marginBottom: "16px",
                        }}
                     >
                        <XCircleIcon style={{ width: 20, height: 20 }} />
                        Level {currentLevel + 1} Failed
                     </div>
                     <div
                        style={{
                           marginTop: "12px",
                           fontSize: isMobile ? "0.95rem" : "1.05rem",
                           fontWeight: 600,
                           color: "var(--text)",
                           marginBottom: "18px",
                        }}
                     >
                        Need: {getMinCorrectWords()} correct words
                     </div>
                  </div>
               )}

               {/* Action Buttons: Replay, Share */}
               {(gameState === "playing" || gameState === "failed") && (
                  <div
                     style={{
                        display: "flex",
                        gap: "12px",
                        justifyContent: "center",
                        flexWrap: "wrap",
                        padding: isMobile ? "12px" : "16px",
                        background: "var(--card)",
                        border: "1px solid var(--stroke)",
                        borderRadius: "12px",
                        width: "100%",
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
                           Link copied! Unlimited replay will unlock when
                           someone opens your link!
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
                              🎉 Someone opened your link! Unlimited replay is
                              now active for 15 minutes!
                           </span>
                        </div>
                     )}

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
                           borderRadius: "12px",
                           color: "var(--text)",
                           fontSize: isMobile ? "0.85rem" : "0.95rem",
                           fontWeight: 600,
                           cursor:
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? "not-allowed"
                                 : "pointer",
                           opacity:
                              maxReplays > 0 && replaysUsed >= maxReplays
                                 ? 0.5
                                 : 1,
                           transition: "all 0.3s ease",
                        }}
                     >
                        <ArrowPathRoundedSquareIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color:
                                 maxReplays > 0 && replaysUsed >= maxReplays
                                    ? "var(--muted)"
                                    : "var(--accent)",
                           }}
                        />
                        <span>
                           {isMobile ? "" : "Replay "}
                           {maxReplays === 0
                              ? "(∞)"
                              : `(${maxReplays - replaysUsed}/${maxReplays})`}
                        </span>
                     </button>

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
                     >
                        <ShareIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                           }}
                        />
                        <span>
                           {isMobile ? "Share" : "Share for unlimited"}
                        </span>
                     </button>
                  </div>
               )}
            </div>
         </div>
      </>
   );
}
