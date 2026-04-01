import { AIRequestError } from "./client/openaiClient";

export const formatAIErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof AIRequestError)) {
    return error instanceof Error ? error.message : fallback;
  }

  switch (error.code) {
    case "missing-api-key":
      return error.message;
    case "network-error":
      return "Could not reach OpenAI. Check your network connection and try again.";
    case "timeout":
      return "The AI request took too long to finish. Please try again.";
    case "rate-limited":
      return "OpenAI is rate limiting requests right now. Wait a moment and try again.";
    case "invalid-response":
      return "OpenAI returned an unreadable response. Please try again.";
    case "upstream-error":
      return error.message || fallback;
    default:
      return fallback;
  }
};