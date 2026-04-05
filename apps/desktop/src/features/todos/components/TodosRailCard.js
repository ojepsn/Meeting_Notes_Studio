import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const TodosRailCard = ({ active, onOpen }) => {
    return (_jsxs("button", { type: "button", className: "workspace-nav-button", "data-active": active, onClick: onOpen, children: [_jsx("span", { children: "Todos" }), _jsx("small", { children: "Focused follow-up management" })] }));
};
