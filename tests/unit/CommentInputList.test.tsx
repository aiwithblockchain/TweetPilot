import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CommentInputList from '../../src/features/commentInput/CommentInputList';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { createCommentInput } from '../../src/domain/commentInput';

describe('CommentInputList Component', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should render loading state initially', () => {
    render(<CommentInputList repository={repository} />);
    expect(screen.getByText(/loading comment inputs/i)).toBeInTheDocument();
  });

  it('should render empty state when no inputs exist', async () => {
    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/no comment inputs found/i)).toBeInTheDocument();
    });
  });

  it('should render comment inputs from repository', async () => {
    const input1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Test comment 1',
      targetTweetId: 'tweet-001',
    });

    const input2 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Test comment 2',
      targetTweetId: 'tweet-002',
    });

    await repository.save(input1);
    await repository.save(input2);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText('Test comment 1')).toBeInTheDocument();
      expect(screen.getByText('Test comment 2')).toBeInTheDocument();
    });
  });

  it('should display workspace and account attribution', async () => {
    const input = createCommentInput({
      workspaceId: 'ws-test-001',
      accountId: 'acc-test-001',
      content: 'Test comment with attribution',
    });

    await repository.save(input);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/workspace: ws-test-001/i)).toBeInTheDocument();
      expect(screen.getByText(/account: acc-test-001/i)).toBeInTheDocument();
    });
  });

  it('should display target tweet information when available', async () => {
    const input = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Reply to tweet',
      targetTweetId: 'tweet-12345',
    });

    await repository.save(input);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/target tweet: tweet-12345/i)).toBeInTheDocument();
    });
  });

  it('should display source metadata when available', async () => {
    const input = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Mock input',
      metadata: { source: 'mock' },
    });

    await repository.save(input);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/source: mock/i)).toBeInTheDocument();
    });
  });

  it('should filter by workspace when workspaceId prop is provided', async () => {
    const input1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Workspace 1 comment',
    });

    const input2 = createCommentInput({
      workspaceId: 'ws-002',
      accountId: 'acc-002',
      content: 'Workspace 2 comment',
    });

    await repository.save(input1);
    await repository.save(input2);

    render(<CommentInputList repository={repository} workspaceId="ws-001" />);

    await waitFor(() => {
      expect(screen.getByText('Workspace 1 comment')).toBeInTheDocument();
      expect(screen.queryByText('Workspace 2 comment')).not.toBeInTheDocument();
    });
  });

  it('should filter by account when accountId prop is provided', async () => {
    const input1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Account 1 comment',
    });

    const input2 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-002',
      content: 'Account 2 comment',
    });

    await repository.save(input1);
    await repository.save(input2);

    render(<CommentInputList repository={repository} accountId="acc-001" />);

    await waitFor(() => {
      expect(screen.getByText('Account 1 comment')).toBeInTheDocument();
      expect(screen.queryByText('Account 2 comment')).not.toBeInTheDocument();
    });
  });

  it('should display comment count in title', async () => {
    const input1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Comment 1',
    });

    const input2 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Comment 2',
    });

    await repository.save(input1);
    await repository.save(input2);

    render(<CommentInputList repository={repository} />);

    await waitFor(() => {
      expect(screen.getByText(/comment inputs \(2\)/i)).toBeInTheDocument();
    });
  });
});
