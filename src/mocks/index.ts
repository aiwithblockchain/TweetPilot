// Mock input pipeline exports
// This module provides standardized mock inputs that reuse the same normalization
// and persistence pipeline as real inputs

export {
  STANDARD_COMMENT_SAMPLES,
  getSample,
  getSamplesByWorkspace,
  getSamplesByAccount,
} from './commentInputSamples';

export {
  ingestMockCommentInput,
  ingestMockCommentInputBatch,
  verifyMockInputPersisted,
} from './mockInputPipeline';
