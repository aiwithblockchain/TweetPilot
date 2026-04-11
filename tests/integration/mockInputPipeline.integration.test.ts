import { describe, it, expect, beforeEach } from 'vitest';
import { ingestMockCommentInputBatch } from '../../src/mocks/mockInputPipeline';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { getSample } from '../../src/mocks/commentInputSamples';

/**
 * E2E test for mock input pipeline visibility in platform
 * This test verifies that mock inputs can be ingested and are visible through the platform
 */
describe('Mock Input Pipeline - Platform Visibility E2E', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('mock input should be visible in platform after ingestion', async () => {
    // Setup: Create repository and ingest mock samples
    const samples = [getSample(0), getSample(1), getSample(2)];

    // Ingest mock inputs through the same pipeline as real inputs
    const ingested = await ingestMockCommentInputBatch(samples, repository);

    // Verify: All inputs were ingested
    expect(ingested).toHaveLength(3);

    // Verify: Inputs are retrievable from the platform fact layer
    for (const input of ingested) {
      const retrieved = await repository.findById(input.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(input.id);
    }

    // Verify: Inputs are properly attributed to workspace
    const workspaceInputs = await repository.findByWorkspaceId('ws-test-001');
    expect(workspaceInputs.length).toBeGreaterThanOrEqual(2);

    // Verify: Inputs are properly attributed to account
    const accountInputs = await repository.findByAccountId('acc-test-001');
    expect(accountInputs.length).toBeGreaterThanOrEqual(2);

    // Verify: All inputs are visible in platform-wide view
    const allInputs = await repository.findAll();
    expect(allInputs.length).toBeGreaterThanOrEqual(3);

    // Verify: Each input has required platform fact properties
    for (const input of ingested) {
      expect(input.id).toBeDefined();
      expect(input.workspaceId).toBeDefined();
      expect(input.accountId).toBeDefined();
      expect(input.content).toBeDefined();
      expect(input.createdAt).toBeInstanceOf(Date);
    }
  });

  it('mock inputs should persist as platform facts independent of UI state', async () => {
    const sample = getSample(0);

    // Ingest a mock input
    const ingested = await ingestMockCommentInputBatch([sample], repository);
    expect(ingested).toHaveLength(1);

    // Simulate platform restart or UI state change
    // The fact should still be retrievable
    const retrieved = await repository.findById(ingested[0].id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe(sample.content);

    // Verify it's stored as a fact, not transient UI state
    const allFacts = await repository.findAll();
    const fact = allFacts.find((f) => f.id === ingested[0].id);
    expect(fact).toBeDefined();
    expect(fact?.workspaceId).toBe(sample.workspaceId);
    expect(fact?.accountId).toBe(sample.accountId);
  });

  it('platform should show correct attribution for mock inputs', async () => {

    // Ingest inputs for different workspaces and accounts
    const ws001Sample = getSample(0); // ws-test-001, acc-test-001
    const ws002Sample = getSample(3); // ws-test-002, acc-test-003

    await ingestMockCommentInputBatch([ws001Sample, ws002Sample], repository);

    // Verify workspace attribution
    const ws001Inputs = await repository.findByWorkspaceId('ws-test-001');
    expect(ws001Inputs.some((i) => i.content === ws001Sample.content)).toBe(true);

    const ws002Inputs = await repository.findByWorkspaceId('ws-test-002');
    expect(ws002Inputs.some((i) => i.content === ws002Sample.content)).toBe(true);

    // Verify account attribution
    const acc001Inputs = await repository.findByAccountId('acc-test-001');
    expect(acc001Inputs.some((i) => i.content === ws001Sample.content)).toBe(true);

    const acc003Inputs = await repository.findByAccountId('acc-test-003');
    expect(acc003Inputs.some((i) => i.content === ws002Sample.content)).toBe(true);
  });

  it('mock input pipeline should use same normalization as real inputs', async () => {

    // Create two samples with content that should normalize to the same ID
    const sample1 = {
      ...getSample(0),
      content: '  Test Content  ', // Extra spaces
    };

    const sample2 = {
      ...getSample(0),
      content: 'test content', // Different case, no spaces
    };

    const ingested1 = await ingestMockCommentInputBatch([sample1], repository);
    const ingested2 = await ingestMockCommentInputBatch([sample2], repository);

    // Both should produce the same ID due to normalization
    expect(ingested1[0].id).toBe(ingested2[0].id);

    // Only one fact should exist in the platform
    const allInputs = await repository.findAll();
    const matchingInputs = allInputs.filter((i) => i.id === ingested1[0].id);
    expect(matchingInputs).toHaveLength(1);
  });
});
