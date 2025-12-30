"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
   CheckCircleIcon,
   XCircleIcon,
   LightBulbIcon,
   ShareIcon,
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import {
   registerShare,
   trackShareClick,
   getShareStatus,
} from "@/lib/api/share";
import {
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

interface MemoryGamesProps {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
   isPlaying: boolean;
   passingScore?: number;
}

export default function MemoryGames({
   config,
   onScoreUpdate,
   onComplete,
   isPlaying,
   passingScore = 70,
}: MemoryGamesProps) {
   const [currentGame, setCurrentGame] = useState<string>("");

   useEffect(() => {
      if (!isPlaying) return;

      // Get gameType from config
      // config should already contain gameType from gameConfig that was passed from GameEngine
      const gameType = config.gameType || "";

      // Debug: Log config to see what we're receiving
      if (!gameType) {
         console.warn("MemoryGames: No gameType found in config:", config);
      }

      if (gameType) {
         setCurrentGame(gameType);
      } else {
         // If no gameType found, default to card-flip for backward compatibility
         console.warn(
            "MemoryGames: Defaulting to card-flip because gameType is missing"
         );
         setCurrentGame("card-flip");
      }
   }, [isPlaying, config]);

   const gameComponents: Record<string, JSX.Element> = {
      "card-flip": (
         <CardFlipMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "sound-memory": (
         <SoundMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "emoji-memory": (
         <EmojiMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "number-recall": (
         <NumberRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "image-recall": (
         <ImageRecall
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
            passingScore={passingScore}
         />
      ),
      "path-memory": (
         <PathMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "word-memory": (
         <WordMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "face-memory": (
         <FaceMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "color-grid-memory": (
         <ColorGridMemory
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
      "symbol-stack": (
         <SymbolStack
            config={config}
            onScoreUpdate={onScoreUpdate}
            onComplete={onComplete}
         />
      ),
   };

   return (
      gameComponents[currentGame] || (
         <div>Memory game "{currentGame}" not found.</div>
      )
   );
}

// Card Flip Memory Game
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
         try {
            const status = await getShareStatus(currentShareId);
            if (status.has_clicks && !hasShared) {
               // Share has clicks - activate unlimited hints with expiry
               const gameKey = "play50games_shared_card-flip";
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
         } catch (error) {}
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
               border: "1px solid var(--stroke)",
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
                     borderRadius: "12px",
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
                  borderRadius: "12px",
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
                  border: "1px solid var(--stroke)",
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
                           borderRadius: "12px",
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

// Sound Memory Game (17) - Modern version with 10 levels
function SoundMemory({
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
   const maxRounds = config.rounds || 10;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<number[]>([]);
   const [playerSequence, setPlayerSequence] = useState<number[]>([]);
   const [isPlayingSequence, setIsPlayingSequence] = useState(false);
   const [isAcceptingInput, setIsAcceptingInput] = useState(false);
   const [gameState, setGameState] = useState<
      "tutorial" | "playing" | "listening" | "input" | "correct" | "wrong"
   >("tutorial");
   const [activePad, setActivePad] = useState<number | null>(null);
   const audioContextRef = useRef<AudioContext | null>(null);
   const sequenceRef = useRef<number[]>([]);
   const roundRef = useRef(0);
   const inputLockRef = useRef(false);
   const resolvedRoundRef = useRef<number | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Replay and Share functionality
   const [replaysUsed, setReplaysUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max replays: 5 for Sound Memory, unlimited if shared
   const maxReplays = hasShared ? 0 : 5; // 0 = unlimited

   // Audio tones (frequencies) - Each button always has the same sound:
   // Button 1 (padIndex 0) = 220 Hz
   // Button 2 (padIndex 1) = 330 Hz
   // Button 3 (padIndex 2) = 440 Hz
   // Button 4 (padIndex 3) = 550 Hz
   const tones = [220, 330, 440, 550];

   // Color palette for each button (1, 2, 3, 4)
   const getButtonColor = useCallback((padIndex: number) => {
      const colors = [
         {
            bg: "rgba(110, 168, 255, 0.25)",
            border: "rgba(110, 168, 255, 0.6)",
            shadow: "rgba(110, 168, 255, 0.4)",
         }, // Blue - Button 1
         {
            bg: "rgba(54, 211, 153, 0.25)",
            border: "rgba(54, 211, 153, 0.6)",
            shadow: "rgba(54, 211, 153, 0.4)",
         }, // Green - Button 2
         {
            bg: "rgba(251, 113, 133, 0.25)",
            border: "rgba(251, 113, 133, 0.6)",
            shadow: "rgba(251, 113, 133, 0.4)",
         }, // Red/Pink - Button 3
         {
            bg: "rgba(251, 191, 36, 0.25)",
            border: "rgba(251, 191, 36, 0.6)",
            shadow: "rgba(251, 191, 36, 0.4)",
         }, // Yellow - Button 4
      ];
      return colors[padIndex] || colors[0];
   }, []);

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

   // Initialize audio context
   useEffect(() => {
      const AudioCtx =
         window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
      return () => {
         if (audioContextRef.current) {
            audioContextRef.current.close();
         }
      };
   }, []);

   // Start game automatically on mount
   useEffect(() => {
      if (gameState === "tutorial") {
         setGameState("playing");
         setCurrentRound(0);
         setCurrentScore(0);
         setSequence([]);
         setReplaysUsed(0);
      }
   }, []);

   useEffect(() => {
      roundRef.current = currentRound;
   }, [currentRound]);

   // Start first round when game state is playing
   useEffect(() => {
      if (
         currentRound < maxRounds &&
         gameState === "playing" &&
         sequence.length === 0
      ) {
         startNewRound();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, maxRounds, gameState, sequence.length]);

   // Check if game is complete (when all rounds are finished)
   useEffect(() => {
      if (currentRound >= maxRounds && gameState !== "tutorial") {
         // Score is calculated based on rounds completed, not from currentScore
         // Each round is worth (100 / maxRounds) points
         const finalScore = Math.round((currentRound / maxRounds) * 100);
         // Use setTimeout to avoid calling onScoreUpdate/onComplete during render
         setTimeout(() => {
            onScoreUpdate(finalScore);
            setTimeout(() => onComplete(finalScore), 1000);
         }, 0);
      }
   }, [currentRound, maxRounds, gameState, onScoreUpdate, onComplete]);

   // Play tone for a specific pad - each pad always has the same sound
   const playTone = useCallback(
      (freq: number, padIndex: number, volume: number = 0.3) => {
         if (!audioContextRef.current) return;

         // Ensure padIndex is valid (0-3) and use the corresponding frequency
         // Each button always plays its fixed sound: Button 1=220Hz, 2=330Hz, 3=440Hz, 4=550Hz
         const validPadIndex = Math.max(0, Math.min(3, padIndex));
         const toneFreq = tones[validPadIndex]; // Always use the same sound for each button

         const osc = audioContextRef.current.createOscillator();
         const gain = audioContextRef.current.createGain();
         osc.frequency.value = toneFreq; // Use the fixed frequency for this pad
         osc.connect(gain);
         gain.connect(audioContextRef.current.destination);

         gain.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
         gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContextRef.current.currentTime + 0.35
         );

         setActivePad(padIndex);
         osc.start();
         osc.stop(audioContextRef.current.currentTime + 0.35);

         setTimeout(() => {
            setActivePad(null);
         }, 350);
      },
      [tones]
   );

   const playSequence = useCallback(
      (seq: number[]) => {
         setIsPlayingSequence(true);
         setIsAcceptingInput(false);
         setGameState("listening");
         setPlayerSequence([]);

         seq.forEach((padIndex, i) => {
            setTimeout(() => {
               // Each padIndex (0-3) always plays its fixed sound from tones array
               // Button 1 (padIndex 0) = 220Hz, Button 2 (1) = 330Hz, Button 3 (2) = 440Hz, Button 4 (3) = 550Hz
               // Use higher volume (0.5) for automatic playback to match user click volume
               playTone(tones[padIndex], padIndex, 0.5);
            }, i * 600);
         });

         setTimeout(() => {
            setIsPlayingSequence(false);
            setIsAcceptingInput(true);
            setGameState("input");
         }, seq.length * 600 + 200);
      },
      [tones, playTone]
   );

   const startNewRound = useCallback(
      (round?: number) => {
         // Use provided round or current round
         const roundToUse = round !== undefined ? round : currentRound;

         // Reset player sequence first
         setPlayerSequence([]);
         inputLockRef.current = false;
         resolvedRoundRef.current = null;

         // Check if round sequences are configured in config
         const roundSequences = config.roundSequences;

         if (
            roundSequences &&
            Array.isArray(roundSequences) &&
            roundSequences[roundToUse] !== undefined
         ) {
            // Use configured sequence for this round
            // roundSequences is 0-indexed, so roundSequences[0] is for round 1
            // Convert button numbers (1-4) to padIndex (0-3)
            const configuredSequence = roundSequences[roundToUse].map(
               (btn: number) => {
                  // Ensure button number is valid (1-4) and convert to padIndex (0-3)
                  const buttonNum = Math.max(1, Math.min(4, btn));
                  return buttonNum - 1; // Convert to padIndex (0-3)
               }
            );

            // Reset sequence first, then set the new one
            setSequence([]);
            sequenceRef.current = [];
            setTimeout(() => {
               setSequence(configuredSequence);
               sequenceRef.current = configuredSequence;
               // Play sequence after state update
               setTimeout(() => {
                  playSequence(configuredSequence);
               }, 100);
            }, 50);
         } else {
            // Default behavior: add one random sound to previous sequence
            const newSequence = [
               ...sequenceRef.current,
               Math.floor(Math.random() * 4),
            ];
            setSequence(newSequence);
            sequenceRef.current = newSequence;
            // Play sequence after state update
            setTimeout(() => {
               playSequence(newSequence);
            }, 500);
         }

         setGameState("listening");
      },
      [playSequence, config, currentRound]
   );

   const handlePadClick = useCallback(
      (padIndex: number) => {
         if (!isAcceptingInput || isPlayingSequence) return;
         if (inputLockRef.current) return;

         // Each button (1-4) always plays its fixed sound: Button 1=220Hz, 2=330Hz, 3=440Hz, 4=550Hz
         // Use higher volume (0.6) when user clicks to ensure it's as loud as automatic playback
         playTone(tones[padIndex], padIndex, 0.6);

         setPlayerSequence((prevPlayerSeq) => {
            const newPlayerSequence = [...prevPlayerSeq, padIndex];
            const currentSequence = sequenceRef.current;
            const currentIndex = newPlayerSequence.length - 1;
            const roundIndex = roundRef.current;

            if (resolvedRoundRef.current === roundIndex) {
               return newPlayerSequence;
            }

            if (
               newPlayerSequence[currentIndex] !== currentSequence[currentIndex]
            ) {
               // Wrong answer - keep same round, allow retry without replaying sequence
               resolvedRoundRef.current = roundIndex;
               inputLockRef.current = true;
               setGameState("wrong");
               setIsAcceptingInput(false);
               setPlayerSequence([]);

               const roundScore = Math.round((roundIndex / maxRounds) * 100);
               setCurrentScore(roundScore);
               // Use setTimeout to avoid calling onScoreUpdate during render
               setTimeout(() => {
                  onScoreUpdate(roundScore);
               }, 0);

               // Allow retry without replaying sequence - user can click replay if needed
               setTimeout(() => {
                  setGameState("input");
                  inputLockRef.current = false;
                  resolvedRoundRef.current = null;
                  setPlayerSequence([]);
                  setIsAcceptingInput(true);
               }, 1500);

               return newPlayerSequence;
            }

            if (newPlayerSequence.length === currentSequence.length) {
               // Correct round
               resolvedRoundRef.current = roundIndex;
               inputLockRef.current = true;
               setGameState("correct");
               setIsAcceptingInput(false);

               setTimeout(() => {
                  setCurrentRound((prevRound) => {
                     const nextRound = prevRound + 1;
                     roundRef.current = nextRound;
                     const roundScore = Math.round(
                        (nextRound / maxRounds) * 100
                     );
                     setCurrentScore(roundScore);
                     // Use setTimeout to avoid calling onScoreUpdate during render
                     setTimeout(() => {
                        onScoreUpdate(roundScore);
                     }, 0);

                     if (nextRound < maxRounds) {
                        setSequence([]);
                        sequenceRef.current = [];
                        setTimeout(() => {
                           startNewRound(nextRound);
                        }, 100);
                     } else {
                        const finalScore = Math.round(
                           (nextRound / maxRounds) * 100
                        );
                        // Use setTimeout to avoid calling onScoreUpdate/onComplete during render
                        setTimeout(() => {
                           onScoreUpdate(finalScore);
                           setTimeout(() => onComplete(finalScore), 1000);
                        }, 0);
                     }
                     return nextRound;
                  });
               }, 800);
            }

            return newPlayerSequence;
         });
      },
      [
         isAcceptingInput,
         isPlayingSequence,
         tones,
         playTone,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
      ]
   );

   // Keyboard controls
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         if (!isAcceptingInput || isPlayingSequence || gameState === "tutorial")
            return;

         const key = e.key;
         if (key >= "1" && key <= "4") {
            e.preventDefault();
            const padIndex = parseInt(key) - 1;
            handlePadClick(padIndex);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [isAcceptingInput, isPlayingSequence, gameState, handlePadClick]);

   // Check if user has shared or came from shared link (same as Card Flip)
   useEffect(() => {
      const gameKey = "play50games_shared_sound-memory";
      const EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes

      const urlParams = new URLSearchParams(window.location.search);
      const sharedBy = urlParams.get("shared");
      if (sharedBy) {
         const expiryTime = Date.now() + EXPIRY_TIME;
         localStorage.setItem(
            gameKey,
            JSON.stringify({ shared: true, expiry: expiryTime })
         );
         setHasShared(true);

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
         const sharedData = localStorage.getItem(gameKey);
         if (sharedData) {
            try {
               const parsed = JSON.parse(sharedData);
               if (parsed.expiry && Date.now() < parsed.expiry) {
                  setHasShared(true);
                  if (parsed.share_id) {
                     setCurrentShareId(parsed.share_id);
                  }
               } else if (parsed.share_id && !parsed.expiry) {
                  // Keep share_id so we can poll for clicks after a refresh
                  setCurrentShareId(parsed.share_id);
               } else {
                  localStorage.removeItem(gameKey);
                  setHasShared(false);
                  setCurrentShareId(null);
               }
            } catch (e) {
               localStorage.removeItem(gameKey);
               setHasShared(false);
               setCurrentShareId(null);
            }
         }
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, []);

   // Check if share has clicks
   useEffect(() => {
      if (!currentShareId) return;

      const checkShareStatus = async () => {
         // Check expiry from localStorage before making API call
         const gameKey = "play50games_shared_sound-memory";
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
            if (status.has_clicks && !hasShared) {
               const gameKey = "play50games_shared_sound-memory";
               const EXPIRY_TIME = 15 * 60 * 1000;
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
               setUnlimitedActivated(true);
               setTimeout(() => {
                  setUnlimitedActivated(false);
                  setHasShared(false);
                  localStorage.removeItem(gameKey);
               }, EXPIRY_TIME);

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
               const gameKey = "play50games_shared_sound-memory";
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

      checkShareStatus();
      shareCheckIntervalRef.current = setInterval(checkShareStatus, 10000);

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, hasShared]);

   // Replay sequence - with limit of 5 uses (unlimited if shared)
   const handleReplay = () => {
      if (sequence.length === 0 || isPlayingSequence) return;
      if (maxReplays > 0 && replaysUsed >= maxReplays) return; // No replays left

      setPlayerSequence([]);
      inputLockRef.current = false;
      resolvedRoundRef.current = null;
      playSequence(sequence);
      setReplaysUsed((prev) => prev + 1);
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
         await registerShare(shareId, "sound-memory");
         const gameKey = "play50games_shared_sound-memory";
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
               title: "Sound Memory Game",
               text: "Check out this awesome Sound Memory game!",
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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "20px" : "24px",
            padding: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "700px",
            margin: "0 auto",
            width: "100%",
         }}
      >
         {/* Header with Round and Score - Same as Match the Shapes */}
         <div
            style={{
               width: "100%",
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--ok)",
                     }}
                  />
                  Score: {currentScore} / {maxRounds * 10}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: isMobile ? "3px" : "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: isMobile ? "3px" : "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               textAlign: "center",
            }}
         >
            <div style={{ marginBottom: isMobile ? "10px" : "16px" }}>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.125rem",
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: isMobile ? "6px" : "8px",
                     flexWrap: "wrap",
                  }}
               >
                  {gameState === "listening" && "Listen carefully…"}
                  {gameState === "input" &&
                     (isMobile
                        ? "Your turn"
                        : "Your turn - Repeat the sequence")}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(54, 211, 153, 0.9)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(251, 113, 133, 0.9)",
                           }}
                        />
                        Wrong sequence
                     </>
                  )}
               </b>
               {gameState === "listening" && (
                  <p
                     style={{
                        margin: isMobile ? "6px 0 0" : "4px 0 0",
                        color: "var(--muted)",
                        fontSize: isMobile ? "0.8rem" : "0.875rem",
                     }}
                  >
                     Repeat the sounds in the same order
                  </p>
               )}
            </div>
            <div
               style={{
                  display: "inline-block",
                  padding: isMobile ? "5px 10px" : "6px 12px",
                  borderRadius: "999px",
                  fontSize: isMobile ? "0.7rem" : "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background:
                     gameState === "correct"
                        ? "rgba(54, 211, 153, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(251, 113, 133, 0.2)"
                        : "rgba(15, 27, 51, 0.55)",
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--text)",
               }}
            >
               {gameState === "listening" && "Playing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Action Buttons: Replay, Share */}
         <div
            style={{
               width: "100%",
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               padding: isMobile ? "0 8px" : "0",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
            }}
         >
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
                        ? "Link copied! Unlimited replay unlocks when someone opens it!"
                        : "Link copied! Unlimited replay will unlock when someone opens your link!"}
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
                        ? "🎉 Unlimited replay active for 15 minutes!"
                        : "🎉 Someone opened your link! Unlimited replay is now active for 15 minutes!"}
                  </span>
               </div>
            )}

            {/* Replay Button */}
            <button
               onClick={handleReplay}
               disabled={
                  sequence.length === 0 ||
                  isPlayingSequence ||
                  (maxReplays > 0 && replaysUsed >= maxReplays)
               }
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
                     sequence.length === 0 ||
                     isPlayingSequence ||
                     (maxReplays > 0 && replaysUsed >= maxReplays)
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     sequence.length === 0 ||
                     isPlayingSequence ||
                     (maxReplays > 0 && replaysUsed >= maxReplays)
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     sequence.length > 0 &&
                     !isPlayingSequence &&
                     !(maxReplays > 0 && replaysUsed >= maxReplays)
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(125, 211, 252, 0.3), rgba(125, 211, 252, 0.2))";
                     e.currentTarget.style.borderColor =
                        "rgba(125, 211, 252, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(125, 211, 252, 0.3)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (
                     sequence.length > 0 &&
                     !isPlayingSequence &&
                     !(maxReplays > 0 && replaysUsed >= maxReplays)
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))";
                     e.currentTarget.style.borderColor =
                        "rgba(125, 211, 252, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
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
               <span>{isMobile ? "Share" : "Share for Unlimited Replay"}</span>
            </button>
         </div>

         {/* Sound Pads */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: isMobile
                  ? "repeat(2, 1fr)"
                  : "repeat(4, 1fr)",
               gap: "5px",
               width: "100%",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
               padding: isMobile ? "0 12px" : "0",
            }}
         >
            {[0, 1, 2, 3].map((padIndex) => {
               const buttonColor = getButtonColor(padIndex);
               return (
                  <button
                     key={padIndex}
                     onClick={() => handlePadClick(padIndex)}
                     disabled={!isAcceptingInput || isPlayingSequence}
                     style={{
                        borderRadius: isMobile ? "18px" : "20px",
                        aspectRatio: "1",
                        width: "100%",
                        height: "100%",
                        border:
                           activePad === padIndex
                              ? isMobile
                                 ? `3px solid ${buttonColor.border}`
                                 : `3px solid ${buttonColor.border}`
                              : isMobile
                              ? `2px solid ${buttonColor.border}`
                              : `2px solid ${buttonColor.border}`,
                        background:
                           activePad === padIndex
                              ? `linear-gradient(135deg, ${buttonColor.bg.replace(
                                   "0.25",
                                   "0.5"
                                )}, ${buttonColor.bg.replace("0.25", "0.4")})`
                              : buttonColor.bg,
                        boxShadow:
                           activePad === padIndex
                              ? isMobile
                                 ? `${buttonColor.shadow} 0px 0px 20px, ${buttonColor.shadow} 0px 0px 12px inset, ${buttonColor.shadow} 0px 0px 30px`
                                 : `${buttonColor.shadow} 0px 0px 25px, ${buttonColor.shadow} 0px 0px 15px inset, ${buttonColor.shadow} 0px 0px 35px`
                              : isMobile
                              ? `0 6px 12px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`
                              : `0 8px 16px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: isMobile ? "5px" : "6px",
                        cursor:
                           isAcceptingInput && !isPlayingSequence
                              ? "pointer"
                              : "not-allowed",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "relative",
                        transform:
                           activePad === padIndex
                              ? isMobile
                                 ? "scale(1.05)"
                                 : "scale(1.06)"
                              : "scale(1)",
                        opacity:
                           isAcceptingInput && !isPlayingSequence ? 1 : 0.65,
                        fontWeight: 900,
                        fontSize: isMobile ? "16px" : "20px",
                        color: "var(--text)",
                        zIndex: activePad === padIndex ? 10 : 1,
                        padding: isMobile ? "14px" : "16px",
                        touchAction: "manipulation",
                     }}
                     onMouseEnter={(e) => {
                        if (
                           isAcceptingInput &&
                           !isPlayingSequence &&
                           activePad !== padIndex
                        ) {
                           e.currentTarget.style.transform = "scale(1.03)";
                           e.currentTarget.style.borderColor =
                              buttonColor.border;
                           e.currentTarget.style.boxShadow = `0 12px 24px rgba(0, 0, 0, 0.25), 0 4px 8px rgba(0, 0, 0, 0.15)`;
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (
                           isAcceptingInput &&
                           !isPlayingSequence &&
                           activePad !== padIndex
                        ) {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow = `0 8px 16px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)`;
                        }
                     }}
                  >
                     <span
                        style={{
                           fontSize:
                              activePad === padIndex
                                 ? isMobile
                                    ? "2.4rem"
                                    : "2.8rem"
                                 : isMobile
                                 ? "2rem"
                                 : "2.2rem",
                           color:
                              activePad === padIndex
                                 ? buttonColor.border
                                 : buttonColor.border.replace("0.6", "0.85"),
                           fontWeight: 900,
                           textShadow:
                              activePad === padIndex
                                 ? isMobile
                                    ? `${buttonColor.shadow} 0px 0px 10px, ${buttonColor.shadow} 0px 0px 5px`
                                    : `${buttonColor.shadow} 0px 0px 12px, ${buttonColor.shadow} 0px 0px 6px`
                                 : "none",
                           transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                           lineHeight: "1",
                        }}
                     >
                        {padIndex + 1}
                     </span>
                     <span
                        style={{
                           fontSize: isMobile ? "0.7rem" : "0.8rem",
                           color: "var(--muted)",
                           fontWeight: 600,
                           letterSpacing: "0.5px",
                           textTransform: "uppercase",
                           marginTop: isMobile ? "2px" : "0",
                        }}
                     >
                        Key {padIndex + 1}
                     </span>
                  </button>
               );
            })}
         </div>
      </div>
   );
}

// Emoji Memory Game (18) - Modern version
function EmojiMemory({
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
   const [emojis, setEmojis] = useState<string[]>([]);
   const [selected, setSelected] = useState<number[]>([]);
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality (from Card Flip Memory)
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [showHint, setShowHint] = useState(false);
   const [hintPositions, setHintPositions] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Emoji Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback(
      (round: number): [number, number] => {
         // Rounds 1-5: 4x4, 6-10: 5x5, 11-15: 6x7, 16-20: 8x8
         if (round >= 1 && round <= 5) {
            return [4, 4];
         } else if (round >= 6 && round <= 10) {
            return [5, 5];
         } else if (round >= 11 && round <= 15) {
            return [6, 7];
         } else {
            return [8, 8];
         }
      },
      []
   );

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
   }, []);

   // Emoji list - using diverse emojis
   const emojiList = useMemo(
      () => [
         "🍎",
         "🚗",
         "🐶",
         "⭐",
         "🎵",
         "🏀",
         "📦",
         "🌙",
         "🔥",
         "🎲",
         "📌",
         "🧩",
         "🎨",
         "🎯",
         "🎪",
         "🎭",
         "🎬",
         "🎤",
         "🎧",
         "🎮",
         "🦄",
         "🐱",
         "🐼",
         "🦁",
         "🐯",
         "🐸",
         "🐰",
         "🐻",
         "🐨",
         "🐷",
      ],
      []
   );

   // Get grid size from config or calculate from round
   const gridSizeConfig = useMemo(() => {
      if (config.gridSizes && Array.isArray(config.gridSizes)) {
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (Array.isArray(size)) {
            return [size[0], size[1]];
         }
         return [size, size];
      }
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   const [gridWidth, gridHeight] = gridSizeConfig;

   const startRound = useCallback(() => {
      const [currentWidth, currentHeight] = gridSizeConfig;
      const currentTotalCells = currentWidth * currentHeight;
      const emojiCount = Math.min(
         Math.floor(currentTotalCells / 2),
         Math.min(4 + currentRound, 8)
      );

      // Select random emojis
      const shuffled = [...emojiList].sort(() => Math.random() - 0.5);
      const selectedEmojis = shuffled.slice(0, emojiCount);

      // Create grid with emojis at random positions
      const grid: string[] = new Array(currentTotalCells).fill("");
      const positions = [...Array(currentTotalCells).keys()]
         .sort(() => Math.random() - 0.5)
         .slice(0, emojiCount);

      positions.forEach((pos, i) => {
         grid[pos] = selectedEmojis[i];
      });

      setEmojis(grid);
      setSelected([]);
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setShowHint(false);
      setHintPositions([]);

      // Show emojis for 2-4 seconds based on round
      const showTime = 2000 + currentRound * 200;
      setTimeout(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound, gridSizeConfig, emojiList]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound, maxRounds, startRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

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
         await registerShare(shareId, "emoji-memory");
         // Store share_id to monitor for clicks (but DON'T activate hints yet)
         const gameKey = "play50games_shared_emoji-memory";
         // Only store share_id, don't set hasShared to true yet
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
         // Note: hasShared remains false until someone clicks the link
      } catch (error) {}
   };

   // Share functionality (from Card Flip Memory)
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
            const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
                  const gameKey = "play50games_shared_emoji-memory";
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
      const gameKey = "play50games_shared_emoji-memory";
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
               // If already shared and not expired, activate unlimited hints
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  // Set timeout to expire after remaining time
                  const remainingTime = data.expiry - Date.now();
                  if (remainingTime > 0) {
                     setTimeout(() => {
                        setUnlimitedActivated(false);
                        setHasShared(false);
                        localStorage.removeItem(gameKey);
                     }, remainingTime);
                  }
               }
            }
         } catch (error) {
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

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
               title: "Emoji Memory Game",
               text: "Check out this awesome Emoji Memory game!",
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

   // Handle hint button click (from Card Flip Memory)
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return; // No hints left
      if (showing || gameState !== "input") return; // Can't hint during memorizing

      // Find emoji positions that haven't been selected yet
      const emojiPositions = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1 && !selected.includes(idx));

      if (emojiPositions.length > 0) {
         // Show 1-2 random emoji positions as hint
         const hintCount = Math.min(2, emojiPositions.length);
         const shuffled = [...emojiPositions].sort(() => Math.random() - 0.5);
         const hintPos = shuffled.slice(0, hintCount);

         setHintPositions(hintPos);
         setShowHint(true);
         setHintsUsed(hintsUsed + 1);

         // Hide hint after 2 seconds
         setTimeout(() => {
            setShowHint(false);
            setHintPositions([]);
         }, 2000);
      }
   };

   const handleCellClick = (index: number) => {
      if (showing || gameState !== "input") return;
      if (selected.includes(index)) return;

      const newSelected = [...selected, index];
      setSelected(newSelected);

      // Check if clicked on an emoji position
      const hasEmoji = emojis[index] !== "";
      const allEmojisFound = emojis
         .map((emoji, idx) => (emoji !== "" ? idx : -1))
         .filter((idx) => idx !== -1)
         .every((idx) => newSelected.includes(idx));

      if (allEmojisFound) {
         // All emojis found - check if correct
         const correctPositions = emojis
            .map((emoji, idx) => (emoji !== "" ? idx : -1))
            .filter((idx) => idx !== -1);

         const isCorrect =
            newSelected.length === correctPositions.length &&
            newSelected.every((idx) => correctPositions.includes(idx));

         if (isCorrect) {
            const roundScore = Math.round(100 / maxRounds);
            const newScore = currentScore + roundScore;
            setCurrentScore(newScore);
            setGameState("correct");
            setFeedback("correct");
            setTimeout(() => {
               onScoreUpdate(newScore);
            }, 0);

            setTimeout(() => {
               setFeedback(null);
               setCurrentRound(currentRound + 1);
            }, 1500);
         } else {
            // Wrong answer - show feedback and reset for retry
            setGameState("wrong");
            setFeedback("wrong");

            // After showing feedback, reset selection and allow retry
            setTimeout(() => {
               setFeedback(null);
               setSelected([]);
               setGameState("input");
            }, 2000);
         }
      } else if (!hasEmoji) {
         // Clicked on empty cell - wrong, show feedback and reset for retry
         setGameState("wrong");
         setFeedback("wrong");

         // After showing feedback, reset selection and allow retry
         setTimeout(() => {
            setFeedback(null);
            setSelected([]);
            setGameState("input");
         }, 2000);
      }
   };

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "20px" : "24px",
            padding: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "700px",
            margin: "0 auto",
            width: "100%",
         }}
      >
         {/* Header with Round and Score */}
         <div
            style={{
               width: "100%",
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: isMobile ? "3px" : "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: isMobile ? "3px" : "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               textAlign: "center",
            }}
         >
            <div style={{ marginBottom: isMobile ? "10px" : "16px" }}>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.125rem",
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: isMobile ? "6px" : "8px",
                     flexWrap: "wrap",
                  }}
               >
                  {gameState === "memorizing" &&
                     "Memorize the emoji positions…"}
                  {gameState === "input" &&
                     "Click on the cells where you saw emojis"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(54, 211, 153, 0.9)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(251, 113, 133, 0.9)",
                           }}
                        />
                        Wrong!
                     </>
                  )}
               </b>
            </div>
            <div
               style={{
                  display: "inline-block",
                  padding: isMobile ? "5px 10px" : "6px 12px",
                  borderRadius: "999px",
                  fontSize: isMobile ? "0.7rem" : "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background:
                     gameState === "correct"
                        ? "rgba(54, 211, 153, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(251, 113, 133, 0.2)"
                        : "rgba(15, 27, 51, 0.55)",
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--text)",
               }}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Emoji Grid */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "12px" : "16px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "600px",
                  margin: "0 auto",
               }}
            >
               {emojis.map((emoji, i) => {
                  const isSelected = selected.includes(i);
                  const hasEmoji = emoji !== "";
                  const isCorrect = isSelected && hasEmoji;
                  const isWrong = isSelected && !hasEmoji;
                  const isHinted = showHint && hintPositions.includes(i);

                  return (
                     <button
                        key={i}
                        onClick={() => handleCellClick(i)}
                        disabled={
                           showing || isSelected || gameState !== "input"
                        }
                        style={{
                           aspectRatio: "1",
                           borderRadius: isMobile ? "12px" : "14px",
                           border: isCorrect
                              ? "3px solid var(--ok)"
                              : isWrong
                              ? "3px solid var(--warn)"
                              : isHinted
                              ? "3px solid var(--accent)"
                              : isSelected
                              ? "2px solid var(--accent)"
                              : "2px solid var(--stroke)",
                           background:
                              showing || isSelected || isHinted
                                 ? hasEmoji
                                    ? isHinted
                                       ? "linear-gradient(135deg, rgba(125, 211, 252, 0.4), rgba(125, 211, 252, 0.3))"
                                       : "linear-gradient(135deg, rgba(125, 211, 252, 0.2), rgba(125, 211, 252, 0.1))"
                                    : "var(--card)"
                                 : "var(--card)",
                           fontSize: isMobile ? "2rem" : "2.5rem",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           cursor:
                              showing || isSelected || gameState !== "input"
                                 ? "not-allowed"
                                 : "pointer",
                           transition: "all 0.2s ease",
                           opacity:
                              showing || isSelected || gameState !== "input"
                                 ? showing && !hasEmoji
                                    ? 0.3
                                    : 1
                                 : 0.7,
                           transform: isSelected ? "scale(0.95)" : "scale(1)",
                           boxShadow: isCorrect
                              ? "0 0 20px rgba(54, 211, 153, 0.5)"
                              : isWrong
                              ? "0 0 20px rgba(251, 113, 133, 0.5)"
                              : isHinted
                              ? "0 0 20px rgba(125, 211, 252, 0.6)"
                              : isSelected
                              ? "0 4px 12px rgba(125, 211, 252, 0.3)"
                              : "0 2px 8px rgba(0, 0, 0, 0.1)",
                        }}
                        onMouseEnter={(e) => {
                           if (
                              !showing &&
                              !isSelected &&
                              gameState === "input"
                           ) {
                              e.currentTarget.style.transform = "scale(1.05)";
                              e.currentTarget.style.opacity = "1";
                           }
                        }}
                        onMouseLeave={(e) => {
                           if (
                              !showing &&
                              !isSelected &&
                              gameState === "input"
                           ) {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.opacity = "0.7";
                           }
                        }}
                     >
                        {showing || isSelected || isHinted
                           ? hasEmoji
                              ? emoji
                              : ""
                           : "?"}
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Action Buttons: Hint, Share */}
         <div
            style={{
               width: "100%",
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               padding: isMobile ? "0 8px" : "0",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
            }}
         >
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

            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  showing ||
                  gameState !== "input"
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
                  border:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(251, 191, 36, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     !showing &&
                     gameState === "input"
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
                     !showing &&
                     gameState === "input"
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
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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

         {/* Feedback Message (from Match the Shapes) */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",
                  borderRadius: isMobile ? "12px" : "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "600px",
                  justifyContent: "center",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Number Recall Game (19) - Modern version
function NumberRecall({
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
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<string>("");
   const [input, setInput] = useState("");
   const [showing, setShowing] = useState(true);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [revealedDigits, setRevealedDigits] = useState<number[]>([]); // Array of revealed digit indices
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Number Recall, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Check if mobile device
   useEffect(() => {
      const checkMobile = () => {
         setIsMobile(window.innerWidth < 768);
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
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
         await registerShare(shareId, "number-recall");
         const gameKey = "play50games_shared_number-recall";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   useEffect(() => {
      if (currentShareId) {
         shareCheckIntervalRef.current = setInterval(async () => {
            try {
               const status = await getShareStatus(currentShareId);
               if (status && status.clicks > 0 && !unlimitedActivated) {
                  setUnlimitedActivated(true);
                  setHasShared(true);
                  if (shareCheckIntervalRef.current) {
                     clearInterval(shareCheckIntervalRef.current);
                  }
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                  }, 15 * 60 * 1000); // 15 minutes
               }
            } catch (error) {
               console.error("Error checking share status:", error);
            }
         }, 10000); // Check every 10 seconds
      }

      return () => {
         if (shareCheckIntervalRef.current) {
            clearInterval(shareCheckIntervalRef.current);
         }
      };
   }, [currentShareId, unlimitedActivated]);

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
               title: "Number Recall Game",
               text: "Check out this awesome Number Recall game!",
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
      if (showing || gameState !== "input") return;

      // Reveal next digit in sequence (one at a time)
      if (sequence.length > 0 && revealedDigits.length < sequence.length) {
         const nextIndex = revealedDigits.length;
         setRevealedDigits([...revealedDigits, nextIndex]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   const startRound = useCallback(() => {
      // Sequence length increases with round: 3 + round (min 3, max 10)
      const length = Math.min(3 + currentRound, 10);
      const newSequence = Array.from({ length }, () =>
         Math.floor(Math.random() * 10)
      ).join("");

      setSequence(newSequence);
      setInput("");
      setShowing(true);
      setGameState("memorizing");
      setFeedback(null);
      setRevealedDigits([]);

      // Show time: 1200ms + round * 200ms
      const showTime = 1200 + currentRound * 200;
      setTimeout(() => {
         setShowing(false);
         setGameState("input");
      }, showTime);
   }, [currentRound]);

   const handleSubmit = () => {
      if (showing || gameState !== "input") return;
      if (!input.trim()) return;

      const isCorrect = input === sequence;

      if (isCorrect) {
         // Calculate score based on completed rounds to ensure total is exactly 100
         const completedRounds = currentRound + 1;
         const newScore = Math.round((completedRounds / maxRounds) * 100);
         setCurrentScore(newScore);
         setGameState("correct");
         setFeedback("correct");
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         setTimeout(() => {
            setFeedback(null);
            setCurrentRound(currentRound + 1);
         }, 1500);
      } else {
         // Wrong answer - show feedback and reset for retry
         setGameState("wrong");
         setFeedback("wrong");

         setTimeout(() => {
            setFeedback(null);
            setInput("");
            setGameState("input");
         }, 2000);
      }
   };

   const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
         handleSubmit();
      }
   };

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "20px" : "24px",
            padding: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "700px",
            margin: "0 auto",
            width: "100%",
         }}
      >
         {/* Header with Round and Score */}
         <div
            style={{
               width: "100%",
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: isMobile ? "3px" : "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${((currentRound + 1) / maxRounds) * 100}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: isMobile ? "3px" : "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               textAlign: "center",
            }}
         >
            <div style={{ marginBottom: isMobile ? "10px" : "16px" }}>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.125rem",
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: isMobile ? "6px" : "8px",
                     flexWrap: "wrap",
                  }}
               >
                  {gameState === "memorizing" && "Memorize the number…"}
                  {gameState === "input" && "Type the sequence you saw"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(54, 211, 153, 0.9)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 18 : 20,
                              height: isMobile ? 18 : 20,
                              color: "rgba(251, 113, 133, 0.9)",
                           }}
                        />
                        Wrong!
                     </>
                  )}
               </b>
            </div>
            <div
               style={{
                  display: "inline-block",
                  padding: isMobile ? "5px 10px" : "6px 12px",
                  borderRadius: "999px",
                  fontSize: isMobile ? "0.7rem" : "0.75rem",
                  fontWeight: 700,
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  background:
                     gameState === "correct"
                        ? "rgba(54, 211, 153, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(251, 113, 133, 0.2)"
                        : "rgba(15, 27, 51, 0.55)",
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--text)",
               }}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Number Display Box */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "24px" : "32px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            <div
               style={{
                  height: isMobile ? "120px" : "140px",
                  borderRadius: isMobile ? "16px" : "18px",
                  border: "1px solid var(--stroke)",
                  background:
                     showing || revealedDigits.length > 0
                        ? "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.14), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))"
                        : "radial-gradient(220px 140px at 30% 30%, rgba(125, 211, 252, 0.08), transparent 55%), linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01))",
                  boxShadow: "0 10px 18px rgba(0, 0, 0, 0.22)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isMobile ? "32px" : "42px",
                  fontWeight: 900,
                  letterSpacing: isMobile ? "4px" : "6px",
                  color: "var(--text)",
                  position: "relative",
               }}
            >
               {showing ? (
                  sequence
               ) : revealedDigits.length > 0 ? (
                  <span>
                     {sequence.split("").map((digit, index) => (
                        <span
                           key={index}
                           style={{
                              color: revealedDigits.includes(index)
                                 ? "var(--accent)"
                                 : "var(--text)",
                              opacity: revealedDigits.includes(index) ? 1 : 0.3,
                           }}
                        >
                           {revealedDigits.includes(index) ? digit : "•"}
                        </span>
                     ))}
                  </span>
               ) : (
                  sequence.split("").map((_, index) => (
                     <span key={index} style={{ opacity: 0.3 }}>
                        •
                     </span>
                  ))
               )}
            </div>

            {/* Input Section */}
            {!showing && (
               <div
                  style={{
                     display: "flex",
                     gap: isMobile ? "8px" : "10px",
                     marginTop: isMobile ? "16px" : "20px",
                  }}
               >
                  <input
                     type="text"
                     value={input}
                     onChange={(e) =>
                        setInput(e.target.value.replace(/\D/g, ""))
                     }
                     onKeyPress={handleKeyPress}
                     maxLength={sequence.length}
                     disabled={gameState !== "input"}
                     placeholder="Type the sequence"
                     style={{
                        flex: 1,
                        borderRadius: isMobile ? "12px" : "12px",
                        border: "1px solid var(--stroke)",
                        background: "rgba(15, 27, 51, 0.7)",
                        color: "var(--text)",
                        padding: isMobile ? "12px" : "12px",
                        fontSize: isMobile ? "16px" : "18px",
                        letterSpacing: isMobile ? "3px" : "4px",
                        textAlign: "center",
                        outline: "none",
                        fontFamily: "monospace",
                        fontWeight: 600,
                        opacity: gameState !== "input" ? 0.5 : 1,
                        cursor: gameState !== "input" ? "not-allowed" : "text",
                     }}
                  />
                  <button
                     onClick={handleSubmit}
                     disabled={gameState !== "input" || !input.trim()}
                     style={{
                        padding: isMobile ? "12px 20px" : "12px 24px",
                        borderRadius: isMobile ? "12px" : "12px",
                        border: "1px solid var(--stroke)",
                        background:
                           gameState !== "input" || !input.trim()
                              ? "rgba(100, 100, 100, 0.2)"
                              : "linear-gradient(180deg, rgba(110, 168, 255, 0.9), rgba(110, 168, 255, 0.55))",
                        color:
                           gameState !== "input" || !input.trim()
                              ? "var(--muted)"
                              : "#081126",
                        cursor:
                           gameState !== "input" || !input.trim()
                              ? "not-allowed"
                              : "pointer",
                        fontWeight: 700,
                        fontSize: isMobile ? "14px" : "16px",
                        transition: "all 0.2s ease",
                        opacity:
                           gameState !== "input" || !input.trim() ? 0.5 : 1,
                     }}
                  >
                     OK
                  </button>
               </div>
            )}
         </div>

         {/* Action Buttons: Hint, Share */}
         <div
            style={{
               width: "100%",
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               padding: isMobile ? "0 8px" : "0",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
            }}
         >
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

            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  showing ||
                  gameState !== "input"
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
                  border:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(251, 191, 36, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     showing ||
                     gameState !== "input"
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     !showing &&
                     gameState === "input"
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
                     !showing &&
                     gameState === "input"
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
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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

         {/* Feedback Message (from Match the Shapes) */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",
                  borderRadius: isMobile ? "12px" : "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "700px",
                  justifyContent: "center",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Image Recall Game (20)
// Image Recall Game (20) - Modern version
function ImageRecall({
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
   const maxRounds = config.rounds || 10;
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [sequence, setSequence] = useState<number[]>([]);
   const [userInput, setUserInput] = useState<number[]>([]);
   const sequenceRef = useRef<number[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Image Recall, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback((round: number): number => {
      // Default: rounds 1-4: 3x3, 5-8: 5x5, 9-10: 6x6
      if (round >= 1 && round <= 4) {
         return 3;
      } else if (round >= 5 && round <= 8) {
         return 5;
      } else {
         return 6;
      }
   }, []);

   // Get grid size from config or calculate from round
   const gridSize = useMemo(() => {
      if (
         config.gridSizes &&
         Array.isArray(config.gridSizes) &&
         config.gridSizes.length > 0
      ) {
         // Use round index, but if array is shorter than rounds, use last element or fallback
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (typeof size === "number") {
            return size;
         }
         if (Array.isArray(size)) {
            return size[0]; // Use first dimension for square grids
         }
      }
      // Fallback to default grid size calculation
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   // Image emojis - enough for 6x6 grid (36 total)
   const IMAGES = useMemo(
      () => [
         "🧩",
         "🚀",
         "🌙",
         "🍎",
         "🎵",
         "📦",
         "⭐",
         "🐶",
         "🏀",
         "🔥",
         "🎲",
         "📌",
         "🎨",
         "🎯",
         "🎪",
         "🎭",
         "🎬",
         "🎤",
         "🎧",
         "🎮",
         "🦄",
         "🐱",
         "🐼",
         "🦁",
         "🐯",
         "🐸",
         "🐰",
         "🐻",
         "🐨",
         "🐷",
         "🦊",
         "🐺",
         "🐝",
         "🦋",
         "🐢",
         "🐠",
      ],
      []
   );

   // Get images for current grid size
   const currentImages = useMemo(() => {
      const totalCells = gridSize * gridSize;
      return IMAGES.slice(0, totalCells);
   }, [gridSize, IMAGES]);

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
         await registerShare(shareId, "image-recall");
         const gameKey = "play50games_shared_image-recall";
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
            const gameKey = "play50games_shared_image-recall";
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
                  const gameKey = "play50games_shared_image-recall";
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
                  const gameKey = "play50games_shared_image-recall";
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
      const gameKey = "play50games_shared_image-recall";
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
               // If already shared and not expired, activate unlimited hints
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  // Set timeout to expire after remaining time
                  const remainingTime = data.expiry - Date.now();
                  if (remainingTime > 0) {
                     setTimeout(() => {
                        setUnlimitedActivated(false);
                        setHasShared(false);
                        localStorage.removeItem(gameKey);
                     }, remainingTime);
                  }
               }
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
               title: "Image Recall Game",
               text: "Check out this awesome Image Recall game!",
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
      if (sequence.length === 0) return;

      // Find the first position in sequence that hasn't been revealed yet
      const allPositions = sequence.map((_, idx) => idx); // [0, 1, 2, ...]
      const unrevealedPositions = allPositions.filter(
         (pos) => !hintRevealed.includes(pos)
      );

      if (unrevealedPositions.length > 0) {
         // Reveal the first unrevealed position
         const nextPosition = unrevealedPositions[0];
         setHintRevealed([...hintRevealed, nextPosition]);
         setHintsUsed(hintsUsed + 1);
      }
   };

   // Start round
   const startRound = useCallback(() => {
      // Sequence length: scales with grid size and round
      // 3x3: 2-4, 5x5: 3-6, 6x6: 4-8
      const baseLength = Math.max(2, Math.floor(gridSize / 2));
      const maxLength = Math.min(gridSize + 1, 8);
      const sequenceLength = Math.min(
         baseLength + Math.floor((currentRound + 1) / 2),
         maxLength
      );

      // Pick distinct images for sequence (no duplicates)
      const available = [...Array(currentImages.length).keys()].sort(
         () => Math.random() - 0.5
      );
      const newSequence = available.slice(0, sequenceLength);

      setSequence(newSequence);
      setUserInput([]);
      setGameState("memorizing");
      setFeedback(null);
      setHintRevealed([]);
      setSelectedCellIndex(null);

      // Show sequence with flashes
      let flashIndex = 0;
      const flashInterval = setInterval(() => {
         if (flashIndex < newSequence.length) {
            flashIndex++;
         } else {
            clearInterval(flashInterval);
            // Hide after sequence
            setTimeout(() => {
               setGameState("input");
            }, 250);
         }
      }, 650);

      // Cleanup
      return () => clearInterval(flashInterval);
   }, [currentRound, gridSize, currentImages.length]);

   // Start first round
   useEffect(() => {
      if (currentRound < maxRounds) {
         startRound();
      }
   }, [currentRound, maxRounds, startRound]);

   // Check game completion
   useEffect(() => {
      if (currentRound >= maxRounds) {
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

   // Selected cell for keyboard navigation
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );

   // Handle card click
   const handleCardClick = (idx: number) => {
      if (gameState !== "input") return;
      if (userInput.includes(idx)) return; // Already selected

      const newInput = [...userInput, idx];
      setUserInput(newInput);

      // Check if correct
      const step = newInput.length - 1;
      if (newInput[step] !== sequence[step]) {
         // Wrong answer
         setGameState("wrong");
         setFeedback("wrong");

         // Show correct sequence briefly
         setTimeout(() => {
            setFeedback(null);
            setUserInput([]);
            setGameState("input");
            setSelectedCellIndex(null);
         }, 2000);
         return;
      }

      // Correct step
      if (newInput.length === sequence.length) {
         // All correct - round complete
         const roundScore = Math.round(100 / maxRounds);
         const newScore = Math.min(currentScore + roundScore, 100);
         setCurrentScore(newScore);
         setGameState("correct");
         setFeedback("correct");
         setTimeout(() => {
            onScoreUpdate(newScore);
         }, 0);

         setTimeout(() => {
            setFeedback(null);
            setCurrentRound(currentRound + 1);
            setSelectedCellIndex(null);
         }, 1500);
      }
   };

   // Keyboard controls for Image Recall
   useEffect(() => {
      if (gameState !== "input") {
         setSelectedCellIndex(null);
         return;
      }

      const handleKeyPress = (e: KeyboardEvent) => {
         if (gameState !== "input") return;

         const key = e.key;
         const keyLower = key.toLowerCase();
         const totalCells = currentImages.length;

         // Number keys: Direct selection by position (1-9, 0, -, =)
         let position = -1;
         if (key >= "1" && key <= "9") {
            position = parseInt(key) - 1; // 1-9 → 0-8
         } else if (key === "0" && totalCells > 9) {
            position = 9; // 0 → position 10 (index 9)
         } else if (key === "-" && totalCells > 10) {
            position = 10; // - → position 11 (index 10)
         } else if (key === "=" && totalCells > 11) {
            position = 11; // = → position 12 (index 11)
         }

         // Direct selection with number keys
         if (position >= 0 && position < totalCells) {
            e.preventDefault();
            if (!userInput.includes(position)) {
               handleCardClick(position);
            }
            return;
         }

         // Arrow keys or WASD: Navigate and select
         if (selectedCellIndex === null) {
            // Initialize selection at first available cell
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
                  if (!userInput.includes(i)) {
                     setSelectedCellIndex(i);
                     return;
                  }
               }
            }
            return;
         }

         // Navigate with arrow keys
         let newIndex = selectedCellIndex;
         const currentRow = Math.floor(selectedCellIndex / gridSize);
         const currentCol = selectedCellIndex % gridSize;

         switch (key) {
            case "ArrowUp":
            case "w":
               e.preventDefault();
               if (currentRow > 0) {
                  newIndex = selectedCellIndex - gridSize;
               }
               break;
            case "ArrowDown":
            case "s":
               e.preventDefault();
               if (currentRow < gridSize - 1) {
                  newIndex = selectedCellIndex + gridSize;
               }
               break;
            case "ArrowLeft":
            case "a":
               e.preventDefault();
               if (currentCol > 0) {
                  newIndex = selectedCellIndex - 1;
               }
               break;
            case "ArrowRight":
            case "d":
               e.preventDefault();
               if (currentCol < gridSize - 1) {
                  newIndex = selectedCellIndex + 1;
               }
               break;
            case "Enter":
            case " ":
               e.preventDefault();
               if (!userInput.includes(selectedCellIndex)) {
                  handleCardClick(selectedCellIndex);
               }
               return;
         }

         // Update selected cell index (wrap around if needed)
         if (newIndex !== selectedCellIndex) {
            if (newIndex < 0) newIndex = totalCells - 1;
            if (newIndex >= totalCells) newIndex = 0;
            setSelectedCellIndex(newIndex);
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedCellIndex,
      gridSize,
      currentImages.length,
      userInput,
      handleCardClick,
   ]);

   // Flash card animation
   const flashCard = (idx: number) => {
      const card = document.querySelector(
         `.image-card[data-idx="${idx}"]`
      ) as HTMLElement;
      if (card) {
         card.classList.add("flash");
         setTimeout(() => card.classList.remove("flash"), 320);
      }
   };

   // Show sequence with flashes
   useEffect(() => {
      if (gameState === "memorizing" && sequence.length > 0) {
         sequence.forEach((idx, i) => {
            setTimeout(() => flashCard(idx), 600 + i * 650);
         });
      }
   }, [gameState, sequence]);

   const progress = ((currentRound + 1) / maxRounds) * 100;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "20px" : "24px",
            padding: isMobile ? "12px" : "24px",
            maxWidth: isMobile ? "100%" : "700px",
            margin: "0 auto",
            width: "100%",
         }}
      >
         {/* Header with Round and Score */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
            }}
         >
            {/* Game Title - Image Recall */}
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: isMobile ? "8px" : "10px",
                  marginBottom: isMobile ? "12px" : "16px",
                  paddingBottom: isMobile ? "12px" : "16px",
                  borderBottom: "1px solid var(--stroke)",
               }}
            >
               <PhotoIcon
                  style={{
                     width: isMobile ? 24 : 28,
                     height: isMobile ? 24 : 28,
                     color: "var(--accent)",
                  }}
               />
               <h2
                  style={{
                     margin: 0,
                     fontSize: isMobile ? "1.25rem" : "1.5rem",
                     fontWeight: 700,
                     background:
                        "linear-gradient(135deg, var(--accent) 0%, var(--ok) 100%)",
                     WebkitBackgroundClip: "text",
                     WebkitTextFillColor: "transparent",
                     backgroundClip: "text",
                     textShadow: "0 2px 8px rgba(125, 211, 252, 0.3)",
                  }}
               >
                  Image Recall
               </h2>
               <SparklesIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--ok)",
                  }}
               />
            </div>
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </span>
               <span
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
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
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
               >
                  <LightBulbIcon
                     style={{
                        width: isMobile ? 14 : 16,
                        height: isMobile ? 14 : 16,
                        color: "var(--accent)",
                     }}
                  />
                  Hints:{" "}
                  {maxHints === 0 ? "∞" : `${maxHints - hintsUsed}/${maxHints}`}
               </span>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: isMobile ? "3px" : "4px",
                  overflow: "hidden",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: isMobile ? "3px" : "4px",
                     transition: "width 0.3s ease",
                     boxShadow: "0 0 10px rgba(125, 211, 252, 0.5)",
                  }}
               />
            </div>
         </div>

         {/* Game State Display */}
         <div
            style={{
               width: "100%",
               background: "var(--card)",
               border: "1px solid var(--stroke)",
               borderRadius: isMobile ? "14px" : "16px",
               padding: isMobile ? "16px" : "20px",
               textAlign: "center",
            }}
         >
            <div style={{ marginBottom: isMobile ? "10px" : "16px" }}>
               <b
                  style={{
                     fontSize: isMobile ? "0.95rem" : "1.125rem",
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: isMobile ? "6px" : "8px",
                     flexWrap: "wrap",
                  }}
               >
                  {gameState === "memorizing" && "Watch the sequence…"}
                  {gameState === "input" && "Now click in the same order"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--ok)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--warn)",
                           }}
                        />
                        Wrong! Try again
                     </>
                  )}
               </b>
            </div>
            <div
               style={{
                  fontSize: isMobile ? "0.75rem" : "0.875rem",
                  color: "var(--muted)",
               }}
            >
               {gameState === "memorizing" &&
                  "After it disappears, click in the same order"}
               {gameState === "input" && "Click the images in order"}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "14px 20px" : "16px 24px",
                  borderRadius: isMobile ? "12px" : "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  width: "100%",
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

         {/* Image Grid (dynamic size) */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
               gap: isMobile
                  ? "8px"
                  : gridSize <= 3
                  ? "14px"
                  : gridSize <= 5
                  ? "10px"
                  : "8px",
               width: "100%",
               maxWidth: isMobile
                  ? "100%"
                  : gridSize <= 3
                  ? "400px"
                  : gridSize <= 5
                  ? "500px"
                  : "600px",
            }}
         >
            {currentImages.map((emoji, idx) => {
               const isInSequence = sequence.includes(idx);
               const isSelected = userInput.includes(idx);
               const isHinted = hintRevealed.some(
                  (hintIdx) => sequence[hintIdx] === idx
               );
               const isVisible =
                  gameState === "memorizing" ||
                  isSelected ||
                  isHinted ||
                  (gameState === "wrong" && isInSequence);
               const orderInSequence = sequence.indexOf(idx);
               const orderInInput = userInput.indexOf(idx);
               const isCorrect = isSelected && orderInInput === orderInSequence;
               const isWrong = isSelected && orderInInput !== orderInSequence;

               return (
                  <button
                     key={idx}
                     className="image-card"
                     data-idx={idx}
                     onClick={() => handleCardClick(idx)}
                     disabled={gameState !== "input" || isSelected}
                     style={{
                        width: "100%",
                        aspectRatio: "1",
                        borderRadius: isMobile ? "14px" : "18px",
                        border: `${
                           gameState === "memorizing" && isInSequence
                              ? "3px solid rgba(110, 168, 255, 1)"
                              : isCorrect
                              ? "2px solid rgba(54, 211, 153, 0.6)"
                              : isWrong
                              ? "2px solid rgba(251, 113, 133, 0.6)"
                              : isSelected
                              ? "2px solid rgba(110, 168, 255, 0.6)"
                              : selectedCellIndex === idx
                              ? "2px solid rgba(251, 191, 36, 0.8)"
                              : "2px solid rgba(255, 255, 255, 0.1)"
                        }`,
                           outline:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px solid rgba(251, 191, 36, 0.5)"
                                 : "none",
                           outlineOffset:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px"
                                 : "0",
                        background:
                           gameState === "memorizing" && isInSequence
                              ? "linear-gradient(135deg, rgba(110, 168, 255, 0.4), rgba(110, 168, 255, 0.25))"
                              : isSelected
                              ? "linear-gradient(135deg, rgba(110, 168, 255, 0.2), rgba(110, 168, 255, 0.1))"
                              : selectedCellIndex === idx && !isSelected
                              ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.08))"
                              : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                        boxShadow:
                           gameState === "memorizing" && isInSequence
                              ? "0 0 30px rgba(110, 168, 255, 0.6), 0 0 50px rgba(110, 168, 255, 0.4), inset 0 0 15px rgba(110, 168, 255, 0.2)"
                              : isCorrect || isWrong
                              ? `0 10px 24px ${
                                   isCorrect
                                      ? "rgba(54, 211, 153, 0.18)"
                                      : "rgba(251, 113, 133, 0.18)"
                                }`
                              : "0 10px 18px rgba(0, 0, 0, 0.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isMobile
                           ? gridSize <= 3
                              ? "36px"
                              : gridSize <= 5
                              ? "28px"
                              : "24px"
                           : gridSize <= 3
                           ? "42px"
                           : gridSize <= 5
                           ? "32px"
                           : "28px",
                        cursor:
                           gameState === "input" && !isSelected
                              ? "pointer"
                              : "not-allowed",
                        userSelect: "none",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.15s",
                        opacity: isVisible ? 1 : 0.3,
                        transform:
                           gameState === "memorizing" && isInSequence
                              ? "scale(1.05)"
                              : "scale(1)",
                        zIndex:
                           gameState === "memorizing" && isInSequence ? 5 : 1,
                     }}
                  >
                     {isVisible ? emoji : "?"}
                     {isSelected && (
                        <div
                           style={{
                              position: "absolute",
                              right: isMobile ? "8px" : "10px",
                              top: isMobile ? "8px" : "10px",
                              width: isMobile ? "24px" : "28px",
                              height: isMobile ? "24px" : "28px",
                              borderRadius: "999px",
                              background: "rgba(15, 27, 51, 0.8)",
                              border: "1px solid rgba(255, 255, 255, 0.12)",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              fontSize: isMobile ? "11px" : "12px",
                              color: "rgba(232, 238, 252, 0.95)",
                              zIndex: 2,
                           }}
                        >
                           {orderInInput + 1}
                        </div>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Action Buttons: Hint, Share */}
         <div
            style={{
               width: "100%",
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               padding: isMobile ? "0 8px" : "0",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
            }}
         >
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

            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  gameState !== "input" ||
                  hintRevealed.length >= sequence.length
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
                  border:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "1px solid rgba(100, 100, 100, 0.4)"
                        : "1px solid rgba(251, 191, 36, 0.6)",
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < sequence.length
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
                     hintRevealed.length < sequence.length
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
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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
      </div>
   );
}

// Path Memory Game (21) - Modern version
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
               // If already shared and not expired, activate unlimited hints
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  // Set timeout to expire after remaining time
                  const remainingTime = data.expiry - Date.now();
                  if (remainingTime > 0) {
                     setTimeout(() => {
                        setUnlimitedActivated(false);
                        setHasShared(false);
                        localStorage.removeItem(gameKey);
                     }, remainingTime);
                  }
               }
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

// Word Memory Game (21) - Modern version
function WordMemory({
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
   const maxRounds = config.rounds || 10;
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
   const [flashingWordIndex, setFlashingWordIndex] = useState<number | null>(
      null
   );
   const [flashedWords, setFlashedWords] = useState<Set<number>>(new Set());
   const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
      null
   );
   const sequenceRef = useRef<number[]>([]);
   const currentScoreRef = useRef<number>(0);
   const startedRoundRef = useRef<number | null>(null);
   const flashTimeoutsRef = useRef<number[]>([]);
   const inputTimeoutRef = useRef<number | null>(null);
   const isRoundCompletingRef = useRef<boolean>(false);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Word Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Get grid size based on round (from backend config)
   const getGridSizeForRound = useCallback((round: number): number => {
      // Default: rounds 1-4: 3x3, 5-8: 5x5, 9-10: 6x6
      if (round >= 1 && round <= 4) {
         return 3;
      } else if (round >= 5 && round <= 8) {
         return 5;
      } else {
         return 6;
      }
   }, []);

   // Get grid size from config or calculate from round
   const gridSize = useMemo(() => {
      if (
         config.gridSizes &&
         Array.isArray(config.gridSizes) &&
         config.gridSizes.length > 0
      ) {
         const roundIndex = Math.min(currentRound, config.gridSizes.length - 1);
         const size = config.gridSizes[roundIndex];
         if (typeof size === "number") {
            return size;
         }
         if (Array.isArray(size)) {
            return size[0]; // Use first dimension for square grids
         }
      }
      return getGridSizeForRound(currentRound + 1);
   }, [config.gridSizes, currentRound, getGridSizeForRound]);

   // Word pool - enough for 6x6 grid (36 total)
   const WORDS = useMemo(
      () => [
         "Apple",
         "Beach",
         "Cloud",
         "Dance",
         "Earth",
         "Flame",
         "Green",
         "Happy",
         "Image",
         "Jewel",
         "Knife",
         "Light",
         "Magic",
         "Night",
         "Ocean",
         "Peace",
         "Queen",
         "River",
         "Smile",
         "Tiger",
         "Unity",
         "Voice",
         "Water",
         "Xenon",
         "Youth",
         "Zenith",
         "Arrow",
         "Brave",
         "Crown",
         "Dream",
         "Eagle",
         "Frost",
         "Glory",
         "Honey",
         "Ideal",
         "Jolly",
      ],
      []
   );

   // Get words for current grid size
   const currentWords = useMemo(() => {
      const totalCells = gridSize * gridSize;
      // Shuffle and take first totalCells words
      const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, totalCells);
   }, [gridSize, WORDS]);

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
         await registerShare(shareId, "word-memory");
         const gameKey = "play50games_shared_word-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   const handleShare = async () => {
      if (navigator.share) {
         try {
            const shareLink = getShareableLink();
            await navigator.share({
               title: "Word Memory - Play50Games",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareLink.split("shared=")[1]);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // User cancelled or error
         }
      } else {
         // Fallback to clipboard
         const shareLink = getShareableLink();
         await navigator.clipboard.writeText(shareLink);
         await registerShareLink(shareLink.split("shared=")[1]);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      }
   };

   // Check share status for unlimited hints
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
            const gameKey = "play50games_shared_word-memory";
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
                  const gameKey = "play50games_shared_word-memory";
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
                  const gameKey = "play50games_shared_word-memory";
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
      const gameKey = "play50games_shared_word-memory";
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
               // If already shared and not expired, activate unlimited hints
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  // Set timeout to expire after remaining time
                  const remainingTime = data.expiry - Date.now();
                  if (remainingTime > 0) {
                     setTimeout(() => {
                        setUnlimitedActivated(false);
                        setHasShared(false);
                        localStorage.removeItem(gameKey);
                     }, remainingTime);
                  }
               }
            }
         } catch (error) {
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

   // Start new round
   const clearSequenceTimers = useCallback(() => {
      flashTimeoutsRef.current.forEach((timeoutId) =>
         window.clearTimeout(timeoutId)
      );
      flashTimeoutsRef.current = [];
      if (inputTimeoutRef.current !== null) {
         window.clearTimeout(inputTimeoutRef.current);
         inputTimeoutRef.current = null;
      }
   }, []);

   const flashSequence = useCallback(
      (sequenceToFlash: number[]) => {
         clearSequenceTimers();
         setGameState("memorizing");
         setFeedback(null);
         setUserInput([]);
         setHintRevealed([]);
         setFlashingWordIndex(null);
         setSelectedCellIndex(null);
         setFlashedWords(new Set());

         sequenceToFlash.forEach((wordIndex, i) => {
            const startTimeoutId = window.setTimeout(() => {
               setFlashedWords((prev) => new Set([...prev, wordIndex]));
               setFlashingWordIndex(wordIndex);
               const endTimeoutId = window.setTimeout(() => {
                  setFlashingWordIndex(null);
               }, 600);
               flashTimeoutsRef.current.push(endTimeoutId);
            }, 800 + i * 600);
            flashTimeoutsRef.current.push(startTimeoutId);
         });

         inputTimeoutRef.current = window.setTimeout(() => {
            setGameState("input");
         }, 800 + sequenceToFlash.length * 600 + 300);
      },
      [clearSequenceTimers]
   );

   const startNewRound = useCallback(() => {
      if (startedRoundRef.current === currentRound) {
         return;
      }
      startedRoundRef.current = currentRound;
      // Clear any pending timers first to prevent old sequences from playing
      clearSequenceTimers();

      // Reset the completing flag when starting a new round
      isRoundCompletingRef.current = false;

      // Calculate sequence length: 2 + Math.floor(round / 2) (min 2, max 7)
      const sequenceLength = Math.min(
         2 + Math.floor((currentRound + 1) / 2),
         7
      );

      // Generate random sequence of word indices
      const newSequence: number[] = [];
      const usedIndices = new Set<number>();
      while (newSequence.length < sequenceLength) {
         const randomIndex = Math.floor(Math.random() * currentWords.length);
         if (!usedIndices.has(randomIndex)) {
            newSequence.push(randomIndex);
            usedIndices.add(randomIndex);
         }
      }
      setSequence(newSequence);
      sequenceRef.current = newSequence;

      flashSequence(newSequence);
   }, [
      currentRound,
      currentWords,
      flashSequence,
      maxRounds,
      clearSequenceTimers,
   ]);

   const replaySequence = useCallback(() => {
      if (sequenceRef.current.length === 0) return;
      flashSequence(sequenceRef.current);
   }, [flashSequence]);

   useEffect(() => {
      return () => {
         clearSequenceTimers();
      };
   }, [clearSequenceTimers]);

   useEffect(() => {
      currentScoreRef.current = currentScore;
   }, [currentScore]);

   // Start round when currentRound changes (only if not completing a round)
   useEffect(() => {
      if (currentRound < maxRounds && !isRoundCompletingRef.current) {
         // Clear any pending timers first to prevent old sequences from playing
         clearSequenceTimers();
         // Add a small delay to ensure smooth transition after complete notification
         const timer = setTimeout(() => {
            startNewRound();
         }, 500);
         return () => clearTimeout(timer);
      } else if (currentRound >= maxRounds) {
         // Game completed
         clearSequenceTimers();
         setTimeout(() => {
            onComplete(currentScoreRef.current);
         }, 1000);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentRound, maxRounds, onComplete, clearSequenceTimers]);

   // Handle word click
   const handleWordClick = useCallback(
      (wordIndex: number) => {
         if (gameState !== "input") return;
         if (userInput.includes(wordIndex)) return; // Already selected

         const newInput = [...userInput, wordIndex];
         setUserInput(newInput);

         // Check if correct
         if (newInput.length <= sequence.length) {
            if (
               newInput[newInput.length - 1] === sequence[newInput.length - 1]
            ) {
               // Correct so far
               if (newInput.length === sequence.length) {
                  // All correct!
                  setGameState("correct");
                  setFeedback("correct");
                  const newScore = Math.round(
                     ((currentRound + 1) / maxRounds) * 100
                  );
                  setCurrentScore(newScore);
                  setTimeout(() => {
                     onScoreUpdate(newScore);
                  }, 0);

                  setTimeout(() => {
                     // Show complete notification for 2 seconds, then clear feedback
                     setFeedback(null);
                     isRoundCompletingRef.current = true; // Mark that round is completing
                     // Clear any pending sequence timers to prevent old sequence from playing
                     clearSequenceTimers();
                     setTimeout(() => {
                        // Wait another 1 second before starting next round
                        if (currentRound + 1 < maxRounds) {
                           // Reset flag just before changing round so useEffect can trigger startNewRound
                           isRoundCompletingRef.current = false;
                           setCurrentRound(currentRound + 1);
                        } else {
                           // Last round completed
                           isRoundCompletingRef.current = false;
                           setTimeout(() => {
                              onComplete(newScore);
                           }, 1000);
                        }
                     }, 1500);
                  }, 2000);
               }
            } else {
               // Wrong - allow retry without replaying sequence
               setGameState("wrong");
               setFeedback("wrong");
               setTimeout(() => {
                  // Reset for retry - don't replay sequence, just allow input again
                  setFeedback(null);
                  setUserInput([]);
                  setGameState("input");
                  setHintRevealed([]);
               }, 1500);
            }
         }
      },
      [
         gameState,
         userInput,
         sequence,
         currentRound,
         maxRounds,
         onScoreUpdate,
         onComplete,
      ]
   );

   // Handle hint button click
   const handleHint = () => {
      if (maxHints > 0 && hintsUsed >= maxHints) return;
      if (gameState !== "input") return;
      if (sequence.length === 0) return;

      // Find the next position in sequence that needs to be revealed
      // Consider both: positions already revealed by hints AND positions already clicked by user
      const lastClickedIndex = userInput.length - 1; // Last clicked position in sequence
      const lastRevealedHint =
         hintRevealed.length > 0 ? Math.max(...hintRevealed) : -1; // Last revealed hint position

      // Next position should be after both the last clicked and last revealed hint
      const nextPositionIndex = Math.max(
         lastClickedIndex + 1,
         lastRevealedHint + 1
      );

      if (nextPositionIndex < sequence.length) {
         // Check if this position hasn't been revealed yet
         if (!hintRevealed.includes(nextPositionIndex)) {
            setHintRevealed([...hintRevealed, nextPositionIndex]);
            setHintsUsed(hintsUsed + 1);
         }
      }
   };

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         const totalCells = gridSize * gridSize;

         // Direct selection with number keys (1-9, 0, -, =)
         if (e.key >= "1" && e.key <= "9") {
            const num = parseInt(e.key);
            if (num <= totalCells) {
               e.preventDefault();
               const wordIndex = num - 1;
               if (!userInput.includes(wordIndex)) {
                  handleWordClick(wordIndex);
               }
            }
            return;
         }

         if (e.key === "0" && totalCells >= 10) {
            e.preventDefault();
            const wordIndex = 9;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         if (e.key === "-" && totalCells >= 11) {
            e.preventDefault();
            const wordIndex = 10;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         if (e.key === "=" && totalCells >= 12) {
            e.preventDefault();
            const wordIndex = 11;
            if (!userInput.includes(wordIndex)) {
               handleWordClick(wordIndex);
            }
            return;
         }

         // Navigation with arrow keys or WASD
         if (selectedCellIndex === null) {
            setSelectedCellIndex(0);
            return;
         }

         const idxToRC = (idx: number) => ({
            r: Math.floor(idx / gridSize),
            c: idx % gridSize,
         });
         const rcToIdx = (r: number, c: number) => r * gridSize + c;

         const { r, c } = idxToRC(selectedCellIndex);
         let newIndex = selectedCellIndex;

         switch (e.key) {
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
               if (!userInput.includes(selectedCellIndex)) {
                  handleWordClick(selectedCellIndex);
               }
               return;
         }

         if (
            newIndex !== selectedCellIndex &&
            newIndex >= 0 &&
            newIndex < totalCells
         ) {
            if (!userInput.includes(newIndex)) {
               setSelectedCellIndex(newIndex);
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [gameState, selectedCellIndex, gridSize, userInput, handleWordClick]);

   const completedRounds = currentRound;
   const sequenceLength = sequence.length;

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            padding: isMobile ? "16px" : "24px",
            maxWidth: "1200px",
            margin: "0 auto",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               flexWrap: "wrap",
               gap: isMobile ? "12px" : "16px",
               padding: isMobile ? "12px 16px" : "16px 20px",
               background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))",
               borderRadius: "16px",
               border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
         >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
               <ArrowPathIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--accent)",
                  }}
               />
               <span style={{ fontSize: isMobile ? "0.9rem" : "1rem" }}>
                  Round {currentRound + 1} / {maxRounds}
               </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
               <TrophyIcon
                  style={{
                     width: isMobile ? 20 : 24,
                     height: isMobile ? 20 : 24,
                     color: "var(--ok)",
                  }}
               />
               <span style={{ fontSize: isMobile ? "0.9rem" : "1rem" }}>
                  Score: {currentScore} / 100
               </span>
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
                     "linear-gradient(90deg, var(--accent), var(--ok))",
                  transition: "width 0.3s ease",
               }}
            />
         </div>

         {/* Game State Display */}
         <div
            style={{
               padding: isMobile ? "14px 18px" : "16px 24px",
               borderRadius: "12px",
               background: "rgba(15, 27, 51, 0.5)",
               border: "1px solid rgba(255, 255, 255, 0.1)",
               display: "flex",
               justifyContent: "space-between",
               alignItems: "center",
               flexWrap: "wrap",
               gap: "12px",
            }}
         >
            <div>
               <div
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 600,
                     marginBottom: "4px",
                  }}
               >
                  {gameState === "memorizing" && "Watch the words flash…"}
                  {gameState === "input" && "Your turn: Click words in order"}
                  {gameState === "correct" && "Correct! Great job!"}
                  {gameState === "wrong" && "Try again! You can do it!"}
               </div>
               <div
                  style={{
                     fontSize: isMobile ? "0.85rem" : "0.9rem",
                     color: "var(--muted)",
                  }}
               >
                  {gameState === "memorizing" &&
                     `Sequence length: ${sequenceLength}`}
                  {gameState === "input" &&
                     `Click ${sequenceLength} words in the order they appeared`}
               </div>
            </div>
            <div
               style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background:
                     gameState === "correct"
                        ? "rgba(134, 239, 172, 0.2)"
                        : gameState === "wrong"
                        ? "rgba(252, 165, 165, 0.2)"
                        : "rgba(59, 130, 246, 0.2)",
                  border: `1px solid ${
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--accent)"
                  }`,
                  color:
                     gameState === "correct"
                        ? "var(--ok)"
                        : gameState === "wrong"
                        ? "var(--warn)"
                        : "var(--accent)",
                  fontSize: isMobile ? "0.8rem" : "0.85rem",
                  fontWeight: 600,
               }}
            >
               {gameState === "memorizing" && "Memorizing"}
               {gameState === "input" && "Your Turn"}
               {gameState === "correct" && "Correct"}
               {gameState === "wrong" && "Wrong"}
            </div>
         </div>

         {/* Word Grid */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
               gap: isMobile ? "10px" : "12px",
               maxWidth: isMobile ? "100%" : "700px",
               margin: "0 auto",
               width: "100%",
            }}
         >
            {currentWords.map((word, index) => {
               const isFlashing = flashingWordIndex === index;
               const isSelected = userInput.includes(index);
               // Check if this word index is revealed by any hint position
               // hintRevealed contains positions in sequence array (0, 1, 2, ...)
               // sequence[hintPos] gives the word index at that position
               const isHintRevealed = hintRevealed.some(
                  (hintPos) => sequence[hintPos] === index
               );
               const isHighlighted = selectedCellIndex === index;
               const orderInSequence = sequence.indexOf(index);
               const showOrder = isSelected && orderInSequence !== -1;
               // In memorizing phase, show all words that have been flashed so far
               const isInSequence = sequence.includes(index);
               // A word has been flashed if it's in the sequence AND in the flashedWords set
               const hasBeenFlashed =
                  gameState === "memorizing" &&
                  isInSequence &&
                  flashedWords.has(index);
               const showMemorizeOrder =
                  gameState === "memorizing" &&
                  hasBeenFlashed &&
                  orderInSequence !== -1;
               // Find which hint position revealed this word (to show order number)
               // hintRevealed contains positions in sequence (0, 1, 2, ...)
               // We need to find which position in hintRevealed corresponds to this word
               // Then use that position to get the order in sequence
               const hintRevealedPosition = hintRevealed.findIndex(
                  (hintPos) => sequence[hintPos] === index
               );
               // The order in sequence is the actual position in hintRevealed
               const hintOrder =
                  hintRevealedPosition !== -1
                     ? hintRevealed[hintRevealedPosition]
                     : -1;

               return (
                  <div
                     key={index}
                     onClick={() => handleWordClick(index)}
                     style={{
                        padding: isMobile ? "16px 12px" : "20px 16px",
                        borderRadius: "12px",
                        border: `2px solid ${
                           isFlashing
                              ? "rgba(59, 130, 246, 0.8)"
                              : hasBeenFlashed && !isFlashing
                              ? "rgba(59, 130, 246, 0.6)"
                              : isSelected
                              ? "rgba(134, 239, 172, 0.6)"
                              : isHintRevealed
                              ? "rgba(147, 51, 234, 0.6)"
                              : isHighlighted
                              ? "rgba(59, 130, 246, 0.5)"
                              : "rgba(255, 255, 255, 0.1)"
                        }`,
                        background: isFlashing
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.2))"
                           : hasBeenFlashed && !isFlashing
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                           : isSelected
                           ? "linear-gradient(135deg, rgba(134, 239, 172, 0.2), rgba(134, 239, 172, 0.1))"
                           : isHintRevealed
                           ? "linear-gradient(135deg, rgba(147, 51, 234, 0.2), rgba(147, 51, 234, 0.1))"
                           : isHighlighted
                           ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))"
                           : "rgba(15, 27, 51, 0.5)",
                        boxShadow: isFlashing
                           ? "0 0 20px rgba(59, 130, 246, 0.5), 0 4px 12px rgba(0, 0, 0, 0.3)"
                           : hasBeenFlashed && !isFlashing
                           ? "0 0 10px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)"
                           : isSelected
                           ? "0 4px 12px rgba(134, 239, 172, 0.3)"
                           : "none",
                        cursor: gameState === "input" ? "pointer" : "default",
                        transition: "all 0.2s ease",
                        position: "relative",
                        transform: isFlashing
                           ? "scale(1.05)"
                           : hasBeenFlashed
                           ? "scale(1.02)"
                           : "scale(1)",
                        textAlign: "center",
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        userSelect: "none",
                     }}
                     onMouseEnter={(e) => {
                        if (gameState === "input" && !isSelected) {
                           e.currentTarget.style.background =
                              "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))";
                           e.currentTarget.style.borderColor =
                              "rgba(59, 130, 246, 0.6)";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (gameState === "input" && !isSelected) {
                           e.currentTarget.style.background =
                              "rgba(15, 27, 51, 0.5)";
                           e.currentTarget.style.borderColor =
                              "rgba(255, 255, 255, 0.1)";
                        }
                     }}
                  >
                     {word}
                     {showMemorizeOrder && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              width: isMobile ? "22px" : "24px",
                              height: isMobile ? "22px" : "24px",
                              borderRadius: "50%",
                              background: "rgba(59, 130, 246, 0.9)",
                              border: "1px solid rgba(59, 130, 246, 1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "0.7rem" : "0.75rem",
                              fontWeight: 700,
                              color: "#ffffff",
                              boxShadow: "0 2px 8px rgba(59, 130, 246, 0.4)",
                           }}
                        >
                           {orderInSequence + 1}
                        </div>
                     )}
                     {showOrder && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: "var(--ok)",
                              color: "#0b1220",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                           }}
                        >
                           {userInput.indexOf(index) + 1}
                        </div>
                     )}
                     {isHintRevealed && !isSelected && hintOrder !== -1 && (
                        <div
                           style={{
                              position: "absolute",
                              top: "4px",
                              left: "4px",
                              width: isMobile ? "22px" : "24px",
                              height: isMobile ? "22px" : "24px",
                              borderRadius: "50%",
                              background: "rgba(147, 51, 234, 0.9)",
                              border: "1px solid rgba(147, 51, 234, 1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "0.7rem" : "0.75rem",
                              fontWeight: 700,
                              color: "#ffffff",
                              boxShadow: "0 2px 8px rgba(147, 51, 234, 0.4)",
                           }}
                        >
                           {hintOrder + 1}
                        </div>
                     )}
                  </div>
               );
            })}
         </div>

         {/* Hint and Share Buttons */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               justifyContent: "center",
               flexWrap: "wrap",
               width: "100%",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  gameState !== "input" ||
                  hintRevealed.length >= sequence.length
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
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  opacity:
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     gameState !== "input" ||
                     hintRevealed.length >= sequence.length
                        ? 0.5
                        : 1,
                  transition: "all 0.3s ease",
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input" &&
                     hintRevealed.length < sequence.length
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
                     hintRevealed.length < sequence.length
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
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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

         {/* Feedback Message */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",
                  borderRadius: "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "700px",
                  justifyContent: "center",
                  margin: "0 auto",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}
      </div>
   );
}

// Face Memory Game (23) - Modern version
function FaceMemory({
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
   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [facePairs, setFacePairs] = useState<
      Array<{ face: string; name: string }>
   >([]);
   const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
   const [gameState, setGameState] = useState<
      "memorizing" | "input" | "correct" | "wrong"
   >("memorizing");
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);
   const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(
      null
   );
   const [hintRevealed, setHintRevealed] = useState<number[]>([]);

   // Hint functionality
   const [hintsUsed, setHintsUsed] = useState(0);
   const [hasShared, setHasShared] = useState(false);
   const [shareSuccess, setShareSuccess] = useState(false);
   const [unlimitedActivated, setUnlimitedActivated] = useState(false);
   const [currentShareId, setCurrentShareId] = useState<string | null>(null);
   const shareCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Max hints: 10 for Face Memory, unlimited if shared
   const maxHints = hasShared ? 0 : 10; // 0 = unlimited

   // Face pool - enough for 6 faces per round
   const FACES = useMemo(
      () => [
         { face: "😀", name: "Alex" },
         { face: "😎", name: "Sam" },
         { face: "🧑‍🦱", name: "Jordan" },
         { face: "👩‍🦰", name: "Emma" },
         { face: "🧔", name: "Chris" },
         { face: "👩‍🦳", name: "Olivia" },
         { face: "👨‍🦲", name: "Michael" },
         { face: "👩‍🦱", name: "Sophia" },
         { face: "👨", name: "David" },
         { face: "👩", name: "Sarah" },
         { face: "🧑", name: "Taylor" },
         { face: "👨‍🦰", name: "Ryan" },
      ],
      []
   );

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
         await registerShare(shareId, "face-memory");
         const gameKey = "play50games_shared_face-memory";
         localStorage.setItem(gameKey, JSON.stringify({ share_id: shareId }));
         setCurrentShareId(shareId);
      } catch (error) {}
   };

   // Share functionality
   const handleShare = async () => {
      if (navigator.share) {
         try {
            const shareLink = getShareableLink();
            await navigator.share({
               title: "Face Memory - Play50Games",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareLink.split("shared=")[1]);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000);
         } catch (error) {
            // User cancelled or error
         }
      } else {
         // Fallback to clipboard
         const shareLink = getShareableLink();
         await navigator.clipboard.writeText(shareLink);
         await registerShareLink(shareLink.split("shared=")[1]);
         setShareSuccess(true);
         setTimeout(() => setShareSuccess(false), 15000);
      }
   };

   // Check share status for unlimited hints
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
            const gameKey = "play50games_shared_face-memory";
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
                  const gameKey = "play50games_shared_face-memory";
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
                  const gameKey = "play50games_shared_face-memory";
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
      const gameKey = "play50games_shared_face-memory";
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
               // If already shared and not expired, activate unlimited hints
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  // Set timeout to expire after remaining time
                  const remainingTime = data.expiry - Date.now();
                  if (remainingTime > 0) {
                     setTimeout(() => {
                        setUnlimitedActivated(false);
                        setHasShared(false);
                        localStorage.removeItem(gameKey);
                     }, remainingTime);
                  }
               }
            }
         } catch (error) {
            // Invalid data, clean up
            localStorage.removeItem(gameKey);
         }
      }
   }, []);

   // Start new round
   const startNewRound = useCallback(() => {
      // Calculate number of faces: 3 + Math.floor(round / 2) (min 3, max 6)
      const faceCount = Math.min(3 + Math.floor((currentRound + 1) / 2), 6);

      // Shuffle and take first faceCount faces
      const shuffled = [...FACES].sort(() => Math.random() - 0.5);
      const newPairs = shuffled.slice(0, faceCount);

      setFacePairs(newPairs);
      setSelectedFaces([]);
      setHintRevealed([]);
      setSelectedFaceIndex(null);
      setGameState("memorizing");
      setFeedback(null);

      // Show faces for memorization (duration increases with round)
      const showTime = 1800 + currentRound * 200;
      setTimeout(() => {
         setGameState("input");
      }, showTime);
   }, [currentRound, FACES]);

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

   // Handle name selection
   const handleNameSelect = useCallback(
      (name: string, faceIndex: number) => {
         if (gameState !== "input") return;
         if (selectedFaces[faceIndex] === name) return; // Already selected

         const newSelected = [...selectedFaces];
         newSelected[faceIndex] = name;
         setSelectedFaces(newSelected);

         // Check if all faces are matched
         if (
            newSelected.length === facePairs.length &&
            newSelected.every((n) => n)
         ) {
            // All faces matched - check correctness
            const isCorrect = newSelected.every(
               (selectedName, idx) => selectedName === facePairs[idx].name
            );

            if (isCorrect) {
               // Correct!
               setGameState("correct");
               setFeedback("correct");
               setTimeout(() => {
                  setCurrentRound((prev) => prev + 1);
               }, 1500);
            } else {
               // Wrong - show feedback and restart the same round
               setGameState("wrong");
               setFeedback("wrong");
               setTimeout(() => {
                  // Reset for the same round
                  setSelectedFaces([]);
                  setSelectedFaceIndex(null);
                  setFeedback(null);
                  setHintRevealed([]);
                  // Restart the same round by showing faces again
                  setGameState("memorizing");
                  const showTime = 1800 + currentRound * 200;
                  setTimeout(() => {
                     setGameState("input");
                  }, showTime);
               }, 2000);
            }
         }
      },
      [gameState, selectedFaces, facePairs, currentRound]
   );

   // Handle hint
   const handleHint = useCallback(() => {
      if (gameState !== "input") return;
      if (maxHints > 0 && hintsUsed >= maxHints) return;

      // Find first unmatched face
      const unmatchedIndex = facePairs.findIndex(
         (_, idx) => !selectedFaces[idx] && !hintRevealed.includes(idx)
      );

      if (unmatchedIndex !== -1) {
         setHintRevealed((prev) => [...prev, unmatchedIndex]);
         setHintsUsed((prev) => prev + 1);
      }
   }, [gameState, maxHints, hintsUsed, facePairs, selectedFaces, hintRevealed]);

   const completedRounds = currentRound;
   const availableNames = facePairs.map((p) => p.name);

   // Shuffle available names for selection (so they're not in the same order as faces)
   // Shuffle only once when round starts, not on every render
   const [shuffledNames, setShuffledNames] = useState<string[]>([]);

   // Update shuffled names when facePairs change (new round starts)
   useEffect(() => {
      if (facePairs.length > 0) {
         const names = facePairs.map((p) => p.name);
         const shuffled = [...names].sort(() => Math.random() - 0.5);
         setShuffledNames(shuffled);
      }
   }, [facePairs]); // Only when facePairs change (new round starts)

   // Keyboard controls
   useEffect(() => {
      if (gameState !== "input") return;

      const handleKeyPress = (e: KeyboardEvent) => {
         // Prevent default for game controls
         if (
            e.key >= "1" &&
            e.key <= "9" &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
         ) {
            e.preventDefault();
         }
         if (
            (e.key === "ArrowUp" ||
               e.key === "ArrowDown" ||
               e.key === "ArrowLeft" ||
               e.key === "ArrowRight" ||
               e.key === "w" ||
               e.key === "W" ||
               e.key === "s" ||
               e.key === "S" ||
               e.key === "a" ||
               e.key === "A" ||
               e.key === "d" ||
               e.key === "D" ||
               e.key === "Enter" ||
               e.key === " ") &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
         ) {
            e.preventDefault();
         }

         // Numbers 1-6: Direct selection of face and name
         if (e.key >= "1" && e.key <= "6") {
            const keyNumber = parseInt(e.key);
            const index = keyNumber - 1;
            
            if (selectedFaceIndex !== null) {
               // If a face is already selected, select name from available names
               const filteredNames = shuffledNames.filter(
                  (name) =>
                     !selectedFaces.includes(name) ||
                     selectedFaces[selectedFaceIndex] === name
               );
               if (filteredNames.length > 0) {
                  // Use the number to select from available names (1-based)
                  const nameIndex = keyNumber - 1;
                  if (nameIndex < filteredNames.length) {
                     handleNameSelect(filteredNames[nameIndex], selectedFaceIndex);
                  }
               }
            } else {
               // No face selected, select the face with this number
               if (index < facePairs.length) {
                  setSelectedFaceIndex(index);
               }
            }
            return;
         }

         // Navigate faces - Up/Left/W/A
         if (
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "w" ||
            e.key === "W" ||
            e.key === "a" ||
            e.key === "A"
         ) {
            const newIndex =
               selectedFaceIndex !== null
                  ? Math.max(0, selectedFaceIndex - 1)
                  : 0;
            setSelectedFaceIndex(newIndex);
            return;
         }

         // Navigate faces - Down/Right/S/D
         if (
            e.key === "ArrowDown" ||
            e.key === "ArrowRight" ||
            e.key === "s" ||
            e.key === "S" ||
            e.key === "d" ||
            e.key === "D"
         ) {
            const newIndex =
               selectedFaceIndex !== null
                  ? Math.min(facePairs.length - 1, selectedFaceIndex + 1)
                  : 0;
            setSelectedFaceIndex(newIndex);
            return;
         }

         // Enter/Space to cycle through names
         if (e.key === "Enter" || e.key === " ") {
            if (selectedFaceIndex !== null) {
               const filteredNames = shuffledNames.filter(
                  (name) =>
                     !selectedFaces.includes(name) ||
                     selectedFaces[selectedFaceIndex] === name
               );
               if (filteredNames.length > 0) {
                  const currentName = selectedFaces[selectedFaceIndex];
                  const currentIndex = currentName
                     ? filteredNames.indexOf(currentName)
                     : -1;
                  const nextIndex = (currentIndex + 1) % filteredNames.length;
                  handleNameSelect(filteredNames[nextIndex], selectedFaceIndex);
               }
            }
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [
      gameState,
      selectedFaceIndex,
      facePairs,
      selectedFaces,
      handleNameSelect,
      shuffledNames,
   ]);

   const progress = ((currentRound + 1) / maxRounds) * 100;

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
         {/* Header - Same as Rotate to Fit */}
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
                  Face Memory
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
                  <SparklesIcon
                     style={{
                        width: isMobile ? 16 : 18,
                        height: isMobile ? 16 : 18,
                        color: "var(--accent)",
                     }}
                  />
                  <span>Faces: {facePairs.length}</span>
               </div>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
                  background: "var(--stroke)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  marginTop: isMobile ? "4px" : "8px",
               }}
            >
               <div
                  style={{
                     width: `${progress}%`,
                     height: "100%",
                     background:
                        "linear-gradient(90deg, var(--accent) 0%, var(--ok) 100%)",
                     borderRadius: "4px",
                     transition: "width 0.3s",
                     boxShadow: "rgba(125, 211, 252, 0.5) 0px 0px 10px",
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
               gap: isMobile ? "20px" : "24px",
            }}
         >
            {gameState === "memorizing" ? (
               <div
                  style={{
                     textAlign: "center",
                     padding: isMobile ? "16px" : "20px",
                     background:
                        "linear-gradient(135deg, rgba(110, 168, 255, 0.1), rgba(110, 168, 255, 0.05))",
                     border: "2px solid rgba(110, 168, 255, 0.3)",
                     borderRadius: "16px",
                  }}
               >
                  <p
                     style={{
                        margin: 0,
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     Memorize the faces and their names...
                  </p>
               </div>
            ) : (
               <div
                  style={{
                     textAlign: "center",
                     padding: isMobile ? "16px" : "20px",
                     background:
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(251, 191, 36, 0.05))",
                     border: "2px solid rgba(251, 191, 36, 0.3)",
                     borderRadius: "16px",
                  }}
               >
                  <p
                     style={{
                        margin: 0,
                        fontSize: isMobile ? "1rem" : "1.1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                     }}
                  >
                     Match each face with its correct name
                  </p>
               </div>
            )}

            {/* Faces Grid */}
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(
                     facePairs.length,
                     isMobile ? 2 : 3
                  )}, 1fr)`,
                  gap: isMobile ? "16px" : "20px",
                  width: "100%",
               }}
            >
               {facePairs.map((pair, index) => (
                  <div
                     key={index}
                     style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "12px",
                        padding: isMobile ? "16px" : "20px",
                        borderRadius: "16px",
                        border: "2px solid",
                        borderColor:
                           gameState === "memorizing"
                              ? "rgba(110, 168, 255, 0.3)"
                              : selectedFaceIndex === index
                              ? "rgba(59, 130, 246, 0.8)"
                              : hintRevealed.includes(index)
                              ? "rgba(251, 191, 36, 0.6)"
                              : "rgba(255, 255, 255, 0.1)",
                        background:
                           gameState === "memorizing"
                              ? "linear-gradient(135deg, rgba(110, 168, 255, 0.1), rgba(110, 168, 255, 0.05))"
                              : selectedFaceIndex === index
                              ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                              : hintRevealed.includes(index)
                              ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))"
                              : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                        boxShadow:
                           selectedFaceIndex === index
                              ? "0 4px 12px rgba(59, 130, 246, 0.3)"
                              : "0 2px 8px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s",
                        cursor: gameState === "input" ? "pointer" : "default",
                     }}
                     onClick={() => {
                        if (gameState === "input") {
                           setSelectedFaceIndex(index);
                        }
                     }}
                  >
                     <div
                        style={{
                           position: "relative",
                           width: isMobile ? "64px" : "80px",
                           height: isMobile ? "64px" : "80px",
                        }}
                     >
                        <div
                           style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: isMobile ? "32px" : "40px",
                              background:
                                 "linear-gradient(135deg, rgba(15, 27, 51, 0.6), rgba(15, 27, 51, 0.4))",
                              border: "2px solid rgba(255, 255, 255, 0.1)",
                           }}
                        >
                           {pair.face}
                        </div>
                        {gameState === "input" && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "-8px",
                                 right: "-8px",
                                 width: isMobile ? "20px" : "24px",
                                 height: isMobile ? "20px" : "24px",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.7rem" : "0.75rem",
                                 fontWeight: 700,
                                 color: "white",
                                 boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                              }}
                           >
                              {index + 1}
                           </div>
                        )}
                     </div>
                     {gameState === "memorizing" ? (
                        <div
                           style={{
                              fontSize: isMobile ? "0.9rem" : "1rem",
                              fontWeight: 700,
                              color: "var(--text)",
                           }}
                        >
                           {pair.name}
                        </div>
                     ) : (
                        <div
                           style={{
                              fontSize: isMobile ? "0.85rem" : "0.9rem",
                              fontWeight: 600,
                              color: hintRevealed.includes(index)
                                 ? "rgba(251, 191, 36, 0.9)"
                                 : selectedFaces[index]
                                 ? "var(--text)"
                                 : "var(--muted)",
                           }}
                        >
                           {selectedFaces[index] ||
                              (hintRevealed.includes(index) ? pair.name : "?")}
                        </div>
                     )}
                  </div>
               ))}
            </div>

            {/* Name Selection (when in input mode) */}
            {gameState === "input" && (
               <div
                  style={{
                     display: "flex",
                     flexDirection: "column",
                     gap: "12px",
                     width: "100%",
                  }}
               >
                  <p
                     style={{
                        margin: 0,
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        textAlign: "center",
                     }}
                  >
                     {selectedFaceIndex !== null
                        ? `Select name for face ${
                             (selectedFaceIndex ?? 0) + 1
                          } (or press 1-${shuffledNames.filter(
                             (name) =>
                                !selectedFaces.includes(name) ||
                                selectedFaces[selectedFaceIndex] === name
                          ).length}):`
                        : "Press 1-6 to select a face, or click a face"}
                  </p>
                  <div
                     style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "10px",
                        justifyContent: "center",
                     }}
                  >
                     {selectedFaceIndex !== null &&
                        shuffledNames
                           .filter(
                              (name) =>
                                 !selectedFaces.includes(name) ||
                                 selectedFaces[selectedFaceIndex] === name
                           )
                           .map((name, idx) => (
                              <button
                                 key={idx}
                                 onClick={() => {
                                    handleNameSelect(name, selectedFaceIndex);
                                 }}
                                 style={{
                                    position: "relative",
                                    padding: isMobile
                                       ? "10px 16px"
                                       : "12px 20px",
                                    paddingLeft: isMobile ? "36px" : "40px",
                                    borderRadius: "12px",
                                    border: "2px solid",
                                    borderColor:
                                       selectedFaces[selectedFaceIndex] === name
                                          ? "rgba(59, 130, 246, 0.8)"
                                          : "rgba(255, 255, 255, 0.2)",
                                    background:
                                       selectedFaces[selectedFaceIndex] === name
                                          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))"
                                          : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                                    color: "var(--text)",
                                    cursor: "pointer",
                                    fontSize: isMobile ? "0.9rem" : "1rem",
                                    fontWeight: 600,
                                    transition: "all 0.2s",
                                 }}
                                 onMouseEnter={(e) => {
                                    if (
                                       selectedFaces[selectedFaceIndex] !== name
                                    ) {
                                       e.currentTarget.style.borderColor =
                                          "rgba(59, 130, 246, 0.6)";
                                       e.currentTarget.style.background =
                                          "linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05))";
                                    }
                                 }}
                                 onMouseLeave={(e) => {
                                    if (
                                       selectedFaces[selectedFaceIndex] !== name
                                    ) {
                                       e.currentTarget.style.borderColor =
                                          "rgba(255, 255, 255, 0.2)";
                                       e.currentTarget.style.background =
                                          "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))";
                                    }
                                 }}
                              >
                                 <div
                                    style={{
                                       position: "absolute",
                                       left: isMobile ? "8px" : "10px",
                                       top: "50%",
                                       transform: "translateY(-50%)",
                                       width: isMobile ? "18px" : "20px",
                                       height: isMobile ? "18px" : "20px",
                                       borderRadius: "50%",
                                       background:
                                          "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                       border: "2px solid rgba(255, 255, 255, 0.3)",
                                       display: "flex",
                                       alignItems: "center",
                                       justifyContent: "center",
                                       fontSize: isMobile ? "0.65rem" : "0.7rem",
                                       fontWeight: 700,
                                       color: "white",
                                       boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                                    }}
                                 >
                                    {idx + 1}
                                 </div>
                                 {name}
                              </button>
                           ))}
                  </div>
               </div>
            )}
         </div>

         {/* Feedback Messages - Same as Match the Shapes */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "12px 20px" : "16px 24px",
                  borderRadius: isMobile ? "12px" : "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  gap: isMobile ? "8px" : "10px",
                  width: "100%",
                  maxWidth: isMobile ? "100%" : "600px",
                  justifyContent: "center",
                  margin: "0 auto",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Correct! Great job!</span>
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 20 : 24,
                           height: isMobile ? 20 : 24,
                        }}
                     />
                     <span>Try again! You can do it!</span>
                  </>
               )}
            </div>
         )}

         {/* Share Success Message */}
         {shareSuccess && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "8px" : "10px",
                  padding: isMobile ? "12px 16px" : "14px 20px",
                  background:
                     "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                  border: "2px solid rgba(34, 197, 94, 0.6)",
                  borderRadius: "12px",
                  width: "100%",
                  justifyContent: "center",
                  animation: "slideIn 0.3s ease",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color: "rgba(34, 197, 94, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span
                  style={{
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 500,
                     color: "var(--text)",
                  }}
               >
                  {isMobile
                     ? "Link copied! Unlimited hints unlock when someone opens it!"
                     : "Link copied! Unlimited hints will unlock when someone opens your link!"}
               </span>
            </div>
         )}

         {/* Unlimited Hints Activated */}
         {unlimitedActivated && (
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "8px" : "10px",
                  padding: isMobile ? "12px 16px" : "14px 20px",
                  background:
                     "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.1))",
                  border: "2px solid rgba(59, 130, 246, 0.6)",
                  borderRadius: "12px",
                  width: "100%",
                  justifyContent: "center",
                  animation: "slideIn 0.3s ease",
               }}
            >
               <CheckCircleIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color: "rgba(59, 130, 246, 0.9)",
                     flexShrink: 0,
                  }}
               />
               <span
                  style={{
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 500,
                     color: "var(--text)",
                  }}
               >
                  {isMobile
                     ? "🎉 Unlimited hints active for 15 minutes!"
                     : "🎉 Someone opened your link! Unlimited hints are now active for 15 minutes!"}
               </span>
            </div>
         )}

         {/* Hint and Share buttons - Always at the bottom */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "8px" : "12px",
               flexWrap: "wrap",
               justifyContent: "center",
               marginTop: isMobile ? "16px" : "20px",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  gameState !== "input"
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "rgba(166, 179, 209, 0.1)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: "1px solid",
                  borderColor:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "var(--muted)"
                        : "rgba(251, 191, 36, 0.6)",
                  borderRadius: "12px",
                  color:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "var(--muted)"
                        : "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     maxHints > 0 && hintsUsed >= maxHints
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.3s ease",
                  opacity: maxHints > 0 && hintsUsed >= maxHints ? 0.5 : 1,
               }}
               onMouseEnter={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input"
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.3), rgba(251, 191, 36, 0.2))";
                     e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.8)";
                     e.currentTarget.style.transform = "translateY(-2px)";
                     e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(251, 191, 36, 0.3)";
                  }
               }}
               onMouseLeave={(e) => {
                  if (
                     !(maxHints > 0 && hintsUsed >= maxHints) &&
                     gameState === "input"
                  ) {
                     e.currentTarget.style.background =
                        "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))";
                     e.currentTarget.style.borderColor = "rgba(251, 191, 36, 0.6)";
                     e.currentTarget.style.transform = "translateY(0)";
                     e.currentTarget.style.boxShadow = "none";
                  }
               }}
            >
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        maxHints > 0 && hintsUsed >= maxHints
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  Hint{" "}
                  {maxHints === 0 ? "(∞)" : `(${maxHints - hintsUsed} left)`}
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
               <span>Share for Unlimited Hints</span>
            </button>
         </div>
      </div>
   );
}

