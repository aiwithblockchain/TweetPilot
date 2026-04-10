// Mock input pipeline - reuses real normalization and fact layer entry
// This ensures mock inputs follow the same path as real inputs

import { createCommentInput, type CreateCommentInputParams, type CommentInput } from '../domain/commentInput';
import type { ICommentInputRepository } from '../data/commentInputRepository';

/**
 * Mock input pipeline entry point
 * This function takes raw comment input parameters and processes them
 * through the same normalization and persistence path as real inputs
 */
export async function ingestMockCommentInput(
  params: CreateCommentInputParams,
  repository: ICommentInputRepository
): Promise<CommentInput> {
  // Step 1: Normalize using the same domain logic as real inputs
  const normalizedInput = createCommentInput(params);

  // Step 2: Write to fact layer using the same repository interface
  await repository.save(normalizedInput);

  // Step 3: Return the persisted fact
  return normalizedInput;
}

/**
 * Batch ingest multiple mock inputs
 * Useful for seeding test data or development scenarios
 */
export async function ingestMockCommentInputBatch(
  paramsList: CreateCommentInputParams[],
  repository: ICommentInputRepository
): Promise<CommentInput[]> {
  const results: CommentInput[] = [];

  for (const params of paramsList) {
    const input = await ingestMockCommentInput(params, repository);
    results.push(input);
  }

  return results;
}

/**
 * Verify that a mock input was successfully persisted
 * Returns true if the input exists in the repository
 */
export async function verifyMockInputPersisted(
  inputId: string,
  repository: ICommentInputRepository
): Promise<boolean> {
  return await repository.exists(inputId);
}
