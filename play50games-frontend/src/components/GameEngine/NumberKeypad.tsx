"use client";

import { useState, useEffect, useCallback } from "react";

interface NumberKeypadProps {
   onNumberSelect: (num: number) => void;
   onClear?: () => void;
   maxNumber?: number;
   minNumber?: number;
   showClear?: boolean;
   className?: string;
}

export default function NumberKeypad({
   onNumberSelect,
   onClear,
   maxNumber = 9,
   minNumber = 1,
   showClear = true,
   className = "",
}: NumberKeypadProps) {
   const [selectedNumber, setSelectedNumber] = useState<number | null>(null);

   // Generate array of numbers from minNumber to maxNumber
   const numbers = Array.from(
      { length: maxNumber - minNumber + 1 },
      (_, i) => minNumber + i
   );

   const handleNumberClick = useCallback(
      (num: number) => {
         setSelectedNumber(num);
         onNumberSelect(num);
         // Reset selection after a brief moment for visual feedback
         setTimeout(() => setSelectedNumber(null), 200);
      },
      [onNumberSelect]
   );

   const handleClear = useCallback(() => {
      if (onClear) {
         onClear();
      }
   }, [onClear]);

   // Keyboard support
   useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
         const key = e.key;

         // Check if key is a number within range
         const num = parseInt(key);
         if (!isNaN(num) && num >= minNumber && num <= maxNumber) {
            e.preventDefault();
            handleNumberClick(num);
         }

         // Handle backspace/delete for clear
         if ((key === "Backspace" || key === "Delete") && onClear) {
            e.preventDefault();
            handleClear();
         }
      };

      window.addEventListener("keydown", handleKeyPress);
      return () => window.removeEventListener("keydown", handleKeyPress);
   }, [minNumber, maxNumber, handleNumberClick, handleClear, onClear]);

   return (
      <div className={`number-keypad ${className}`}>
         <div className="keypad-numbers">
            {numbers.map((num) => (
               <button
                  key={num}
                  onClick={() => handleNumberClick(num)}
                  className={`keypad-number-btn ${
                     selectedNumber === num ? "selected" : ""
                  }`}
               >
                  {num}
               </button>
            ))}
         </div>
         {showClear && onClear && (
            <button onClick={handleClear} className="keypad-clear-btn">
               Clear
            </button>
         )}
      </div>
   );
}
