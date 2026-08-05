import { AIRequestError } from "../client/openaiClient";
import { AI_PROMPT_PROFILE_VERSION } from "../prompts";
import { executeAITranscriptionOperation } from "../runtime";
const MAX_TRANSCRIPTION_UPLOAD_BYTES = 24 * 1024 * 1024;
const MAX_SINGLE_TRANSCRIPTION_DURATION_SECONDS = 12 * 60;
const MAX_PREFERRED_CHUNK_DURATION_SECONDS = 8 * 60;
const TRANSCRIPTION_SUBCHUNK_DURATION_SECONDS = 2 * 60;
const TRANSCRIPTION_OVERLAP_SECONDS = 1.5;
const TRANSCRIPTION_BOUNDARY_SEARCH_SECONDS = 20;
const MIN_PRIMARY_CHUNK_DURATION_SECONDS = 15;
const MIN_SPEECH_AWARE_CHUNK_DURATION_SECONDS = 45;
const MIN_RECURSIVE_CHUNK_DURATION_SECONDS = 18;
const PCM_16_BIT_MAX = 0x7fff;
const PCM_16_BIT_MIN = -0x8000;
const SILENCE_PEAK_THRESHOLD = 0.0035;
const SILENCE_AVERAGE_THRESHOLD = 0.0007;
const NEAR_SILENCE_PEAK_THRESHOLD = 0.01;
const NEAR_SILENCE_AVERAGE_THRESHOLD = 0.0018;
const inferTranscriptionMimeType = (filename) => {
    const extension = filename.split(".").pop()?.toLowerCase();
    if (extension === "mp3" || extension === "mpeg" || extension === "mpga")
        return "audio/mpeg";
    if (extension === "m4a")
        return "audio/mp4";
    if (extension === "wav")
        return "audio/wav";
    if (extension === "webm")
        return "audio/webm";
    if (extension === "ogg" || extension === "oga" || extension === "opus")
        return "audio/ogg";
    if (extension === "flac")
        return "audio/flac";
    if (extension === "aac")
        return "audio/aac";
    if (extension === "mp4")
        return "video/mp4";
    return "application/octet-stream";
};
const normalizeTranscriptionFile = (file) => !file.type || file.type === "application/octet-stream"
    ? new File([file], file.name, { type: inferTranscriptionMimeType(file.name) })
    : file;
