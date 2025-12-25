import { useEffect, useCallback, RefObject } from "react";

export interface KeyboardMapping {
   [key: string]: () => void;
}

interface UseKeyboardControlsOptions {
   mappings: KeyboardMapping;
   enabled?: boolean;
   preventDefault?: boolean;
   targetRef?: RefObject<HTMLElement>;
}

/**
 * General hook for keyboard controls that can be used in any game
 * 
 * @example
 * ```tsx
 * const { handleKeyPress } = useKeyboardControls({
 *   mappings: {
 *     'ArrowLeft': () => handleLeft(),
 *     'ArrowRight': () => handleRight(),
 *     'Enter': () => handleSelect(),
 *   },
 *   enabled: isPlaying && !isAnimating,
 * });
 * ```
 */
export function useKeyboardControls({
   mappings,
   enabled = true,
   preventDefault = true,
   targetRef,
}: UseKeyboardControlsOptions) {
   const handleKeyPress = useCallback(
      (e: KeyboardEvent) => {
         if (!enabled) return;

         const handler = mappings[e.key];
         if (handler) {
            if (preventDefault) {
               e.preventDefault();
            }
            handler();
         }
      },
      [mappings, enabled, preventDefault]
   );

   useEffect(() => {
      if (!enabled) return;

      const target = targetRef?.current || window;
      const handler = (e: Event) => {
         if (e instanceof KeyboardEvent) {
            handleKeyPress(e);
         }
      };
      target.addEventListener("keydown", handler);
      return () => target.removeEventListener("keydown", handler);
   }, [handleKeyPress, enabled, targetRef]);
}

/**
 * Helper function to create keyboard mappings for common patterns
 */
export function createKeyboardMapping(
   patterns: Array<{
      keys: string[];
      action: () => void;
   }>
): KeyboardMapping {
   const mapping: KeyboardMapping = {};
   patterns.forEach(({ keys, action }) => {
      keys.forEach((key) => {
         mapping[key] = action;
         // Also add lowercase version for letter keys
         if (key.length === 1 && key === key.toUpperCase()) {
            mapping[key.toLowerCase()] = action;
         }
      });
   });
   return mapping;
}

