// Result pops on top of useFx().score: the success "+N" every game already shows, plus the missing
// FAIL pop ("Miss", "Wrong item -1s", "Bump! -1 life") in a red that reads as a failure, with a small
// puff and a light shake. One look for every game (README "Effects: core/fx").
//
//    const pop = useActionPop();
//    pop.good(at, "+100");
//    pop.fail(at, "Too fast!");
//    pop.info(at, "Follow me!");
import { useMemo } from "react";
import type { Vec3Like } from "../collision";
import { useFx } from "./FxLayer";

export type PopKind = "good" | "fail" | "info";

export interface PopStyle {
   color: string;
   /** popup height, fraction of half the canvas height (useFx().score size) */
   size: number;
   /** puff particles with it (0 = none) */
   puff: number;
   /** camera shake impulse (0 = none) */
   shake: number;
}

export const POP_STYLES: Readonly<Record<PopKind, Readonly<PopStyle>>> = {
   good: { color: "#fde047", size: 0.065, puff: 0, shake: 0 },
   fail: { color: "#fb7185", size: 0.07, puff: 6, shake: 0.12 },
   info: { color: "#e0f2fe", size: 0.055, puff: 0, shake: 0 },
};

export interface ActionPop {
   good(at: Vec3Like, text: string): void;
   fail(at: Vec3Like, text: string, options?: { shake?: number }): void;
   info(at: Vec3Like, text: string): void;
}

export function useActionPop(): ActionPop {
   const fx = useFx();
   return useMemo(() => {
      const show = (kind: PopKind, at: Vec3Like, text: string, shake?: number) => {
         const style = POP_STYLES[kind];
         fx.score(at, text, { color: style.color, size: style.size });
         if (style.puff > 0) fx.burst("puff", at, style.puff);
         const amount = shake ?? style.shake;
         if (amount > 0) fx.shake(amount);
      };
      return {
         good: (at, text) => show("good", at, text),
         fail: (at, text, options) => show("fail", at, text, options?.shake),
         info: (at, text) => show("info", at, text),
      };
   }, [fx]);
}
