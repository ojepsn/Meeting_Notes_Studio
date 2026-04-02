import { describe, expect, it } from "vitest";
import {
  buildRecordingFilename,
  getSupportedRecordingMimeType,
  getSystemAudioDisplayOptions,
} from "./recording";

describe("buildRecordingFilename", () => {
  it("creates a safe webm filename from the session title", () => {
    const filename = buildRecordingFilename({
      sessionTitle: "Weekly Project Meeting / Alpha",
      captureMode: "meeting-note",
    });

    expect(filename).toMatch(/^weekly-project-meeting-alpha-\d{4}-\d{2}-\d{2}T/);
    expect(filename.endsWith(".webm")).toBe(true);
  });

  it("falls back to capture mode when title is blank", () => {
    const filename = buildRecordingFilename({
      sessionTitle: "   ",
      captureMode: "voice-note",
    });

    expect(filename.startsWith("voice-note-")).toBe(true);
  });
});

describe("getSupportedRecordingMimeType", () => {
  it("prefers opus webm when supported", () => {
    const mimeType = getSupportedRecordingMimeType({
      isTypeSupported: (value) => value === "audio/webm;codecs=opus" || value === "audio/webm",
    });

    expect(mimeType).toBe("audio/webm;codecs=opus");
  });

  it("falls back to plain webm when opus is not supported", () => {
    const mimeType = getSupportedRecordingMimeType({
      isTypeSupported: (value) => value === "audio/webm",
    });

    expect(mimeType).toBe("audio/webm");
  });

  it("returns an empty string when nothing is supported", () => {
    const mimeType = getSupportedRecordingMimeType({
      isTypeSupported: () => false,
    });

    expect(mimeType).toBe("");
  });
});

describe("getSystemAudioDisplayOptions", () => {
  it("requests display capture with audio included", () => {
    const options = getSystemAudioDisplayOptions();

    expect(options.video).toBe(true);
    expect(options.audio).toBe(true);
    expect(options.systemAudio).toBe("include");
  });
});
