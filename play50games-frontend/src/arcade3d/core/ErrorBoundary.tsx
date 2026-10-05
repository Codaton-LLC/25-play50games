"use client";

// Minimal error boundary for the arcade shell (DOM side). Change `resetKey` to try again.
// `onError` lets the owner show its own UI elsewhere (e.g. above sibling overlays).
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
   /** rendered in place of the children; default: nothing */
   fallback?: (error: Error) => ReactNode;
   /** called once per caught error */
   onError?: (error: Error) => void;
   resetKey?: string | number;
   children: ReactNode;
}

interface State {
   error: Error | null;
   resetKey?: string | number;
}

export default class ErrorBoundary extends Component<Props, State> {
   state: State = { error: null, resetKey: this.props.resetKey };

   static getDerivedStateFromError(error: Error): Partial<State> {
      return { error };
   }

   static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
      if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
      return null;
   }

   componentDidCatch(error: Error, info: ErrorInfo) {
      console.error("[arcade]", error, info.componentStack);
      this.props.onError?.(error);
   }

   render() {
      const { error } = this.state;
      if (!error) return this.props.children;
      return this.props.fallback ? this.props.fallback(error) : null;
   }
}
