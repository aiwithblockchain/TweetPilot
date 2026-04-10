// Mock input pipeline exports
// This module provides standardized mock inputs that reuse the same normalization
// and persistence pipeline as real inputs

export {
	getSample,
	getSamplesByAccount,
	getSamplesByWorkspace,
	STANDARD_COMMENT_SAMPLES,
} from "./commentInputSamples";

export {
	ingestMockCommentInput,
	ingestMockCommentInputBatch,
	verifyMockInputPersisted,
} from "./mockInputPipeline";
