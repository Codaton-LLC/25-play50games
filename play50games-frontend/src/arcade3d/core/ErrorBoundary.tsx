"use client";

// Minimal error boundary for the arcade shell (DOM side). Change `resetKey` to try again.
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
   fallback: (error: Error) => ReactNode;
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
   }

   render() {
      return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
   }
}
