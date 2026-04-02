import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import "./styles/app.css";

const queryClient = new QueryClient();

interface StartupBoundaryState {
  errorMessage: string | null;
}

class StartupErrorBoundary extends React.Component<React.PropsWithChildren, StartupBoundaryState> {
  state: StartupBoundaryState = {
    errorMessage: null,
  };

  static getDerivedStateFromError(error: unknown): StartupBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.message : "Unknown desktop startup error.",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("NoteSmith desktop render failed", error);
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="app-shell">
          <main className="workspace">
            <div className="card" style={{ margin: "2rem" }}>
              <div className="card-header">
                <div>
                  <h2>Desktop render failed</h2>
                  <p>The UI hit an error before it could finish loading.</p>
                </div>
              </div>
              <div className="stack">
                <p className="muted">{this.state.errorMessage}</p>
                <p className="tiny-text">
                  This fallback is shown so the app does not fail silently. The error is also logged to the console.
                </p>
              </div>
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StartupErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StartupErrorBoundary>
  </React.StrictMode>,
);
