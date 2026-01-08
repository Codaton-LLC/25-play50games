"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   HandThumbUpIcon,
   PuzzlePieceIcon,
   GlobeAmericasIcon,
   FunnelIcon,
   CakeIcon,
   LockClosedIcon,
   ChevronDoubleRightIcon,
   ArrowUturnLeftIcon,
   BuildingOffice2Icon,
   HomeIcon,
   StarIcon,
   HeartIcon,
   CameraIcon,
   EyeIcon,
   KeyIcon,
   FingerPrintIcon,
   BellIcon,
   MoonIcon,
   GiftIcon,
   PlusIcon,
   CubeIcon,
   FireIcon,
   BoltIcon,
   SparklesIcon,
   TrophyIcon,
   ShieldCheckIcon,
   FlagIcon,
   BookmarkIcon,
   TagIcon,
   WrenchScrewdriverIcon,
   ScissorsIcon,
   PaintBrushIcon,
   MusicalNoteIcon,
   MicrophoneIcon,
   VideoCameraIcon,
   PhotoIcon,
   FilmIcon,
   DocumentIcon,
   FolderIcon,
   PaperClipIcon,
   MagnifyingGlassIcon,
   AdjustmentsHorizontalIcon,
   Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";

function CardFlipMemory({
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
   const maxRounds = config.rounds || 5;
   // Grid sizes: round 1=2x2, 2=4x4, 3=6x6, 4=7x6, 5=8x8
   // Format: [width, height] or number (for square grids)
   const gridSizes = config.gridSizes || [
      [2, 2], // Round 1: 2x2
      [4, 4], // Round 2: 4x4
      [6, 6], // Round 3: 6x6
      [7, 6], // Round 4: 7x6
      [8, 8], // Round 5: 8x8
   ];

   const [currentRound, setCurrentRound] = useState(1);
   const [currentScore, setCurrentScore] = useState(0);
   const [gridWidth, setGridWidth] = useState(2);
   const [gridHeight, setGridHeight] = useState(2);
   const [cards, setCards] = useState<
      Array<{
         id: number;
         value: number | string;
         flipped: boolean;
         matched: boolean;
         icon?: string;
      }>
   >([]);
   const [flippedCards, setFlippedCards] = useState<number[]>([]);
   const [matches, setMatches] = useState(0);
   const [moves, setMoves] = useState(0);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [completionCalled, setCompletionCalled] = useState(false);
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [hintPair, setHintPair] = useState<[number, number] | null>(null);

   // Heroicons for rounds 2-5
   // Round 2: 4x4 = 8 pairs (8 icons), Round 3: 6x6 = 18 pairs (18 icons),
   // Round 4: 7x6 = 21 pairs (21 icons), Round 5: 8x8 = 32 pairs (32 icons)
   // Need at least 32 unique icons
   const heroicons = useMemo(
      () => [
         "HandThumbUp",
         "PuzzlePiece",
         "GlobeAmericas",
         "LightBulb",
         "Funnel",
         "Cake",
         "LockClosed",
         "ChevronDoubleRight",
         "ArrowUturnLeft",
         "BuildingOffice2",
         "Home",
         "Star",
         "Heart",
         "Camera",
         "Eye",
         "Key",
         "Fingerprint",
         "Bell",
         "Moon",
         "Gift",
         "Plus",
         "Cube",
         "Fire",
         "Bolt",
         "Sparkles",
         "Trophy",
         "ShieldCheck",
         "Flag",
         "Bookmark",
         "Tag",
         "WrenchScrewdriver",
         "Scissors",
         "PaintBrush",
         "MusicalNote",
         "Microphone",
         "VideoCamera",
         "Photo",
         "Film",
         "Document",
         "Folder",
         "PaperClip",
         "MagnifyingGlass",
         "AdjustmentsHorizontal",
         "Cog6Tooth",
      ],
      []
   );

   // Get grid size for current round
   const getGridSizeForRound = (round: number): [number, number] => {
      const index = Math.min(round - 1, gridSizes.length - 1);
      const size = gridSizes[index];
      if (Array.isArray(size)) {
         return [size[0], size[1]];
      }
      return [size, size]; // Square grid
   };

   // Get icon component by name
   const getIconComponent = (iconName: string, size: number = 40) => {
      const iconMap: Record<string, React.ComponentType<any>> = {
         HandThumbUp: HandThumbUpIcon,
         PuzzlePiece: PuzzlePieceIcon,
         GlobeAmericas: GlobeAmericasIcon,
         LightBulb: LightBulbIcon,
         Funnel: FunnelIcon,
         Cake: CakeIcon,
         LockClosed: LockClosedIcon,
         ChevronDoubleRight: ChevronDoubleRightIcon,
         ArrowUturnLeft: ArrowUturnLeftIcon,
         BuildingOffice2: BuildingOffice2Icon,
         Home: HomeIcon,
         Star: StarIcon,
         Heart: HeartIcon,
         Camera: CameraIcon,
         Eye: EyeIcon,
         Key: KeyIcon,
         Fingerprint: FingerPrintIcon,
         Bell: BellIcon,
         Moon: MoonIcon,
         Gift: GiftIcon,
         Plus: PlusIcon,
         Cube: CubeIcon,
         Fire: FireIcon,
         Bolt: BoltIcon,
         Sparkles: SparklesIcon,
         Trophy: TrophyIcon,
         ShieldCheck: ShieldCheckIcon,
         Flag: FlagIcon,
         Bookmark: BookmarkIcon,
         Tag: TagIcon,
         WrenchScrewdriver: WrenchScrewdriverIcon,
         Scissors: ScissorsIcon,
         PaintBrush: PaintBrushIcon,
         MusicalNote: MusicalNoteIcon,
         Microphone: MicrophoneIcon,
         VideoCamera: VideoCameraIcon,
         Photo: PhotoIcon,
         Film: FilmIcon,
         Document: DocumentIcon,
         Folder: FolderIcon,
         PaperClip: PaperClipIcon,
         MagnifyingGlass: MagnifyingGlassIcon,
         AdjustmentsHorizontal: AdjustmentsHorizontalIcon,
         Cog6Tooth: Cog6ToothIcon,
      };
      const IconComponent = iconMap[iconName];
      if (!IconComponent) return null;
      return (
         <IconComponent
            style={{ width: size, height: size, color: "var(--accent)" }}
         />
      );
   };

   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Check if user has shared or came from shared link (individual per game, 15 min expiry)
   useEffect(() => {
      const gameKey = "play50games_shared_card-flip";
      const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds

      // Check if came from shared link (has tracking parameter)
      // Note: Tracking is done in GameEngine.tsx immediately on page load
      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         // Grant unlimited hints to the person who opened the link (with expiry)
         const expiryTime = Date.now() + EXPIRY_TIME;
         localStorage.setItem(
            gameKey,
            JSON.stringify({ shared: true, expiry: expiryTime })
         );
         setHasShared(true);

         // Remove tracking parameter from URL (clean URL)
         const newUrl =
            window.location.pathname +
            window.location.search
               .replace(/[?&]shared=[^&]*/, "")
               .replace(/^\?/, "");
         window.history.replaceState(
            {},
            "",
            newUrl || window.location.pathname
         );
      } else {
         // Check if user has shared before (with expiry check)
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() < parsed.expiry) {
                  // Still valid
                  setHasShared(true);
                  // Check if we have a share_id to monitor
                  if (parsed.share_id) {
                     setCurrentShareId(parsed.share_id);
                  }
               } else {
                  // Expired - remove it
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      }

      // Cleanup interval on unmount
      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Periodically check if share has clicks (every 5 seconds)
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         const gameKey = "play50games_shared_card-flip";
         try {
            const status = await getShareStatus(currentShareId);
            if (status.has_clicks && !hasShared) {
               // Share has clicks - activate unlimited hints with expiry
               const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes
               const expiryTime = Date.now() + EXPIRY_TIME;
               localStorage.setItem(
                  gameKey,
                  JSON.stringify({
                     shared: true,
                     expiry: expiryTime,
                     share_id: currentShareId,
                  })
               );
               setHasShared(true);

               // Show success message that unlimited hints are now active
               setUnlimitedActivated(true);
               setTimeout(() => {
                  setUnlimitedActivated(false);
               }, 10000); // Show for 10 seconds

               // Stop checking once activated
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
                  shareCheckIntervalRef.current = null;
               }
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
               localStorage.removeItem(gameKey);
               if (shareCheckIntervalRef.current) {
                  clearInterval(shareCheckIntervalRef.current);
               }
               setCurrentShareId(null);
               setHasShared(false);
               setUnlimitedActivated(false);
            }
         }
      };

      // Check immediately, then every 10 seconds (heartbeat)
      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000); // 10 seconds heartbeat

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Periodically check if expiry has passed and reset hints to normal
   useEffect(() => {
      const gameKey = "play50games_shared_card-flip";
      const checkExpiry = () => {
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() >= parsed.expiry) {
                  // Expired - remove it and reset hints to normal
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               // Invalid data - remove it
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      };

      // Check immediately and then every minute
      checkExpiry();
      const expiryCheckInterval = setInterval(checkExpiry, 60 * 1000); // Check every minute

      return () => {
         clearInterval(expiryCheckInterval);
      };
   }, [hasShared]);

   // Initialize cards for current round
   useEffect(() => {
      const [width, height] = getGridSizeForRound(currentRound);
      setGridWidth(width);
      setGridHeight(height);
      const totalCells = width * height;
      const pairs = totalCells / 2;
      initializeCards(width, height, pairs, currentRound);
      setCompletionCalled(false);
      setHintsUsed(0);
      setShowHint(false);
      setHintPair(null);
   }, [currentRound, heroicons]);

   const initializeCards = (
      width: number,
      height: number,
      pairs: number,
      round: number
   ) => {
      let cardValues: Array<number | string> = [];

      if (round === 1) {
         // Round 1: Use numbers
         for (let i = 1; i <= pairs; i++) {
            cardValues.push(i, i); // Each pair appears twice
         }
      } else {
         // Rounds 2-5: Use heroicons
         // Select random heroicons for this round
         const shuffledIcons = [...heroicons].sort(() => Math.random() - 0.5);
         const selectedIcons = shuffledIcons.slice(0, pairs);

         // Each icon appears twice
         for (const icon of selectedIcons) {
            cardValues.push(icon, icon);
         }
      }

      // Shuffle
      for (let i = cardValues.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
      }

      const newCards = cardValues.map((value, index) => ({
         id: index,
         value,
         flipped: false,
         matched: false,
         icon: typeof value === "string" ? value : undefined,
      }));

      setCards(newCards);
      setMatches(0);
      setMoves(0);
      setFlippedCards([]);
      setFeedback(null);
   };

   // Check if round is complete
   useEffect(() => {
      const totalCells = gridWidth * gridHeight;
      const pairs = totalCells / 2;
      if (matches === pairs && pairs > 0 && !completionCalled) {
         setCompletionCalled(true);

         // Calculate round score: 20 points per round (5 rounds = 100 max)
         const roundScore = 20;
         const newScore = currentScore + roundScore;
         setCurrentScore(newScore);
         setFeedback("correct");

         onScoreUpdate(newScore);

         setTimeout(() => {
            setFeedback(null);
            if (currentRound >= maxRounds) {
               // Game complete
               onComplete(newScore);
            } else {
               // Next round
               setCurrentRound(currentRound + 1);
            }
         }, 1500);
      }
   }, [
      matches,
      gridWidth,
      gridHeight,
      currentRound,
      maxRounds,
      currentScore,
      completionCalled,
      onScoreUpdate,
      onComplete,
   ]);

   const handleCardClick = (cardId: number) => {
      const card = cards[cardId];
      if (
         card.flipped ||
         card.matched ||
         flippedCards.length >= 2 ||
         completionCalled
      )
         return;

      const newCards = [...cards];
      newCards[cardId].flipped = true;
      setCards(newCards);

      const newFlipped = [...flippedCards, cardId];
      setFlippedCards(newFlipped);

      if (newFlipped.length === 2) {
         setMoves(moves + 1);
         const [firstId, secondId] = newFlipped;
         const firstCard = newCards[firstId];
         const secondCard = newCards[secondId];

         if (firstCard.value === secondCard.value) {
            // Match!
            newCards[firstId].matched = true;
            newCards[secondId].matched = true;
            setCards(newCards);
            setMatches(matches + 1);
            setFlippedCards([]);
         } else {
            // No match, flip back (no error message, just close cards)
            setTimeout(() => {
               const resetCards = [...newCards];
               resetCards[firstId].flipped = false;
               resetCards[secondId].flipped = false;
               setCards(resetCards);
               setFlippedCards([]);
            }, 1000);
         }
      }
   };

   const totalCards = gridWidth * gridHeight;
   const pairs = totalCards / 2;
   const progress = (currentRound / maxRounds) * 100;

   // Max hints: 10 for Card Flip Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Generate shareable link with tracking
   const getShareableLink = (): string => {
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareId =
         Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Unique share ID
      return `${currentUrl}?shared=${shareId}`;
   };

   // Register share link in backend (but don't activate hints yet)
   const registerShareLink = async (shareId: string) => {
      try {
         await registerShare(shareId, "card-flip");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_card-flip";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
   };

   // Handle share via Web Share API or fallback
   const handleShare = async () => {
      const shareableLink = getShareableLink();
      const shareId = new URL(shareableLink).searchParams.get("shared") || "";

      if (!shareId) return;

      // Register share link in backend (but don't activate hints yet)
      await registerShareLink(shareId);

      // Try Web Share API first (mobile/desktop)
      if (navigator.share) {
         try {
            await navigator.share({
               title: "Card Flip Memory Game",
               text: "Check out this awesome Card Flip Memory game!",
               url: shareableLink,
            });
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (error: any) {
            // User cancelled or error - try copy to clipboard
            if (error.name !== "AbortError") {
               handleCopyLink(shareId);
            }
         }
      } else {
         // Fallback: copy to clipboard
         handleCopyLink(shareId);
      }
   };

   // Handle copy link to clipboard
   const handleCopyLink = async (shareId: string) => {
      // Use the provided shareId instead of generating a new one
      const currentUrl = window.location.href.split("?")[0]; // Remove existing params
      const shareableLink = `${currentUrl}?shared=${shareId}`;

      try {
         await navigator.clipboard.writeText(shareableLink);
         // Success - show message (hints will activate when someone clicks the link)
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
      } catch (error) {
         // Fallback for older browsers
         const textArea = document.createElement("textarea");
         textArea.value = shareableLink;
         textArea.style.position = "fixed";
         textArea.style.opacity = "0";
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand("copy");
            // Success - show message (hints will activate when someone clicks the link)
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } catch (err) {}
         document.body.removeChild(textArea);
      }
   };

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return; // No hints left

      // Find an unmatched pair
      const unmatchedPairs: Array<[number, number]> = [];
      const valueMap = new Map<number | string, number[]>();

      cards.forEach((card, index) => {
         if (!card.matched) {
            if (!valueMap.has(card.value)) {
               valueMap.set(card.value, []);
            }
            valueMap.get(card.value)!.push(index);
         }
      });

      // Find pairs
      valueMap.forEach((indices) => {
         if (indices.length >= 2) {
            unmatchedPairs.push([indices[0], indices[1]]);
         }
      });

      if (unmatchedPairs.length > 0) {
         const randomPair =
            unmatchedPairs[Math.floor(Math.random() * unmatchedPairs.length)];
         setHintPair(randomPair);
         setShowHint(true);
         setHintsUsed(hintsUsed + 1);

         // Hide hint after 2 seconds
         setTimeout(() => {
            setShowHint(false);
            setHintPair(null);
         }, 2000);
      }
   };

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            padding: "24px",
            maxWidth: "1200px",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               borderRadius: "16px",
               padding: "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            {/* Share Section */}
            <div
               style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginBottom: "16px",
                  alignItems: "center",
               }}
            >
               {shareSuccess && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                        border: "2px solid rgba(34, 197, 94, 0.6)",
                        borderRadius: "8px",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        animation: "slideIn 0.3s ease",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "rgba(34, 197, 94, 0.9)",
                        }}
                     />
                     <span>
                        Link copied! Unlimited hints will unlock when someone
                        opens your link!
                     </span>
                  </div>
               )}
               {unlimitedActivated && (
                  <div
                     style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 16px",
                        background:
                           "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                        border: "2px solid rgba(59, 130, 246, 0.6)",
                        borderRadius: "8px",
                        color: "var(--text)",
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        animation: "slideIn 0.3s ease",
                     }}
                  >
                     <CheckCircleIcon
                        style={{
                           width: 18,
                           height: 18,
                           color: "rgba(59, 130, 246, 0.9)",
                        }}
                     />
                     <span>
                        🎉 Someone opened your link! Unlimited hints are now
                        active for 15 minutes!
                     </span>
                  </div>
               )}
               <button
                  onClick={handleShare}
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: "8px",
                     padding: "10px 20px",
                     background:
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                     border: "2px solid rgba(59, 130, 246, 0.6)",

                     color: "var(--text)",
                     fontSize: "0.95rem",
                     fontWeight: 600,
                     cursor: "pointer",
                     transition: "all 0.3s ease",
                  }}
                  onMouseEnter={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(59, 130, 246, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }}
               >
                  <ShareIcon
                     style={{
                        width: 20,
                        height: 20,
                        color: "rgba(59, 130, 246, 0.9)",
                     }}
                  />
                  <span>Share for Unlimited Replay</span>
               </button>
            </div>
            <div
               style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "var(--muted)",
                  fontWeight: 500,
                  marginBottom: "12px",
                  flexWrap: "wrap",
                  gap: "12px",
               }}
            >
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                     />
                  </svg>
                  Round {currentRound} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--ok)" }}
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                     />
                  </svg>
                  Score: {currentScore} / {maxRounds * 20}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <svg
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                     fill="none"
                     viewBox="0 0 24 24"
                     stroke="currentColor"
                  >
                     <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                     />
                  </svg>
                  Grid: {gridWidth}x{gridHeight} | Matches: {matches}/{pairs} |
                  Moves: {moves}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <LightBulbIcon
                     style={{ width: 16, height: 16, color: "var(--accent)" }}
                  />
                  Hints:{" "}
                  {maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
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
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: "24px",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={maxHints > 0 && hintsUsed >= maxHints}
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 24px",
                  background:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.05)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `2px solid ${
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,

                  color: "var(--text)",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.3s ease",
                  opacity: maxHints > 0 && hintsUsed >= maxHints ? 0.5 : 1,
               }}
               onMouseEnter={(e) => {
                  if (!(maxHints > 0 && hintsUsed >= maxHints)) {
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
                  if (!(maxHints > 0 && hintsUsed >= maxHints)) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(251, 191, 36, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
               }}
            >
               <LightBulbIcon
                  style={{
                     width: 20,
                     height: 20,
                     color: "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0
                     ? "(Unlimited)"
                     : `(${maxHints - hintsUsed} left)`}
               </span>
            </button>

            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
                  gap: "5px",
                  width: "100%",
                  padding: "20px",
                  background: "var(--card)",
                  borderRadius: "20px",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
               }}
            >
               {cards.slice(0, totalCards).map((card) => {
                  const maxSize = Math.max(gridWidth, gridHeight);
                  const isNumber = typeof card.value === "number";
                  return (
                     <button
                        key={card.id}
                        onClick={() => handleCardClick(card.id)}
                        disabled={
                           card.flipped ||
                           card.matched ||
                           flippedCards.length >= 2 ||
                           completionCalled
                        }
                        style={{
                           width: "100%",
                           aspectRatio: "1",

                           border:
                              showHint &&
                              hintPair &&
                              (card.id === hintPair[0] ||
                                 card.id === hintPair[1])
                                 ? "3px solid rgba(251, 191, 36, 0.8)"
                                 : "2px solid var(--stroke)",
                           background: card.matched
                              ? "rgba(134, 239, 172, 0.3)"
                              : showHint &&
                                hintPair &&
                                (card.id === hintPair[0] ||
                                   card.id === hintPair[1])
                              ? "rgba(251, 191, 36, 0.2)"
                              : card.flipped
                              ? "rgba(125, 211, 252, 0.2)"
                              : "rgba(15, 27, 51, 0.6)",
                           color: "var(--text)",
                           fontSize: isNumber
                              ? maxSize <= 4
                                 ? "2rem"
                                 : maxSize <= 6
                                 ? "1.5rem"
                                 : "1.25rem"
                              : undefined,
                           fontWeight: 700,
                           cursor:
                              card.flipped ||
                              card.matched ||
                              flippedCards.length >= 2 ||
                              completionCalled
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.3s ease",
                           transform:
                              card.flipped || card.matched
                                 ? "scale(1)"
                                 : "scale(1)",
                           boxShadow:
                              showHint &&
                              hintPair &&
                              (card.id === hintPair[0] ||
                                 card.id === hintPair[1])
                                 ? "0 0 20px rgba(251, 191, 36, 0.6)"
                                 : card.matched
                                 ? "0 0 20px rgba(134, 239, 172, 0.5)"
                                 : card.flipped
                                 ? "0 0 15px rgba(125, 211, 252, 0.3)"
                                 : "0 4px 8px rgba(0, 0, 0, 0.2)",
                           position: "relative",
                           overflow: "hidden",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                        }}
                     >
                        {card.flipped || card.matched ? (
                           isNumber ? (
                              <span>{card.value}</span>
                           ) : (
                              getIconComponent(
                                 card.value as string,
                                 maxSize <= 4 ? 50 : maxSize <= 6 ? 40 : 35
                              )
                           )
                        ) : (
                           <span
                              style={{
                                 opacity: 0.6,
                                 fontSize:
                                    maxSize <= 4
                                       ? "2rem"
                                       : maxSize <= 6
                                       ? "1.5rem"
                                       : "1.25rem",
                              }}
                           >
                              ?
                           </span>
                        )}
                        {card.matched && (
                           <CheckCircleIcon
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: "20px",
                                 height: "20px",
                                 color: "var(--ok)",
                              }}
                           />
                        )}
                     </button>
                  );
               })}
            </div>

            {/* Feedback Message */}
            {feedback && (
               <div
                  style={{
                     padding: "16px 24px",

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
                     color:
                        feedback === "correct" ? "var(--ok)" : "var(--warn)",
                     display: "flex",
                     alignItems: "center",
                     gap: "10px",
                     width: "100%",
                     maxWidth: "600px",
                     justifyContent: "center",
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
         </div>
      </div>
   );
}

export default CardFlipMemory;
