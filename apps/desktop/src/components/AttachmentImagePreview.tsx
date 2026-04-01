import { useEffect, useState } from "react";
import type { AttachmentRecord } from "@notesmith/domain";
import { createAttachmentPreviewUrl } from "../lib/files/attachmentStore";

interface AttachmentImagePreviewProps {
  attachment: AttachmentRecord;
}

export const AttachmentImagePreview = ({ attachment }: AttachmentImagePreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let generatedUrl: string | null = null;

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
    return <div className="image-preview-placeholder">Preview unavailable</div>;
  }

  return <img className="attachment-image-preview" src={previewUrl} alt={attachment.caption || attachment.filename} />;
};
