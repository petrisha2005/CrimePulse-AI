import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[CrimePulse AI] frontend error", error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-command-950 px-6 text-slate-100">
        <section className="max-w-xl rounded-md border border-alert-critical/40 bg-command-900/95 p-6 shadow-glow">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-alert-critical">Frontend Error</p>
          <h1 className="mt-3 text-2xl font-bold text-white">CrimePulse AI frontend error</h1>
          <p className="mt-3 rounded-md border border-command-700 bg-command-950 p-4 text-sm text-slate-300">
            {this.state.error.message || "Unknown frontend error"}
          </p>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
