import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
          <div className="max-w-lg w-full rounded-xl border border-red-500/40 bg-red-500/5 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <h1 className="text-lg font-semibold text-red-400">AGENTGUARD — Unexpected Error</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Something went wrong in the dashboard. This is a client-side error and does not affect the gateway or policy engine.
            </p>
            <pre className="text-xs text-red-300 bg-red-950/40 rounded p-3 overflow-auto">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-sm px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

