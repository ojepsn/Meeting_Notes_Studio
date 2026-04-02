import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App";
import "./styles/app.css";
const queryClient = new QueryClient();
class StartupErrorBoundary extends React.Component {
    state = {
        errorMessage: null,
    };
    static getDerivedStateFromError(error) {
        return {
            errorMessage: error instanceof Error ? error.message : "Unknown desktop startup error.",
        };
    }
    componentDidCatch(error) {
        console.error("NoteSmith desktop render failed", error);
    }
    render() {
        if (this.state.errorMessage) {
            return (_jsx("div", { className: "app-shell", children: _jsx("main", { className: "workspace", children: _jsxs("div", { className: "card", style: { margin: "2rem" }, children: [_jsx("div", { className: "card-header", children: _jsxs("div", { children: [_jsx("h2", { children: "Desktop render failed" }), _jsx("p", { children: "The UI hit an error before it could finish loading." })] }) }), _jsxs("div", { className: "stack", children: [_jsx("p", { className: "muted", children: this.state.errorMessage }), _jsx("p", { className: "tiny-text", children: "This fallback is shown so the app does not fail silently. The error is also logged to the console." })] })] }) }) }));
        }
        return this.props.children;
    }
}
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(StartupErrorBoundary, { children: _jsx(QueryClientProvider, { client: queryClient, children: _jsx(App, {}) }) }) }));
