"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

// ponytail: single app-level boundary; per-route error.tsx files stay closer for schedule/changes
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-1 items-center justify-center p-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
            <div className="text-lg font-semibold">Что-то пошло не так</div>
            <div className="mt-2 text-sm text-zinc-600">
              Не удалось отобразить страницу. Обновите её и попробуйте ещё раз.
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              onClick={() => window.location.reload()}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
