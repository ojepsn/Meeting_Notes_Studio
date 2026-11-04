import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const GenerationProgress = ({ progress }) => {
    const value = Math.max(0, Math.min(100, Math.round(progress.value)));
    return (_jsxs("div", { className: "generation-progress", role: "progressbar", "aria-label": "Output generation progress", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": value, "aria-valuetext": `${progress.label}, ${value}%`, children: [_jsxs("div", { className: "generation-progress-copy", children: [_jsx("span", { children: progress.label }), _jsxs("strong", { children: [value, "%"] })] }), _jsx("div", { className: "generation-progress-track", "aria-hidden": "true", children: _jsx("span", { className: "generation-progress-fill", style: { width: `${value}%` } }) })] }));
};
