import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CommentInputList from '../../src/features/commentInput/CommentInputList';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { ingestMockCommentInputBatch } from '../../src/mocks/mockInputPipeline';
import { getSample } from '../../src/mocks/commentInputSamples';

describe('CommentInputList - Integration with Repository', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should read and display comment inputs from repository fact layer', async () => {
    // Ingest mock inputs through the pipeline
    const samples = [getSample(0), getSample(1)];
    await ingestMockCommentInputBatch(samples, repository);

    // Render the UI component
    render(<CommentInputList repository={repository} />);

    // Verify UI reads from fact layer
    await waitFor(() => {
      expect(screen.getByText(samples[0].content)).toBeInTheDocument();
      expect(screen.getByText(samples[1].content)).toBeInTheDocument();
    });
  });

  it('should display workspace and account attribution from fact layer', async () => {
    const sample = getSample(0);
    await ingestMockCommentInputBatch([sample], repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(sample.workspaceId))).toBeInTheDocument();
      expect(screen.getByText(new RegExp(sample.accountId))).toBeInTheDocument();
    });
  });

  it('should display source tracking information from metadata', async () => {
    const sample = getSample(0); // Has metadata.source = 'mock'
    await ingestMockCommentInputBatch([sample], repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/source: mock/i)).toBeInTheDocument();
    });
  });

  it('should support filtering by workspace through repository query', async () => {
    const ws001Samples = [getSample(0), getSample(1)]; // Both ws-test-001
    const ws002Sample = getSample(3); // ws-test-002

    await ingestMockCommentInputBatch([...ws001Samples, ws002Sample], repository);

    render(<CommentInputList repository={repository} workspaceId="ws-test-001" />);

    await waitFor(() => {
      expect(screen.getByText(ws001Samples[0].content)).toBeInTheDocument();
      expect(screen.getByText(ws001Samples[1].content)).toBeInTheDocument();
      expect(screen.queryByText(ws002Sample.content)).not.toBeInTheDocument();
    });
  });

  it('should support filtering by account through repository query', async () => {
    const acc001Samples = [getSample(0), getSample(1)]; // Both acc-test-001
    const acc002Sample = getSample(2); // acc-test-002

    await ingestMockCommentInputBatch([...acc001Samples, acc002Sample], repository);

    render(<CommentInputList repository={repository} accountId="acc-test-001" />);

    await waitFor(() => {
      expect(screen.getByText(acc001Samples[0].content)).toBeInTheDocument();
      expect(screen.getByText(acc001Samples[1].content)).toBeInTheDocument();
      expect(screen.queryByText(acc002Sample.content)).not.toBeInTheDocument();
    });
  });

  it('should display all inputs when no filter is applied', async () => {
    const samples = [getSample(0), getSample(1), getSample(2), getSample(3)];
    await ingestMockCommentInputBatch(samples, repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      samples.forEach((sample) => {
        expect(screen.getByText(sample.content)).toBeInTheDocument();
      });
    });
  });

  it('should persist and display inputs as platform facts, not UI state', async () => {
    const sample = getSample(0);
    await ingestMockCommentInputBatch([sample], repository);

    // First render
    const { unmount } = render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(sample.content)).toBeInTheDocument();
    });

    // Unmount (simulate UI state loss)
    unmount();

    // Second render - data should still be available from fact layer
    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(sample.content)).toBeInTheDocument();
    });
  });

  it('should display target tweet context when available', async () => {
    const sample = getSample(0); // Has targetTweetId
    await ingestMockCommentInputBatch([sample], repository);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(new RegExp(sample.targetTweetId!))).toBeInTheDocument();
    });
  });

  it('should handle empty repository gracefully', async () => {
    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/no comment inputs found/i)).toBeInTheDocument();
    });
  });
});
