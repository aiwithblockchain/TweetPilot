import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CommentInputList from '../../src/features/commentInput/CommentInputList';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { ingestMockCommentInputBatch } from '../../src/mocks/mockInputPipeline';
import { getSample } from '../../src/mocks/commentInputSamples';

describe('CommentInputList - E2E: Input Injection to Platform Visibility', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should complete full pipeline: mock input injection to platform visibility', async () => {
    // Step 1: Inject mock input through pipeline
    const sample = getSample(0);
    const ingested = await ingestMockCommentInputBatch([sample], repository);

    expect(ingested).toHaveLength(1);
    expect(ingested[0].content).toBe(sample.content);

    // Step 2: Render UI component
    render(<CommentInputList repository={repository} />);

    // Step 3: Verify input is visible in platform
    await waitFor(() => {
      expect(screen.getByText(sample.content)).toBeInTheDocument();
    });

    // Step 4: Verify attribution is visible
    await waitFor(() => {
      expect(screen.getByText(new RegExp(sample.workspaceId))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(sample.accountId))).toBeInTheDocument();
    });

    // Step 5: Verify source tracking is visible
    await waitFor(() => {
      expect(screen.getByText(/source: mock/i)).toBeInTheDocument();
    });
  });

  it('should display multiple inputs with correct attribution', async () => {
    // Inject multiple inputs from different workspaces and accounts
    const samples = [
      getSample(0), // ws-test-001, acc-test-001
      getSample(1), // ws-test-001, acc-test-001
      getSample(2), // ws-test-001, acc-test-002
      getSample(3), // ws-test-002, acc-test-003
    ];

    await ingestMockCommentInputBatch(samples, repository);

    render(<CommentInputList repository={repository} />);

    // Verify all inputs are visible
    await waitFor(() => {
      samples.forEach((sample) => {
        expect(screen.getByText(sample.content)).toBeInTheDocument();
      });
    });

    // Verify count is correct
    await waitFor(() => {
      expect(screen.getByText(/comment inputs \(4\)/i)).toBeInTheDocument();
    });
  });

  it('should support workspace-filtered view', async () => {
    const samples = [
      getSample(0), // ws-test-001
      getSample(1), // ws-test-001
      getSample(3), // ws-test-002
    ];

    await ingestMockCommentInputBatch(samples, repository);

    // Render with workspace filter
    render(<CommentInputList repository={repository} workspaceId="ws-test-001" />);

    await waitFor(() => {
      expect(screen.getByText(samples[0].content)).toBeInTheDocument();
      expect(screen.getByText(samples[1].content)).toBeInTheDocument();
      expect(screen.queryByText(samples[2].content)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/comment inputs \(2\)/i)).toBeInTheDocument();
    });
  });

  it('should support account-filtered view', async () => {
    const samples = [
      getSample(0), // acc-test-001
      getSample(1), // acc-test-001
      getSample(2), // acc-test-002
    ];

    await ingestMockCommentInputBatch(samples, repository);

    // Render with account filter
    render(<CommentInputList repository={repository} accountId="acc-test-001" />);

    await waitFor(() => {
      expect(screen.getByText(samples[0].content)).toBeInTheDocument();
      expect(screen.getByText(samples[1].content)).toBeInTheDocument();
      expect(screen.queryByText(samples[2].content)).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/comment inputs \(2\)/i)).toBeInTheDocument();
    });
  });

  it('should persist inputs as facts across UI remounts', async () => {
    const sample = getSample(0);
    await ingestMockCommentInputBatch([sample], repository);

    // First render
    const { unmount } = render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(sample.content)).toBeInTheDocument();
    });

    // Unmount (simulate navigation away)
    unmount();

    // Second render (simulate navigation back)
    render(<CommentInputList repository={repository} />);

    // Data should still be available from fact layer
    await waitFor(() => {
      expect(screen.getByText(sample.content)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(sample.workspaceId))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(sample.accountId))).toBeInTheDocument();
    });
  });

  it('should display target tweet context when available', async () => {
    const sample = getSample(0);
    await ingestMockCommentInputBatch([sample], repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(sample.targetTweetId!))).toBeInTheDocument();
    });
  });

  it('should handle empty state gracefully', async () => {
    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/no comment inputs found/i)).toBeInTheDocument();
      expect(screen.getByText(/use mock input pipeline/i)).toBeInTheDocument();
    });
  });

  it('should display creation timestamp for each input', async () => {
    const sample = getSample(0);
    await ingestMockCommentInputBatch([sample], repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/created:/i)).toBeInTheDocument();
    });
  });
});