const resolvePreferredTranscriptionModel = (settings) => settings.transcriptionModel === "gpt-4o-transcribe-diarize" ? "gpt-4o-transcribe" : settings.transcriptionModel;
const getFallbackTranscriptionModels = (model) => {
    if (model === "gpt-transcribe") {
        return ["gpt-4o-transcribe", "gpt-4o-mini-transcribe"];
    }
    if (model === "gpt-4o-mini-transcribe") {
        return ["gpt-4o-transcribe", "gpt-transcribe"];
    }
    if (model === "gpt-4o-transcribe") {
        return ["gpt-transcribe", "gpt-4o-mini-transcribe"];
    }
    return ["gpt-transcribe", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"].filter((candidate) => candidate !== model);
};
const resolveTranscriptionModels = ({ preferredModel, useChunking, }) => {
    if (useChunking) {
        return ["gpt-transcribe", "gpt-4o-transcribe"];
    }
    return [preferredModel, ...getFallbackTranscriptionModels(preferredModel)];
};
const createTranscriptionFormData = ({ file, model, }) => {
    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("model", model);
    formData.append("response_format", "json");
    return formData;
};
const stripFileExtension = (filename) => {
    const index = filename.lastIndexOf(".");
    return index > 0 ? filename.slice(0, index) : filename;
};
const getAudioContextConstructor = () => {
    if (typeof AudioContext !== "undefined") {
        return AudioContext;
    }
    const scopedGlobal = globalThis;
    return scopedGlobal.webkitAudioContext ?? null;
};
const decodeAudioFile = async (file) => {
    const AudioContextCtor = getAudioContextConstructor();
    if (!AudioContextCtor) {
        return null;
    }
    const audioContext = new AudioContextCtor();
    try {
        const buffer = await file.arrayBuffer();
        return await audioContext.decodeAudioData(buffer.slice(0));
    }
    finally {
        await audioContext.close().catch(() => undefined);
    }
};
const mixToMono = (audioBuffer, startFrame, endFrame) => {
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
const analyzeSampleWindow = (samples, startIndex, length) => {
    let peakAmplitude = 0;
    let totalAmplitude = 0;
    for (let index = 0; index < length; index += 1) {
        const amplitude = Math.abs(samples[startIndex + index] || 0);
        peakAmplitude = Math.max(peakAmplitude, amplitude);
        totalAmplitude += amplitude;
    }
    return {
        peakAmplitude,
        averageAmplitude: length ? totalAmplitude / length : 0,
    };
};
const analyzeSamples = (samples) => {
    const { peakAmplitude, averageAmplitude } = analyzeSampleWindow(samples, 0, samples.length);
    return {
        peakAmplitude,
        averageAmplitude,
        isLikelySilent: peakAmplitude < SILENCE_PEAK_THRESHOLD && averageAmplitude < SILENCE_AVERAGE_THRESHOLD,
    };
};
const estimateMaxChunkDurationSeconds = (sampleRate) => Math.max(MIN_PRIMARY_CHUNK_DURATION_SECONDS, Math.floor((MAX_TRANSCRIPTION_UPLOAD_BYTES - 44) / Math.max(1, sampleRate * 2)));
const findSpeechAwareCutFrame = ({ audioBuffer, desiredEndFrame, minEndFrame, }) => {
    const sampleRate = audioBuffer.sampleRate;
    const searchFrames = Math.max(1, Math.floor(sampleRate * TRANSCRIPTION_BOUNDARY_SEARCH_SECONDS));
    const silenceWindowFrames = Math.max(1, Math.floor(sampleRate * 0.28));
    const stepFrames = Math.max(1, Math.floor(sampleRate * 0.05));
    const searchStartFrame = Math.max(minEndFrame, desiredEndFrame - searchFrames);
    const searchSamples = mixToMono(audioBuffer, searchStartFrame, desiredEndFrame);
    for (let localStart = Math.max(0, searchSamples.length - silenceWindowFrames); localStart >= 0; localStart -= stepFrames) {
        const { peakAmplitude, averageAmplitude } = analyzeSampleWindow(searchSamples, localStart, Math.min(silenceWindowFrames, searchSamples.length - localStart));
        if (peakAmplitude < SILENCE_PEAK_THRESHOLD && averageAmplitude < SILENCE_AVERAGE_THRESHOLD) {
            return Math.max(minEndFrame, searchStartFrame + localStart);
        }
    }
    return desiredEndFrame;
};
const encodeMonoWav = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeAscii = (offset, value) => {
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
        const pcmValue = normalized < 0 ? Math.round(normalized * -PCM_16_BIT_MIN) : Math.round(normalized * PCM_16_BIT_MAX);
        view.setInt16(offset, Math.max(PCM_16_BIT_MIN, Math.min(PCM_16_BIT_MAX, pcmValue)), true);
        offset += 2;
    }
    return buffer;
};
const buildChunkedAudioFiles = ({ sourceFile, audioBuffer, chunkDurationSeconds, speechAwareBoundaries, overlapSeconds, }) => {
    const chunkFrameLength = Math.max(1, Math.floor(audioBuffer.sampleRate * chunkDurationSeconds));
    const overlapFrames = Math.max(0, Math.floor(audioBuffer.sampleRate * overlapSeconds));
    const minChunkFrames = Math.max(1, Math.floor(audioBuffer.sampleRate *
        Math.min(MIN_SPEECH_AWARE_CHUNK_DURATION_SECONDS, Math.max(15, chunkDurationSeconds * 0.65))));
    const chunkFiles = [];
    const baseName = stripFileExtension(sourceFile.name);
    let startFrame = 0;
    let chunkIndex = 0;
    while (startFrame < audioBuffer.length) {
        const desiredEndFrame = Math.min(audioBuffer.length, startFrame + chunkFrameLength);
        const minEndFrame = Math.min(audioBuffer.length, startFrame + minChunkFrames);
        let endFrame = desiredEndFrame;
        if (speechAwareBoundaries && desiredEndFrame < audioBuffer.length && desiredEndFrame > minEndFrame) {
            endFrame = findSpeechAwareCutFrame({
                audioBuffer,
                desiredEndFrame,
                minEndFrame,
            });
        }
        if (endFrame <= startFrame) {
            endFrame = desiredEndFrame;
        }
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
        if (endFrame >= audioBuffer.length) {
            break;
        }
        const nextStartFrame = Math.max(startFrame + 1, Math.max(0, endFrame - overlapFrames));
        startFrame = nextStartFrame <= startFrame ? endFrame : nextStartFrame;
        chunkIndex += 1;
    }
    return chunkFiles;
};
const shouldRetryAsChunks = (error) => error instanceof AIRequestError &&
    error.code === "upstream-error" &&
    error.status === 400 &&
    /instructions\s*\+\s*audio|audio is too large for this model|too large for this model/i.test(error.message);
const shouldRetryInvalidResponseAsChunks = ({ error, decodedDurationSeconds, }) => error instanceof AIRequestError &&
    error.code === "invalid-response" &&
    Number.isFinite(decodedDurationSeconds) &&
    decodedDurationSeconds > 60;
const transcribeSingleFile = async ({ file, settings, onEvent, model, }) => executeAITranscriptionOperation({
    settings,
    formData: createTranscriptionFormData({ file, model }),
    operation: "transcribe-audio",
    promptVersion: AI_PROMPT_PROFILE_VERSION,
    onEvent,
});
const shouldSkipChunkError = (error, chunkFile) => error instanceof AIRequestError &&
    error.code === "invalid-response" &&
    chunkFile.durationSeconds <= 90 &&
    chunkFile.peakAmplitude < NEAR_SILENCE_PEAK_THRESHOLD &&
    chunkFile.averageAmplitude < NEAR_SILENCE_AVERAGE_THRESHOLD;
const normalizeTranscriptWords = (text) => text
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase())
    .filter(Boolean);
