"use client";

import { useState, useEffect, useCallback } from "react";
import {
   ArrowPathIcon,
   TrophyIcon,
   SparklesIcon,
   CheckCircleIcon,
   XCircleIcon,
   HomeIcon,
   FingerPrintIcon,
   KeyIcon,
   StarIcon,
   EyeIcon,
   HeartIcon,
   CameraIcon,
   CubeIcon,
   BellIcon,
   PlusIcon,
   GiftIcon,
   MoonIcon,
} from "@heroicons/react/24/outline";

// Helper function to get Heroicon for each shape
function getShapeIcon(shape: string, size: number = 80) {
   const iconStyle = {
      width: size,
      height: size,
      color: "var(--accent)",
   };

   const shapeLower = shape.toLowerCase();

   switch (shapeLower) {
      case "home":
      case "circlestack":
      case "circle":
         return <HomeIcon style={iconStyle} />;
      case "fingerprint":
      case "square2stack":
      case "square":
         return <FingerPrintIcon style={iconStyle} />;
      case "key":
      case "arrowup":
      case "triangle":
         return <KeyIcon style={iconStyle} />;
      case "star":
         return <StarIcon style={iconStyle} />;
      case "eye":
      case "diamond":
         return <EyeIcon style={iconStyle} />;
      case "heart":
         return <HeartIcon style={iconStyle} />;
      case "camera":
      case "stop":
      case "pentagon":
         return <CameraIcon style={iconStyle} />;
      case "cube":
      case "hexagon":
         return <CubeIcon style={iconStyle} />;
      case "bell":
      case "octagon":
         return <BellIcon style={iconStyle} />;
      case "plus":
      case "cross":
         return <PlusIcon style={iconStyle} />;
      case "gift":
      case "arrowright":
      case "arrow":
         return <GiftIcon style={iconStyle} />;
      case "moon":
      case "crescent":
         return <MoonIcon style={iconStyle} />;
      default:
         return <HomeIcon style={iconStyle} />;
   }
}

