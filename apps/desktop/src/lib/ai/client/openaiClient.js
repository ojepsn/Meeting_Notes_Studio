const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const assertApiKey = (apiKey) => {
    if (!apiKey.trim()) {
        throw new Error("Add an OpenAI API key in desktop settings before using AI features.");
    }
};
export const callResponsesApi = async ({ apiKey, body }) => {
    assertApiKey(apiKey);
    const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(`OpenAI request failed: ${message}`);
    }
    return response.json();
};
export const callTranscriptionsApi = async ({ apiKey, formData, }) => {
    assertApiKey(apiKey);
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const message = await response.text();
        throw new Error(`Audio transcription failed: ${message}`);
    }
    return response.json();
};