// Color Grid Memory Game (24)
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
                  setTimeout(() => {
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
               if (data.shared && data.expiry && Date.now() < data.expiry) {
                  setHasShared(true);
                  setUnlimitedActivated(true);
                  setTimeout(() => {
                     setUnlimitedActivated(false);
                     setHasShared(false);
                     localStorage.removeItem(gameKey);
                  }, data.expiry - Date.now());
               }
            }
         } catch (error) {
            localStorage.removeItem(gameKey);
         }
      }

      // Check URL for shared parameter
      const urlParams = new URLSearchParams(window.location.search);
      const sharedId = urlParams.get("shared");
      if (sharedId) {
         trackShareClick(sharedId, "color-grid-memory");
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
         setTimeout(() => {
            onComplete(currentScore);
         }, 1000);
      }
   }, [currentRound, maxRounds, currentScore, onComplete]);

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

            setTimeout(() => {
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

            setTimeout(() => {
               setCurrentRound((prev) => prev + 1);
            }, 1500);
         }
      },
      [gameState, userInput, sequence, startNewRound]
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
               title: "Color Grid Memory",
               text: "Check out this memory game!",
               url: shareLink,
            });
            await registerShareLink(shareId);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
         } else {
            await navigator.clipboard.writeText(shareLink);
            await registerShareLink(shareId);
            setShareSuccess(true);
            setTimeout(() => setShareSuccess(false), 15000); // 15 seconds
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
               newIndex = Math.min(totalCells - 1, selectedCellIndex + gridSize);
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
   }, [
      gameState,
      selectedCellIndex,
      gridSize,
      userInput,
      handleCellClick,
   ]);

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

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? "16px" : "20px",
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            padding: isMobile ? "16px" : "24px",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               gap: isMobile ? "10px" : "12px",
               padding: isMobile ? "14px 18px" : "16px 24px",
               background:
                  "linear-gradient(135deg, rgba(15, 27, 51, 0.8), rgba(15, 27, 51, 0.6))",
               borderRadius: "16px",
               border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
         >
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
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                  }}
               >
                  <ArrowPathIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  Round {currentRound + 1} / {maxRounds}
               </div>
               <div
                  style={{
                     display: "flex",
                     alignItems: "center",
                     gap: isMobile ? "6px" : "8px",
                     fontSize: isMobile ? "0.9rem" : "1rem",
                     fontWeight: 600,
                     color: "var(--text)",
                  }}
               >
                  <TrophyIcon
                     style={{
                        width: isMobile ? 18 : 20,
                        height: isMobile ? 18 : 20,
                        color: "var(--accent)",
                     }}
                  />
                  Score: {currentScore} / 100
               </div>
            </div>
            {/* Progress Bar */}
            <div
               style={{
                  width: "100%",
                  height: isMobile ? "6px" : "8px",
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
                        "linear-gradient(90deg, rgba(110, 168, 255, 0.8), rgba(59, 130, 246, 0.8))",
                     borderRadius: "4px",
                     transition: "width 0.3s ease",
                  }}
               />
            </div>
         </div>

         {/* Game Board */}
         <div
            style={{
               display: "flex",
               flexDirection: "column",
               alignItems: "center",
               gap: isMobile ? "16px" : "20px",
            }}
         >
            {/* Status Message */}
            <div
               style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
               }}
            >
               <b
                  style={{
                     fontSize: isMobile ? "1rem" : "1.1rem",
                     fontWeight: 700,
                     color: "var(--text)",
                     display: "flex",
                     alignItems: "center",
                     justifyContent: "center",
                     gap: "8px",
                  }}
               >
                  {gameState === "memorizing" && "Watch the sequence…"}
                  {gameState === "input" && "Now click in the same order"}
                  {gameState === "correct" && (
                     <>
                        <CheckCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--ok)",
                           }}
                        />
                        Correct!
                     </>
                  )}
                  {gameState === "wrong" && (
                     <>
                        <XCircleIcon
                           style={{
                              width: isMobile ? 20 : 24,
                              height: isMobile ? 20 : 24,
                              color: "var(--warn)",
                           }}
                        />
                        Wrong! Try again
                     </>
                  )}
               </b>
               <div
                  style={{
                     fontSize: isMobile ? "0.75rem" : "0.875rem",
                     color: "var(--muted)",
                  }}
               >
                  {gameState === "memorizing" &&
                     "After it disappears, click in the same order"}
                  {gameState === "input" && "Click the cells in order"}
               </div>
            </div>

            {/* Grid */}
            <div
               style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                  gap: isMobile
                     ? "8px"
                     : gridSize <= 3
                     ? "14px"
                     : gridSize <= 4
                     ? "12px"
                     : "10px",
                  width: "100%",
                  maxWidth: isMobile
                     ? "100%"
                     : gridSize <= 3
                     ? "400px"
                     : gridSize <= 4
                     ? "500px"
                     : "600px",
               }}
            >
               {Array.from({ length: gridSize * gridSize }).map((_, idx) => {
                  const isInSequence = sequence.includes(idx);
                  const sequenceIndex = sequence.indexOf(idx);
                  const isSelected = userInput.includes(idx);
                  const inputIndex = userInput.indexOf(idx);
                  const isHinted = hintRevealed.includes(sequenceIndex);
                  const isFlashing = flashingCellIndex === idx;
                  const isWrong = wrongCellIndex === idx;

                  // Get color for this cell in sequence
                  const colorIndex = sequenceIndex >= 0 ? sequenceIndex % colors.length : -1;
                  const cellColor = colorIndex >= 0 ? colors[colorIndex] : null;

                  return (
                     <button
                        key={idx}
                        onClick={() => handleCellClick(idx)}
                        disabled={gameState !== "input" || isSelected}
                        style={{
                           width: "100%",
                           aspectRatio: "1",
                           minWidth: isMobile ? "44px" : "50px",
                           minHeight: isMobile ? "44px" : "50px",
                           borderRadius: isMobile ? "12px" : "14px",
                           border: `2px solid ${
                              isFlashing
                                 ? "rgba(110, 168, 255, 1)"
                                 : isWrong
                                 ? "rgba(251, 113, 133, 0.8)"
                                 : isSelected
                                 ? "rgba(110, 168, 255, 0.6)"
                                 : isHinted
                                 ? "rgba(251, 191, 36, 0.6)"
                                 : selectedCellIndex === idx && !isSelected
                                 ? "rgba(251, 191, 36, 0.8)"
                                 : "rgba(255, 255, 255, 0.1)"
                           }`,
                           background:
                              isFlashing && cellColor
                                 ? cellColor
                                 : isWrong
                                 ? "linear-gradient(135deg, rgba(251, 113, 133, 0.3), rgba(251, 113, 133, 0.2))"
                                 : isSelected && cellColor
                                 ? cellColor
                                 : isHinted && cellColor
                                 ? cellColor
                                 : selectedCellIndex === idx && !isSelected
                                 ? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.08))"
                                 : "linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))",
                           boxShadow: isFlashing
                              ? "0 0 30px rgba(110, 168, 255, 0.6), 0 0 50px rgba(110, 168, 255, 0.4)"
                              : isSelected
                              ? "0 4px 12px rgba(110, 168, 255, 0.3)"
                              : selectedCellIndex === idx && !isSelected
                              ? "0 4px 12px rgba(251, 191, 36, 0.3)"
                              : "0 2px 8px rgba(0, 0, 0, 0.1)",
                           outline:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px solid rgba(251, 191, 36, 0.5)"
                                 : "none",
                           outlineOffset:
                              selectedCellIndex === idx && !isSelected
                                 ? "2px"
                                 : "0",
                           cursor:
                              gameState === "input" && !isSelected
                                 ? "pointer"
                                 : "not-allowed",
                           transition: "all 0.2s ease",
                           transform: isFlashing ? "scale(1.1)" : "scale(1)",
                           position: "relative",
                           display: "flex",
                           alignItems: "center",
                           justifyContent: "center",
                           fontSize: isMobile ? "0.75rem" : "0.875rem",
                           fontWeight: 600,
                           color: "white",
                        }}
                     >
                        {isSelected && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background: "rgba(0, 0, 0, 0.5)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                              }}
                           >
                              {inputIndex + 1}
                           </div>
                        )}
                        {isHinted && !isSelected && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 right: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, rgba(251, 191, 36, 0.9), rgba(251, 191, 36, 0.7))",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                                 color: "white",
                              }}
                           >
                              {sequenceIndex + 1}
                           </div>
                        )}
                        {gameState === "input" && !isSelected && !isHinted && (
                           <div
                              style={{
                                 position: "absolute",
                                 top: "4px",
                                 left: "4px",
                                 width: isMobile ? "18px" : "20px",
                                 height: isMobile ? "18px" : "20px",
                                 borderRadius: "50%",
                                 background:
                                    "linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.9))",
                                 border: "2px solid rgba(255, 255, 255, 0.3)",
                                 display: "flex",
                                 alignItems: "center",
                                 justifyContent: "center",
                                 fontSize: isMobile ? "0.65rem" : "0.7rem",
                                 fontWeight: 700,
                                 color: "white",
                                 boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                              }}
                           >
                              {idx < 9
                                 ? idx + 1
                                 : idx === 9
                                 ? "0"
                                 : idx === 10
                                 ? "-"
                                 : idx === 11
                                 ? "="
                                 : ""}
                           </div>
                        )}
                     </button>
                  );
               })}
            </div>
         </div>

         {/* Feedback Messages */}
         {feedback !== null && (
            <div
               style={{
                  padding: isMobile ? "14px 20px" : "16px 24px",
                  borderRadius: "12px",
                  fontSize: isMobile ? "1rem" : "1.1rem",
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
                  width: "100%",
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
                     : "🎉 Someone opened your link! Unlimited hints is now active for 15 minutes!"}
               </span>
            </div>
         )}

         {/* Hint and Share Buttons */}
         <div
            style={{
               display: "flex",
               gap: isMobile ? "10px" : "12px",
               width: "100%",
               justifyContent: "center",
               flexWrap: "wrap",
            }}
         >
            {/* Hint Button */}
            <button
               onClick={handleHint}
               disabled={
                  gameState !== "input" ||
                  (maxHints > 0 && hintsUsed >= maxHints) ||
                  hintRevealed.length >= sequence.length
               }
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  padding: isMobile ? "10px 16px" : "10px 20px",
                  width: isMobile ? "100%" : "auto",
                  background:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "rgba(255, 255, 255, 0.05)"
                        : "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 191, 36, 0.1))",
                  border: `1px solid ${
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(251, 191, 36, 0.6)"
                  }`,
                  borderRadius: "12px",
                  color: "var(--text)",
                  fontSize: isMobile ? "0.85rem" : "0.95rem",
                  fontWeight: 600,
                  cursor:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? "not-allowed"
                        : "pointer",
                  transition: "all 0.3s ease",
                  opacity:
                     gameState !== "input" ||
                     (maxHints > 0 && hintsUsed >= maxHints) ||
                     hintRevealed.length >= sequence.length
                        ? 0.5
                        : 1,
               }}
            >
               <LightBulbIcon
                  style={{
                     width: isMobile ? 18 : 20,
                     height: isMobile ? 18 : 20,
                     color:
                        gameState !== "input" ||
                        (maxHints > 0 && hintsUsed >= maxHints) ||
                        hintRevealed.length >= sequence.length
                           ? "var(--muted)"
                           : "rgba(251, 191, 36, 0.9)",
                  }}
               />
               <span>
                  {hasShared
                     ? "Hint (∞)"
                     : `Hint (${Math.max(0, maxHints - hintsUsed)} left)`}
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
      </div>
   );
}

