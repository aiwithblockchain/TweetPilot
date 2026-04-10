import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIProviderError, AIErrorCode } from '../../src/ai/errors.js';
import { createCommentInput } from '../../src/domain/commentInput.js';
import { InMemoryCandidateReplyRepository } from '../../src/data/repositories/InMemoryCandidateReplyRepository.js';
import { useReplyGeneration } from '../../src/features/reply-generation/useReplyGeneration';
import { candidateReplyRepository } from '../../src/services';

const testComment = createCommentInput({
  workspaceId: 'ws-001',
  accountId: 'acc-001',
  content: 'Could you explain this feature?',
  targetTweetId: 'tweet-hook-001',
});

function HookHarness(props: {
  dependencies?: Parameters<typeof useReplyGeneration>[0];
  roleId?: string;
  roleName?: string;
  count?: number;
}) {
  const { generateReplies, isGenerating, replies, error, trace } = useReplyGeneration(
    props.dependencies
  );

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          void generateReplies(
            testComment,
            props.roleId,
            props.count ?? 2,
            props.roleName
          )
        }
      >
        Run Generation
      </button>
      <div data-testid="loading">{String(isGenerating)}</div>
      <div data-testid="count">{replies.length}</div>
      <div data-testid="error">{error ?? ''}</div>
      <div data-testid="trace-role">{trace?.roleName ?? ''}</div>
      <div data-testid="first-reply">{replies[0]?.content ?? ''}</div>
    </div>
  );
}

describe('useReplyGeneration Integration', () => {
  beforeEach(() => {
    candidateReplyRepository.clear();
  });

  it('should generate replies successfully through the hook', async () => {
    const repository = new InMemoryCandidateReplyRepository();
    const saveSpy = vi.spyOn(repository, 'save');
    const replyAgent = {
      generateMultipleReplies: vi.fn().mockResolvedValue([
        {
          reply: 'Reply A',
          riskLevel: 'low',
          confidence: 0.8,
          metadata: { modelSource: 'mock', knowledgeHits: 1 },
        },
        {
          reply: 'Reply B',
          riskLevel: 'medium',
          confidence: 0.6,
          metadata: { modelSource: 'mock', knowledgeHits: 2 },
        },
      ]),
    };

    const user = userEvent.setup();
    render(
      <HookHarness
        dependencies={{
          replyAgent,
          candidateReplyRepository: repository,
        }}
        roleId="role-001"
        roleName="专业客服"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(() => {
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });

    expect(saveSpy).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('trace-role')).toHaveTextContent('专业客服');
  });

  it('should surface AI auth errors from the hook', async () => {
    const replyAgent = {
      generateMultipleReplies: vi
        .fn()
        .mockRejectedValue(
          new AIProviderError(AIErrorCode.AUTH_ERROR, 'Unauthorized')
        ),
    };

    const user = userEvent.setup();
    render(<HookHarness dependencies={{ replyAgent }} />);

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Unauthorized');
    });
  });

  it('should surface AI rate limit errors from the hook', async () => {
    const replyAgent = {
      generateMultipleReplies: vi
        .fn()
        .mockRejectedValue(
          new AIProviderError(AIErrorCode.RATE_LIMIT, 'Rate limited')
        ),
    };

    const user = userEvent.setup();
    render(<HookHarness dependencies={{ replyAgent }} />);

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Rate limited');
    });
  });

  it('should surface repository save errors from the hook', async () => {
    const repository = {
      save: vi.fn().mockRejectedValue(new Error('Repository write failed')),
    };
    const replyAgent = {
      generateMultipleReplies: vi.fn().mockResolvedValue([
        {
          reply: 'Reply A',
          riskLevel: 'low',
          confidence: 0.8,
          metadata: { modelSource: 'mock', knowledgeHits: 1 },
        },
      ]),
    };

    const user = userEvent.setup();
    render(
      <HookHarness
        dependencies={{
          replyAgent,
          candidateReplyRepository: repository,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Repository write failed');
    });
  });

  it('should save generated replies into repository', async () => {
    const repository = new InMemoryCandidateReplyRepository();
    const replyAgent = {
      generateMultipleReplies: vi.fn().mockResolvedValue([
        {
          reply: 'Reply A',
          riskLevel: 'low',
          confidence: 0.8,
          metadata: { modelSource: 'mock', knowledgeHits: 1 },
        },
        {
          reply: 'Reply B',
          riskLevel: 'low',
          confidence: 0.7,
          metadata: { modelSource: 'mock', knowledgeHits: 0 },
        },
      ]),
    };

    const user = userEvent.setup();
    render(
      <HookHarness
        dependencies={{
          replyAgent,
          candidateReplyRepository: repository,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(async () => {
      expect(await repository.countByCommentInput(testComment.id)).toBe(2);
    });
  });

  it('should work with global singleton dependencies by default', async () => {
    const user = userEvent.setup();
    render(<HookHarness count={2} />);

    await user.click(screen.getByRole('button', { name: 'Run Generation' }));

    await waitFor(async () => {
      expect(await candidateReplyRepository.countByCommentInput(testComment.id)).toBe(2);
    });

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });
});
