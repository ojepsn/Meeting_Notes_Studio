export const exportOutputAsText = ({ title, output, }) => {
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(title || "notesmith-output").replace(/[^\w\- ]+/g, "").trim() || "notesmith-output"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
};
