import type { LocalAppSettings } from "@notesmith/domain";
import { AI_PROMPT_PROFILE_VERSION } from "../prompts";
import type { AIRuntimeEvent } from "../runtime";
import { executeAITranscriptionOperation } from "../runtime";
import { AIRequestError } from "../client/openaiClient";

const MAX_SINGLE_TRANSCRIPTION_DURATION_SECONDS = 12 * 60;
const TRANSCRIPTION_CHUNK_DURATION_SECONDS = 10 * 60;
const PCM_16_BIT_MAX = 0x7fff;
const PCM_16_BIT_MIN = -0x8000;
const SILENCE_PEAK_THRESHOLD = 0.0035;
const SILENCE_AVERAGE_THRESHOLD = 0.0007;
const NEAR_SILENCE_PEAK_THRESHOLD = 0.01;
const NEAR_SILENCE_AVERAGE_THRESHOLD = 0.0018;

interface ChunkedAudioFile {
  file: File;
  durationSeconds: number;
  peakAmplitude: number;
  averageAmplitude: number;
  isLikelySilent: boolean;
}

const inferTranscriptionMimeType = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "mp3" || extension === "mpeg" || extension === "mpga") return "audio/mpeg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "wav") return "audio/wav";
  if (extension === "webm") return "audio/webm";
  if (extension === "ogg" || extension === "oga" || extension === "opus") return "audio/ogg";
  if (extension === "flac") return "audio/flac";
  if (extension === "aac") return "audio/aac";
  if (extension === "mp4") return "video/mp4";
  return "application/octet-stream";
};

const normalizeTranscriptionFile = (file: File) =>
  !file.type || file.type === "application/octet-stream"
    ? new File([file], file.name, { type: inferTranscriptionMimeType(file.name) })
    : file;

const createTranscriptionFormData = (file: File, settings: LocalAppSettings) => {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("model", settings.transcriptionModel);
  formData.append("response_format", "json");
  formData.append("chunking_strategy", "auto");
  if (!settings.transcriptionModel.includes("diarize")) {
    formData.append("prompt", "Transcribe faithfully and clearly.");
  }
  return formData;
};

const stripFileExtension = (filename: string) => {
  const index = filename.lastIndexOf(".");
  return index > 0 ? filename.slice(0, index) : filename;
};

const getAudioContextConstructor = () => {
  if (typeof AudioContext !== "undefined") {
    return AudioContext;
  }
  const scopedGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  return scopedGlobal.webkitAudioContext ?? null;
};

const decodeAudioFile = async (file: File) => {
  const AudioContextCtor = getAudioContextConstructor();
  if (!AudioContextCtor) {
    return null;
  }
  const audioContext = new AudioContextCtor();
  try {
    const buffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(buffer.slice(0));
  } finally {
    await audioContext.close().catch(() => undefined);
  }
};

const mixToMono = (audioBuffer: AudioBuffer, startFrame: number, endFrame: number) => {
  const channelCount = Math.max(1, audioBuffer.numberOfChannels);
  const frameCount = Math.max(0, endFrame - startFrame);
  const mono = new Float32Array(frameCount);

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    const channelData = audioBuffer.getChannelData(channelIndex);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      mono[frameIndex] += channelData[startFrame + frameIndex] / channelCount;
    }
  }

  return mono;
};

const analyzeSamples = (samples: Float32Array) => {
  let peakAmplitude = 0;
  let totalAmplitude = 0;

  for (let index = 0; index < samples.length; index += 1) {
    const amplitude = Math.abs(samples[index]);
    peakAmplitude = Math.max(peakAmplitude, amplitude);
    totalAmplitude += amplitude;
  }

  const averageAmplitude = samples.length ? totalAmplitude / samples.length : 0;
  return {
    peakAmplitude,
    averageAmplitude,
    isLikelySilent: peakAmplitude < SILENCE_PEAK_THRESHOLD && averageAmplitude < SILENCE_AVERAGE_THRESHOLD,
  };
};

const encodeMonoWav = (samples: Float32Array, sampleRate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const normalized = Math.max(-1, Math.min(1, samples[index]));
    const pcmValue =
      normalized < 0 ? Math.round(normalized * -PCM_16_BIT_MIN) : Math.round(normalized * PCM_16_BIT_MAX);
    view.setInt16(offset, Math.max(PCM_16_BIT_MIN, Math.min(PCM_16_BIT_MAX, pcmValue)), true);
    offset += 2;
  }

  return buffer;
};

