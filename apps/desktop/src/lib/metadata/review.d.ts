import type { LocalAppSettings, SessionRecord } from "@notesmith/domain";
export type ReviewBucket = "people" | "domains" | "projects" | "activities";
export type MetadataReviewState = Record<ReviewBucket, string[]>;
export declare const EMPTY_METADATA_REVIEW: MetadataReviewState;
export declare const buildMetadataReview: (session: SessionRecord | null, settings: LocalAppSettings | null) => MetadataReviewState;
