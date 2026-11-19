"use client";

// The React side of modalStack.ts: registers the element in `ref` as an open dialog while
// `active`, and closes it (inert cleared, focus handed back) when it unmounts or `active` drops.
import { useEffect, useRef, type RefObject } from "react";
import { openModal } from "./modalStack";

export interface UseModalOptions {
   /** true (default): focus contained, the rest of the page inert */
   modal?: boolean;
   /** modal: false only: picks the frame whose other parts become inert */
   scope?: (el: HTMLElement) => Element | null;
   /** see ModalOptions.restoreFocus; read when the dialog closes */
   restoreFocus?: boolean | (() => HTMLElement | null | undefined);
}

export function useModal(ref: RefObject<HTMLElement | null>, active: boolean = true, options: UseModalOptions = {}): void {
   const optionsRef = useRef(options);
   optionsRef.current = options;
   const modal = options.modal ?? true;

   useEffect(() => {
      const el = ref.current;
      if (!active || !el) return;
      const current = optionsRef.current;
      const restore = current.restoreFocus;
      return openModal(el, {
         modal,
         scope: modal ? null : (current.scope?.(el) ?? null),
         // a function is read from the latest options at close time
         restoreFocus: typeof restore === "function" ? () => {
            const latest = optionsRef.current.restoreFocus;
            return typeof latest === "function" ? latest() : undefined;
         } : restore,
      });
   }, [ref, active, modal]);
}