const buildChunkedAudioFiles = (sourceFile: File, audioBuffer: AudioBuffer) => {
  const chunkFrameLength = Math.max(1, Math.floor(audioBuffer.sampleRate * TRANSCRIPTION_CHUNK_DURATION_SECONDS));
  const chunkFiles: ChunkedAudioFile[] = [];
  const baseName = stripFileExtension(sourceFile.name);
  const totalChunks = Math.max(1, Math.ceil(audioBuffer.length / chunkFrameLength));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const startFrame = chunkIndex * chunkFrameLength;
    const endFrame = Math.min(audioBuffer.length, startFrame + chunkFrameLength);
    const monoSamples = mixToMono(audioBuffer, startFrame, endFrame);
    const analysis = analyzeSamples(monoSamples);
    const wavBuffer = encodeMonoWav(monoSamples, audioBuffer.sampleRate);
    const paddedChunkIndex = String(chunkIndex + 1).padStart(2, "0");
    chunkFiles.push({
      file: new File([wavBuffer], `${baseName}-part-${paddedChunkIndex}.wav`, {
        type: "audio/wav",
      }),
      durationSeconds: monoSamples.length / audioBuffer.sampleRate,
      peakAmplitude: analysis.peakAmplitude,
      averageAmplitude: analysis.averageAmplitude,
      isLikelySilent: analysis.isLikelySilent,
    });
  }

  return chunkFiles;
};

const shouldRetryAsChunks = (error: unknown) =>
  error instanceof AIRequestError &&
  error.code === "upstream-error" &&
  error.status === 400 &&
  /instructions\s*\+\s*audio|audio is too large for this model|too large for this model/i.test(error.message);

const transcribeSingleFile = async ({
  file,
  settings,
  onEvent,
}: {
  file: File;
  settings: LocalAppSettings;
  onEvent?: (event: AIRuntimeEvent) => void;
}) =>
  executeAITranscriptionOperation({
    settings,
    formData: createTranscriptionFormData(file, settings),
    operation: "transcribe-audio",
    promptVersion: AI_PROMPT_PROFILE_VERSION,
    onEvent,
  });

const transcribeInChunks = async ({
  file,
  decodedAudio,
  settings,
  onEvent,
}: {
  file: File;
  decodedAudio?: AudioBuffer | null;
  settings: LocalAppSettings;
  onEvent?: (event: AIRuntimeEvent) => void;
}) => {
  const resolvedAudio = decodedAudio ?? (await decodeAudioFile(file));
  if (!resolvedAudio) {
    throw new Error("This runtime could not decode the audio file for chunked transcription.");
  }

  const chunkFiles = buildChunkedAudioFiles(file, resolvedAudio);
  if (chunkFiles.length <= 1) {
    return transcribeSingleFile({ file, settings, onEvent });
  }

  const transcripts: string[] = [];
  for (const chunkFile of chunkFiles) {
    if (chunkFile.isLikelySilent) {
      continue;
    }
    let chunkTranscript: string;
    try {
      chunkTranscript = await transcribeSingleFile({
        file: chunkFile.file,
        settings,
        onEvent,
      });
    } catch (error) {
      if (
        error instanceof AIRequestError &&
        error.code === "invalid-response" &&
        chunkFile.durationSeconds <= 90 &&
        chunkFile.peakAmplitude < NEAR_SILENCE_PEAK_THRESHOLD &&
        chunkFile.averageAmplitude < NEAR_SILENCE_AVERAGE_THRESHOLD
      ) {
        continue;
      }
      throw error;
    }
    const trimmedTranscript = chunkTranscript.trim();
    if (trimmedTranscript) {
      transcripts.push(trimmedTranscript);
    }
  }

  return transcripts.join("\n\n").trim();
};

export const transcribeAudio = async ({
  file,
  settings,
  onEvent,
}: {
  file: File;
  settings: LocalAppSettings;
  onEvent?: (event: AIRuntimeEvent) => void;
}) => {
  const normalizedFile = normalizeTranscriptionFile(file);
  const decodedAudio = await decodeAudioFile(normalizedFile).catch(() => null);

  if (
    decodedAudio &&
    Number.isFinite(decodedAudio.duration) &&
    decodedAudio.duration > MAX_SINGLE_TRANSCRIPTION_DURATION_SECONDS
  ) {
    return transcribeInChunks({
      file: normalizedFile,
      decodedAudio,
      settings,
      onEvent,
    });
  }

  try {
    return await transcribeSingleFile({
      file: normalizedFile,
      settings,
      onEvent,
    });
  } catch (error) {
    if (!shouldRetryAsChunks(error)) {
      throw error;
    }
    return transcribeInChunks({
      file: normalizedFile,
      decodedAudio,
      settings,
      onEvent,
    });
  }
};
