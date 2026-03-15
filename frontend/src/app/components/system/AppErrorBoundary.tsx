import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../ui/button";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Application error boundary", { error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-6">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Попробуйте перезагрузить страницу.
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                window.location.reload();
              }}
            >
              Перезагрузить
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