// Symbol Stack Game (25)
function SymbolStack({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const rounds = config.rounds || 3;
   const [stack, setStack] = useState<string[]>([]);
   const [playerStack, setPlayerStack] = useState<string[]>([]);
   const [round, setRound] = useState(0);
   const [score, setScore] = useState(0);
   const [showing, setShowing] = useState(true);
   const symbols = ["★", "◆", "●", "▲", "■"];

   useEffect(() => {
      if (round >= rounds) {
         const finalScore = Math.round((score / rounds) * 100);
         onScoreUpdate(finalScore);
         setTimeout(() => onComplete(finalScore), 1000);
         return;
      }
      startRound();
   }, [round, rounds, score, onScoreUpdate, onComplete]);

   const startRound = () => {
      const newStack = Array.from(
         { length: round + 3 },
         () => symbols[Math.floor(Math.random() * symbols.length)]
      );
      setStack(newStack);
      setPlayerStack([]);
      setShowing(true);

      setTimeout(() => {
         setShowing(false);
      }, 3000);
   };

   useEffect(() => {
      if (!showing && playerStack.length === stack.length) {
         const isCorrect = playerStack.every((sym, i) => sym === stack[i]);
         if (isCorrect) {
            setScore(score + 33);
         }
         setRound(round + 1);
      }
   }, [playerStack, stack, showing, round, score]);

   const handleSymbolClick = (symbol: string) => {
      if (showing) return;
      setPlayerStack([...playerStack, symbol]);
   };

   return (
      <div className="symbol-stack-game">
         <h3>Symbol Stack - Round {round + 1}</h3>
         {showing ? (
            <div>
               <p>Remember the stack order:</p>
               <div className="stack-display">
                  {stack.map((sym, i) => (
                     <div key={i} className="stack-item">
                        {sym}
                     </div>
                  ))}
               </div>
            </div>
         ) : (
            <div>
               <p>Rebuild the stack:</p>
               <div className="stack-display">
                  {playerStack.map((sym, i) => (
                     <div key={i} className="stack-item">
                        {sym}
                     </div>
                  ))}
               </div>
               <div className="symbol-options">
                  {symbols.map((sym) => (
                     <button
                        key={sym}
                        onClick={() => handleSymbolClick(sym)}
                        className="symbol-btn"
                     >
                        {sym}
                     </button>
                  ))}
               </div>
            </div>
         )}
      </div>
   );
}
