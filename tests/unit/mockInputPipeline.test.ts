import { describe, it, expect, beforeEach } from 'vitest';
import { ingestMockCommentInput, ingestMockCommentInputBatch, verifyMockInputPersisted } from '../../src/mocks/mockInputPipeline';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { STANDARD_COMMENT_SAMPLES, getSample, getSamplesByWorkspace, getSamplesByAccount } from '../../src/mocks/commentInputSamples';
import { generateCommentInputId } from '../../src/domain/commentInput';

describe('Mock Input Pipeline - Sample Normalization', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  describe('Sample normalization', () => {
    it('should normalize sample input using the same domain logic as real inputs', async () => {
      const sample = getSample(0);
      const expectedId = generateCommentInputId(sample);

      const result = await ingestMockCommentInput(sample, repository);

      expect(result.id).toBe(expectedId);
      expect(result.workspaceId).toBe(sample.workspaceId);
      expect(result.accountId).toBe(sample.accountId);
      expect(result.content).toBe(sample.content);
      expect(result.targetTweetId).toBe(sample.targetTweetId);
      expect(result.targetTweetUrl).toBe(sample.targetTweetUrl);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should produce consistent IDs for identical sample content', async () => {
      const sample = getSample(0);

      const result1 = await ingestMockCommentInput(sample, repository);
      const result2 = await ingestMockCommentInput(sample, repository);

      expect(result1.id).toBe(result2.id);
    });

    it('should normalize content the same way as real inputs (case-insensitive, trimmed)', async () => {
      const sample1 = {
        ...getSample(0),
        content: '  Test Content  ',
      };

      const sample2 = {
        ...getSample(0),
        content: 'test content',
      };

      const result1 = await ingestMockCommentInput(sample1, repository);
      const result2 = await ingestMockCommentInput(sample2, repository);

      expect(result1.id).toBe(result2.id);
    });
  });

  describe('Sample helpers', () => {
    it('should retrieve samples by workspace', () => {
      const ws001Samples = getSamplesByWorkspace('ws-test-001');
      expect(ws001Samples.length).toBeGreaterThan(0);
      expect(ws001Samples.every((s) => s.workspaceId === 'ws-test-001')).toBe(true);
    });

    it('should retrieve samples by account', () => {
      const acc001Samples = getSamplesByAccount('acc-test-001');
      expect(acc001Samples.length).toBeGreaterThan(0);
      expect(acc001Samples.every((s) => s.accountId === 'acc-test-001')).toBe(true);
    });

    it('should have at least 4 standard samples', () => {
      expect(STANDARD_COMMENT_SAMPLES.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Batch ingestion', () => {
    it('should ingest multiple samples using the same normalization', async () => {
      const samples = [getSample(0), getSample(1), getSample(2)];

      const results = await ingestMockCommentInputBatch(samples, repository);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe(generateCommentInputId(samples[0]));
      expect(results[1].id).toBe(generateCommentInputId(samples[1]));
      expect(results[2].id).toBe(generateCommentInputId(samples[2]));
    });
  });

  describe('Verification', () => {
    it('should verify that mock input was persisted', async () => {
      const sample = getSample(0);
      const result = await ingestMockCommentInput(sample, repository);

      const exists = await verifyMockInputPersisted(result.id, repository);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent input', async () => {
      const exists = await verifyMockInputPersisted('non-existent-id', repository);
      expect(exists).toBe(false);
    });
  });
});