function FindOddOne({
   config,
   onScoreUpdate,
   onComplete,
}: {
   config: Record<string, any>;
   onScoreUpdate: (score: number) => void;
   onComplete: (finalScore?: number) => void;
}) {
   const maxRounds = config.rounds || 20;
   const availableIcons = config.icons || [
      "Home",
      "Fingerprint",
      "Key",
      "Star",
      "Eye",
      "Heart",
      "Camera",
      "Cube",
      "Bell",
      "Plus",
      "Gift",
      "Moon",
   ];

   const [currentRound, setCurrentRound] = useState(0);
   const [currentScore, setCurrentScore] = useState(0);
   const [items, setItems] = useState<
      Array<{ id: number; icon: string; isOdd: boolean }>
   >([]);
   const [selected, setSelected] = useState<number | null>(null);
   const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

   // Determine item count based on round
   const getItemCount = (round: number) => {
      if (round < 5) return 10; // Rounds 1-5: 10 items
      if (round < 10) return 30; // Rounds 6-10: 30 items
      return 50; // Rounds 11+: 50 items
   };

   // Determine icon size based on item count and screen size
   const getIconSize = (
      count: number,
      isMobile: boolean,
      isTablet: boolean
   ) => {
      if (isMobile) {
         if (count >= 50) return 24; // Very small for 50 items on mobile
         if (count >= 30) return 28; // Small for 30 items on mobile
         return 40; // Normal for 10 items on mobile
      }
      if (isTablet) {
         if (count >= 50) return 28; // Small for 50 items on tablet
         if (count >= 30) return 36; // Medium for 30 items on tablet
         return 50; // Normal for 10 items on tablet
      }
      if (count >= 50) return 32; // Very small for 50 items
      if (count >= 30) return 40; // Small for 30 items
      return 60; // Normal for 10 items
   };

   // Determine grid columns based on item count and screen size
   const getGridColumns = (
      count: number,
      isMobile: boolean,
      isTablet: boolean
   ) => {
      if (isMobile) {
         if (count === 10) return 3; // 3x4 grid for 10 items on mobile
         if (count === 30) return 4; // 4x8 grid for 30 items on mobile
         return 5; // 5x10 grid for 50 items on mobile
      }
      if (isTablet) {
         if (count === 10) return 4; // 4x3 grid for 10 items on tablet
         if (count === 30) return 5; // 5x6 grid for 30 items on tablet
         return 7; // 7x8 grid for 50 items on tablet
      }
      if (count === 10) return 5; // 5x2 grid for 10 items
      if (count === 30) return 6; // 6x5 grid for 30 items
      return 10; // 10x5 grid for 50 items
   };

   // Check screen size (mobile, tablet, desktop)
   const [isMobile, setIsMobile] = useState(false);
   const [isTablet, setIsTablet] = useState(false);

   useEffect(() => {
      const checkScreenSize = () => {
         const width = window.innerWidth;
         setIsMobile(width < 768);
         setIsTablet(width >= 768 && width < 1024);
      };
      checkScreenSize();
      window.addEventListener("resize", checkScreenSize);
      return () => window.removeEventListener("resize", checkScreenSize);
   }, []);

   const startNewRound = useCallback(() => {
      const roundNumber = currentRound + 1;
      const itemCount = getItemCount(roundNumber);
      const oddIndex = Math.floor(Math.random() * itemCount);
      const baseIcon =
         availableIcons[Math.floor(Math.random() * availableIcons.length)];
      const oddIcon =
         availableIcons[Math.floor(Math.random() * availableIcons.length)] !==
         baseIcon
            ? availableIcons[
                 availableIcons.findIndex((icon: string) => icon !== baseIcon)
              ]
            : availableIcons[
                 (availableIcons.findIndex(
                    (icon: string) => icon === baseIcon
                 ) +
                    1) %
                    availableIcons.length
              ];

      const newItems = Array.from({ length: itemCount }, (_, i) => ({
         id: i,
         icon: i === oddIndex ? oddIcon : baseIcon,
         isOdd: i === oddIndex,
      }));

      // Shuffle items
      const shuffled = [...newItems].sort(() => Math.random() - 0.5);
      setItems(shuffled);
      setSelected(null);
      setFeedback(null);
   }, [currentRound, availableIcons]);

   useEffect(() => {
      startNewRound();
   }, [startNewRound]);

   const handleClick = useCallback(
      (id: number) => {
         if (selected !== null) return; // Already selected

         const item = items.find((i) => i.id === id);
         if (!item) return;

         setSelected(id);
         const isCorrect = item.isOdd;
         setFeedback(isCorrect ? "correct" : "wrong");

         const nextRound = currentRound + 1;
         const points = isCorrect ? 5 : 0; // 5 points per correct round
         const newScore = currentScore + points;

         setCurrentScore(newScore);
         onScoreUpdate(newScore);

         setTimeout(() => {
            if (nextRound >= maxRounds) {
               // Game complete
               onComplete(newScore);
            } else {
               setCurrentRound(nextRound);
               startNewRound();
            }
         }, 1500);
      },
      [
         selected,
         items,
         currentRound,
         currentScore,
         maxRounds,
         onScoreUpdate,
         onComplete,
         startNewRound,
      ]
   );

   const itemCount = getItemCount(currentRound + 1);
   const iconSize = getIconSize(itemCount, isMobile, isTablet);
   const gridColumns = getGridColumns(itemCount, isMobile, isTablet);

   return (
      <div
         style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isMobile ? "12px" : isTablet ? "16px" : "24px",
            width: "100%",
            maxWidth: "1200px",
            margin: "0 auto",
            padding: isMobile ? "12px" : isTablet ? "16px" : "20px",
         }}
      >
         {/* Header */}
         <div
            style={{
               display: "flex",
               flexDirection: isMobile ? "column" : "row",
               justifyContent: "space-between",
               alignItems: "center",
               gap: isMobile ? "8px" : isTablet ? "12px" : "0",
               width: "100%",
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: isMobile ? "12px" : isTablet ? "14px" : "16px",
               padding: isMobile
                  ? "12px 16px"
                  : isTablet
                  ? "14px 20px"
                  : "16px 24px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
         >
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--text)",
               }}
            >
               <ArrowPathIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 18 : 20,
                     height: isMobile ? 16 : isTablet ? 18 : 20,
                  }}
               />
               Round {currentRound + 1} / {maxRounds}
            </div>
            <div
               style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--accent)",
               }}
            >
               <TrophyIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 18 : 20,
                     height: isMobile ? 16 : isTablet ? 18 : 20,
                  }}
               />
               Score: {currentScore} / {maxRounds * 5}
            </div>
         </div>

         {/* Progress Bar */}
         <div
            style={{
               width: "100%",
               height: "8px",
               background: "var(--stroke)",
               borderRadius: "4px",
               overflow: "hidden",
            }}
         >
            <div
               style={{
                  width: `${((currentRound + 1) / maxRounds) * 100}%`,
                  height: "100%",
                  background:
                     "linear-gradient(90deg, var(--accent) 0%, var(--secondary) 100%)",
                  transition: "width 0.3s ease",
               }}
            />
         </div>

         {/* Instructions */}
         <div
            style={{
               background: "var(--card)",
               border: "2px solid var(--stroke)",
               borderRadius: isMobile ? "12px" : isTablet ? "14px" : "16px",
               padding: isMobile ? "12px" : isTablet ? "14px" : "16px",
               boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
               width: "100%",
               textAlign: "center",
            }}
         >
            <div
               style={{
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  color: "var(--muted)",
                  marginBottom: isMobile ? "4px" : isTablet ? "6px" : "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
               }}
            >
               <SparklesIcon
                  style={{
                     width: isMobile ? 16 : isTablet ? 17 : 18,
                     height: isMobile ? 16 : isTablet ? 17 : 18,
                  }}
               />
               Find the odd one out
            </div>
            <div
               style={{
                  fontSize: isMobile
                     ? "0.75rem"
                     : isTablet
                     ? "0.8125rem"
                     : "0.875rem",
                  color: "var(--accent)",
                  fontWeight: 500,
               }}
            >
               Click on the icon that is different from the others
            </div>
         </div>

         {/* Grid */}
         <div
            style={{
               display: "grid",
               gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
               gap: isMobile
                  ? itemCount >= 50
                     ? "4px"
                     : itemCount >= 30
                     ? "6px"
                     : "8px"
                  : isTablet
                  ? itemCount >= 50
                     ? "6px"
                     : itemCount >= 30
                     ? "10px"
                     : "12px"
                  : itemCount >= 50
                  ? "8px"
                  : itemCount >= 30
                  ? "12px"
                  : "16px",
               width: "100%",
               maxWidth: isMobile
                  ? "100%"
                  : isTablet
                  ? itemCount >= 50
                     ? "700px"
                     : itemCount >= 30
                     ? "800px"
                     : "500px"
                  : itemCount >= 50
                  ? "800px"
                  : itemCount >= 30
                  ? "900px"
                  : "600px",
            }}
         >
            {items.map((item) => {
               const isSelected = selected === item.id;
               const isCorrect = item.isOdd && isSelected;
               const isWrong = !item.isOdd && isSelected;

               return (
                  <button
                     key={item.id}
                     onClick={() => handleClick(item.id)}
                     disabled={selected !== null}
                     style={{
                        aspectRatio: "1",
                        background: isSelected
                           ? isCorrect
                              ? "linear-gradient(135deg, rgba(134,239,172,0.4) 0%, rgba(134,239,172,0.2) 100%)"
                              : "linear-gradient(135deg, rgba(252,165,165,0.4) 0%, rgba(252,165,165,0.2) 100%)"
                           : "linear-gradient(135deg, rgba(125, 211, 252, 0.1) 0%, rgba(125, 211, 252, 0.05) 100%)",
                        border: isSelected
                           ? isCorrect
                              ? isMobile
                                 ? "2px solid var(--ok)"
                                 : isTablet
                                 ? "2.5px solid var(--ok)"
                                 : "3px solid var(--ok)"
                              : isMobile
                              ? "2px solid var(--warn)"
                              : isTablet
                              ? "2.5px solid var(--warn)"
                              : "3px solid var(--warn)"
                           : isMobile
                           ? "1px solid var(--stroke)"
                           : isTablet
                           ? "1.5px solid var(--stroke)"
                           : "2px solid var(--stroke)",
                        borderRadius: isMobile
                           ? "8px"
                           : isTablet
                           ? "10px"
                           : "12px",
                        cursor: selected !== null ? "not-allowed" : "pointer",
                        transition: "all 0.3s ease",
                        transform: isSelected ? "scale(0.95)" : "scale(1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        boxShadow: isSelected
                           ? isCorrect
                              ? "rgba(134, 239, 172, 0.3) 0px 6px 20px"
                              : "rgba(252, 165, 165, 0.3) 0px 6px 20px"
                           : "0 2px 8px rgba(0, 0, 0, 0.1)",
                     }}
                     onMouseEnter={(e) => {
                        if (selected === null) {
                           e.currentTarget.style.transform = "scale(1.05)";
                           e.currentTarget.style.boxShadow =
                              "rgba(125, 211, 252, 0.3) 0px 8px 24px";
                        }
                     }}
                     onMouseLeave={(e) => {
                        if (selected === null) {
                           e.currentTarget.style.transform = "scale(1)";
                           e.currentTarget.style.boxShadow =
                              "0 2px 8px rgba(0, 0, 0, 0.1)";
                        }
                     }}
                  >
                     {getShapeIcon(item.icon, iconSize)}
                     {isSelected && (
                        <div
                           style={{
                              position: "absolute",
                              top: isMobile ? "2px" : isTablet ? "3px" : "4px",
                              right: isMobile
                                 ? "2px"
                                 : isTablet
                                 ? "3px"
                                 : "4px",
                              background: isCorrect
                                 ? "var(--ok)"
                                 : "var(--warn)",
                              borderRadius: "50%",
                              width: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "21px"
                                 : "24px",
                              height: isMobile
                                 ? "18px"
                                 : isTablet
                                 ? "21px"
                                 : "24px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                           }}
                        >
                           {isCorrect ? (
                              <CheckCircleIcon
                                 style={{
                                    width: isMobile ? 12 : isTablet ? 14 : 16,
                                    height: isMobile ? 12 : isTablet ? 14 : 16,
                                    color: "white",
                                 }}
                              />
                           ) : (
                              <XCircleIcon
                                 style={{
                                    width: isMobile ? 12 : isTablet ? 14 : 16,
                                    height: isMobile ? 12 : isTablet ? 14 : 16,
                                    color: "white",
                                 }}
                              />
                           )}
                        </div>
                     )}
                  </button>
               );
            })}
         </div>

         {/* Feedback */}
         {feedback && (
            <div
               style={{
                  background:
                     feedback === "correct" ? "var(--ok)" : "var(--warn)",
                  color: "white",
                  padding: isMobile
                     ? "10px 16px"
                     : isTablet
                     ? "11px 20px"
                     : "12px 24px",
                  borderRadius: isMobile ? "10px" : isTablet ? "11px" : "12px",
                  fontSize: isMobile
                     ? "0.875rem"
                     : isTablet
                     ? "0.9375rem"
                     : "1rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : isTablet ? "7px" : "8px",
                  animation: "slideUp 0.3s ease",
                  textAlign: "center",
               }}
            >
               {feedback === "correct" ? (
                  <>
                     <CheckCircleIcon
                        style={{
                           width: isMobile ? 18 : isTablet ? 19 : 20,
                           height: isMobile ? 18 : isTablet ? 19 : 20,
                        }}
                     />
                     {isMobile
                        ? "Correct!"
                        : isTablet
                        ? "Correct!"
                        : "Correct! Great job!"}
                  </>
               ) : (
                  <>
                     <XCircleIcon
                        style={{
                           width: isMobile ? 18 : isTablet ? 19 : 20,
                           height: isMobile ? 18 : isTablet ? 19 : 20,
                        }}
                     />
                     {isMobile
                        ? "Wrong!"
                        : isTablet
                        ? "Wrong!"
                        : "Wrong! Try again next round."}
                  </>
               )}
            </div>
         )}
      </div>
   );
}

export default FindOddOne;
