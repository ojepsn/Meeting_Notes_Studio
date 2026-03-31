interface OpenAIRequestOptions {
    apiKey: string;
    body: Record<string, unknown>;
}
export declare const callResponsesApi: ({ apiKey, body }: OpenAIRequestOptions) => Promise<any>;
export declare const callTranscriptionsApi: ({ apiKey, formData, }: {
    apiKey: string;
    formData: FormData;
}) => Promise<any>;
export {};
