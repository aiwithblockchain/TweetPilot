// Comment Input domain object - represents a comment input as a platform fact

export type CommentInputId = string;

export interface CommentInput {
  id: CommentInputId;
  organizationId?: string;  // Reserved for multi-tenant support (Phase 2)
  workspaceId: string;
  accountId: string;
  content: string;
  targetTweetId?: string;
  targetTweetUrl?: string;
  createdAt: Date;
  createdBy?: string;  // Reserved for permission system (Phase 2)
  metadata?: Record<string, unknown>;
}

export interface CreateCommentInputParams {
  organizationId?: string;  // Reserved for multi-tenant support (Phase 2)
  workspaceId: string;
  accountId: string;
  content: string;
  targetTweetId?: string;
  targetTweetUrl?: string;
  createdBy?: string;  // Reserved for permission system (Phase 2)
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
    organizationId: params.organizationId,
    workspaceId: params.workspaceId,
    accountId: params.accountId,
    content: params.content,
    targetTweetId: params.targetTweetId,
    targetTweetUrl: params.targetTweetUrl,
    createdAt: new Date(),
    createdBy: params.createdBy,
    metadata: params.metadata,
  };
}
