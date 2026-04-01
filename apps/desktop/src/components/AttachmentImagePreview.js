import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createAttachmentPreviewUrl } from "../lib/files/attachmentStore";
export const AttachmentImagePreview = ({ attachment }) => {
    const [previewUrl, setPreviewUrl] = useState(null);
    useEffect(() => {
        let active = true;
        let generatedUrl = null;
        const loadPreview = async () => {
            const nextUrl = await createAttachmentPreviewUrl({
                filePath: attachment.filePath,
                mimeType: attachment.mimeType,
            });
            if (!active) {
                if (nextUrl) {
                    URL.revokeObjectURL(nextUrl);
                }
                return;
            }
            generatedUrl = nextUrl;
            setPreviewUrl(nextUrl);
        };
        void loadPreview();
        return () => {
            active = false;
            if (generatedUrl) {
                URL.revokeObjectURL(generatedUrl);
            }
        };
    }, [attachment.filePath, attachment.mimeType]);
    if (!previewUrl) {
        return _jsx("div", { className: "image-preview-placeholder", children: "Preview unavailable" });
    }
    return _jsx("img", { className: "attachment-image-preview", src: previewUrl, alt: attachment.caption || attachment.filename });
};
