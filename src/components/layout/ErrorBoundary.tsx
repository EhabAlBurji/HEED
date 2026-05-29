import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
        this.props.fallback ?? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 max-w-lg w-full">
              <p className="text-sm font-medium text-destructive mb-2">حدث خطأ في هذه الصفحة</p>
              <pre className="mt-2 overflow-auto rounded bg-background/60 p-3 text-start font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack?.split("\n").slice(1, 4).join("\n")}
              </pre>
              <button
                onClick={() => this.setState({ error: null })}
                className="mt-4 rounded-lg bg-primary/15 px-4 py-2 text-sm text-primary hover:bg-primary/25"
              >
                حاول مرة أخرى
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
