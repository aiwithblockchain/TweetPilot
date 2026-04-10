// Comment Input domain object - represents a comment input as a platform fact

export type CommentInputId = string;

export interface CommentInput {
  id: CommentInputId;
  workspaceId: string;
  accountId: string;
  content: string;
  targetTweetId?: string;
  targetTweetUrl?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateCommentInputParams {
  workspaceId: string;
  accountId: string;
  content: string;
  targetTweetId?: string;
  targetTweetUrl?: string;
  metadata?: Record<string, unknown>;
}

// Generate unique ID for comment input based on content and target
export function generateCommentInputId(params: CreateCommentInputParams): CommentInputId {
  const { workspaceId, accountId, content, targetTweetId } = params;
  const normalizedContent = content.trim().toLowerCase();
  const target = targetTweetId || 'no-target';
  return `ci-${workspaceId}-${accountId}-${target}-${hashString(normalizedContent)}`;
}

// Simple hash function for content uniqueness
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// Create a new comment input with generated ID
export function createCommentInput(params: CreateCommentInputParams): CommentInput {
  const id = generateCommentInputId(params);
  return {
    id,
    workspaceId: params.workspaceId,
    accountId: params.accountId,
    content: params.content,
    targetTweetId: params.targetTweetId,
    targetTweetUrl: params.targetTweetUrl,
    createdAt: new Date(),
    metadata: params.metadata,
  };
}