const appendTranscriptWithOverlap = (existing, next) => {
    const trimmedExisting = existing.trim();
    const trimmedNext = next.trim();
    if (!trimmedExisting)
        return trimmedNext;
    if (!trimmedNext)
        return trimmedExisting;
    const nextWords = trimmedNext.split(/\s+/);
    const normalizedPreviousWords = normalizeTranscriptWords(trimmedExisting);
    const normalizedNextWords = normalizeTranscriptWords(trimmedNext);
    const maxOverlap = Math.min(30, normalizedPreviousWords.length, normalizedNextWords.length);
    for (let overlapLength = maxOverlap; overlapLength >= 5; overlapLength -= 1) {
        const previousSlice = normalizedPreviousWords.slice(-overlapLength).join(" ");
        const nextSlice = normalizedNextWords.slice(0, overlapLength).join(" ");
        if (previousSlice && previousSlice === nextSlice) {
            return [trimmedExisting, nextWords.slice(overlapLength).join(" ").trim()].filter(Boolean).join("\n\n").trim();
        }
    }
    return `${trimmedExisting}\n\n${trimmedNext}`.trim();
};
const transcribeFileWithModelFallback = async ({ file, settings, onEvent, models, }) => {
    let lastError = null;
    for (const model of models) {
        try {
            return await transcribeSingleFile({
                file,
                settings,
                onEvent,
                model,
            });
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
};
const transcribeDecodedAudioInChunks = async ({ sourceFile, audioBuffer, settings, onEvent, chunkDurationSeconds, models, }) => {
    const chunkFiles = buildChunkedAudioFiles({
        sourceFile,
        audioBuffer,
        chunkDurationSeconds,
        speechAwareBoundaries: true,
        overlapSeconds: TRANSCRIPTION_OVERLAP_SECONDS,
    });
    if (chunkFiles.length <= 1) {
        return transcribeFileWithModelFallback({ file: sourceFile, settings, onEvent, models });
    }
    let mergedTranscript = "";
    for (const chunkFile of chunkFiles) {
        if (chunkFile.isLikelySilent) {
            continue;
        }
        let chunkTranscript;
        try {
            chunkTranscript = await transcribeFileWithModelFallback({
                file: chunkFile.file,
                settings,
                onEvent,
                models,
            });
        }
        catch (error) {
            if (shouldSkipChunkError(error, chunkFile)) {
                continue;
            }
            if (error instanceof AIRequestError && chunkFile.durationSeconds > MIN_RECURSIVE_CHUNK_DURATION_SECONDS) {
                const nestedAudio = await decodeAudioFile(chunkFile.file);
                if (!nestedAudio) {
                    throw error;
                }
                const nextChunkDurationSeconds = Math.max(MIN_PRIMARY_CHUNK_DURATION_SECONDS, Math.min(TRANSCRIPTION_SUBCHUNK_DURATION_SECONDS, Math.floor(chunkFile.durationSeconds / 2)));
                chunkTranscript = await transcribeDecodedAudioInChunks({
                    sourceFile: chunkFile.file,
                    audioBuffer: nestedAudio,
                    settings,
                    onEvent,
                    chunkDurationSeconds: nextChunkDurationSeconds,
                    models,
                });
            }
            else {
                throw error;
            }
        }
        const trimmedTranscript = chunkTranscript.trim();
        if (trimmedTranscript) {
            mergedTranscript = appendTranscriptWithOverlap(mergedTranscript, trimmedTranscript);
        }
    }
    const finalTranscript = mergedTranscript.trim();
    if (finalTranscript) {
        return finalTranscript;
    }
    throw new AIRequestError({
        message: "OpenAI returned chunk transcripts without readable text.",
        code: "invalid-response",
        operation: "transcribe-audio",
        retryable: false,
    });
};
const transcribeInChunks = async ({ file, decodedAudio, settings, onEvent, models, }) => {
    const resolvedAudio = decodedAudio ?? (await decodeAudioFile(file));
    if (!resolvedAudio) {
        throw new Error("This runtime could not decode the audio file for chunked transcription.");
    }
    const maxChunkDurationSeconds = Math.min(MAX_PREFERRED_CHUNK_DURATION_SECONDS, estimateMaxChunkDurationSeconds(resolvedAudio.sampleRate));
    return transcribeDecodedAudioInChunks({
        sourceFile: file,
        audioBuffer: resolvedAudio,
        settings,
        onEvent,
        chunkDurationSeconds: maxChunkDurationSeconds,
        models,
    });
};
export const transcribeAudio = async ({ file, settings, onEvent, }) => {
    const normalizedFile = normalizeTranscriptionFile(file);
    const decodedAudio = await decodeAudioFile(normalizedFile).catch(() => null);
    const primaryModel = resolvePreferredTranscriptionModel(settings);
    const decodedDurationSeconds = decodedAudio ? decodedAudio.duration : 0;
    const shouldChunk = Boolean(decodedAudio) &&
        ((Number.isFinite(decodedDurationSeconds) && decodedDurationSeconds > MAX_SINGLE_TRANSCRIPTION_DURATION_SECONDS) ||
            normalizedFile.size > MAX_TRANSCRIPTION_UPLOAD_BYTES);
    const models = resolveTranscriptionModels({
        preferredModel: primaryModel,
        useChunking: shouldChunk,
    });
    if (decodedAudio && shouldChunk) {
        return transcribeInChunks({
            file: normalizedFile,
            decodedAudio,
            settings,
            onEvent,
            models,
        });
    }
    try {
        return await transcribeFileWithModelFallback({
            file: normalizedFile,
            settings,
            onEvent,
            models,
        });
    }
    catch (error) {
        const shouldRetryWithChunks = shouldRetryAsChunks(error) ||
            shouldRetryInvalidResponseAsChunks({
                error,
                decodedDurationSeconds,
            });
        if (!shouldRetryWithChunks) {
            throw error;
        }
        return transcribeInChunks({
            file: normalizedFile,
            decodedAudio,
            settings,
            onEvent,
            models,
        });
    }
};
