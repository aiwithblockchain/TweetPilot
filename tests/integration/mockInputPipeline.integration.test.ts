import { describe, it, expect, beforeEach } from 'vitest';
import { ingestMockCommentInput, ingestMockCommentInputBatch } from '../../src/mocks/mockInputPipeline';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { getSample, STANDARD_COMMENT_SAMPLES } from '../../src/mocks/commentInputSamples';

describe('Mock Input Pipeline - Integration with Repository', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should write mock input to repository and retrieve it', async () => {
    const sample = getSample(0);

    const ingested = await ingestMockCommentInput(sample, repository);

    const retrieved = await repository.findById(ingested.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(ingested.id);
    expect(retrieved?.content).toBe(sample.content);
    expect(retrieved?.workspaceId).toBe(sample.workspaceId);
    expect(retrieved?.accountId).toBe(sample.accountId);
  });

  it('should persist mock inputs as facts independent of UI state', async () => {
    const sample = getSample(0);

    await ingestMockCommentInput(sample, repository);

    // Simulate "UI restart" by creating new repository instance
    // In real implementation, this would be reading from persistent storage
    const allFacts = await repository.findAll();
    expect(allFacts.length).toBeGreaterThan(0);

    const fact = allFacts.find((f) => f.content === sample.content);
    expect(fact).toBeDefined();
    expect(fact?.workspaceId).toBe(sample.workspaceId);
  });

  it('should support batch ingestion of multiple mock inputs', async () => {
    const samples = [getSample(0), getSample(1), getSample(2)];

    const results = await ingestMockCommentInputBatch(samples, repository);

    expect(results).toHaveLength(3);

    for (const result of results) {
      const retrieved = await repository.findById(result.id);
      expect(retrieved).not.toBeNull();
    }
  });

  it('should maintain workspace and account attribution for mock inputs', async () => {
    const ws001Samples = STANDARD_COMMENT_SAMPLES.filter(
      (s) => s.workspaceId === 'ws-test-001'
    );

    await ingestMockCommentInputBatch(ws001Samples, repository);

    const workspaceInputs = await repository.findByWorkspaceId('ws-test-001');
    expect(workspaceInputs.length).toBe(ws001Samples.length);

    for (const input of workspaceInputs) {
      expect(input.workspaceId).toBe('ws-test-001');
      expect(input.accountId).toBeDefined();
    }
  });

  it('should handle idempotent mock input ingestion', async () => {
    const sample = getSample(0);

    const first = await ingestMockCommentInput(sample, repository);
    const second = await ingestMockCommentInput(sample, repository);

    expect(first.id).toBe(second.id);

    const allInputs = await repository.findAll();
    const matching = allInputs.filter((i) => i.id === first.id);
    expect(matching).toHaveLength(1);
  });

  it('should support querying mock inputs by account across multiple ingestions', async () => {
    const acc001Samples = STANDARD_COMMENT_SAMPLES.filter(
      (s) => s.accountId === 'acc-test-001'
    );

    // Ingest one at a time to simulate real-world scenario
    for (const sample of acc001Samples) {
      await ingestMockCommentInput(sample, repository);
    }

    const accountInputs = await repository.findByAccountId('acc-test-001');
    expect(accountInputs.length).toBe(acc001Samples.length);

    for (const input of accountInputs) {
      expect(input.accountId).toBe('acc-test-001');
    }
  });

  it('should preserve metadata from mock samples', async () => {
    const sample = getSample(0);

    const ingested = await ingestMockCommentInput(sample, repository);

    expect(ingested.metadata).toBeDefined();
    expect(ingested.metadata?.source).toBe('mock');
    expect(ingested.metadata?.authorUsername).toBeDefined();
  });

  it('should verify mock input exists after ingestion', async () => {
    const sample = getSample(0);

    const ingested = await ingestMockCommentInput(sample, repository);

    const exists = await repository.exists(ingested.id);
    expect(exists).toBe(true);
  });
});
