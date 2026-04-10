// Fact layer repository interface for CommentInput

import type { CommentInput, CommentInputId } from '../domain/commentInput';

export interface ICommentInputRepository {
  // Write a comment input to the fact layer
  save(commentInput: CommentInput): Promise<void>;

  // Find a comment input by ID
  findById(id: CommentInputId): Promise<CommentInput | null>;

  // Find all comment inputs for a specific account
  findByAccountId(accountId: string): Promise<CommentInput[]>;

  // Find all comment inputs for a specific workspace
  findByWorkspaceId(workspaceId: string): Promise<CommentInput[]>;

  // Find all comment inputs
  findAll(): Promise<CommentInput[]>;

  // Check if a comment input exists
  exists(id: CommentInputId): Promise<boolean>;
}

// In-memory implementation for development and testing
export class InMemoryCommentInputRepository implements ICommentInputRepository {
  private store: Map<CommentInputId, CommentInput> = new Map();

  async save(commentInput: CommentInput): Promise<void> {
    this.store.set(commentInput.id, commentInput);
  }

  async findById(id: CommentInputId): Promise<CommentInput | null> {
    return this.store.get(id) || null;
  }

  async findByAccountId(accountId: string): Promise<CommentInput[]> {
    return Array.from(this.store.values()).filter(
      (ci) => ci.accountId === accountId
    );
  }

  async findByWorkspaceId(workspaceId: string): Promise<CommentInput[]> {
    return Array.from(this.store.values()).filter(
      (ci) => ci.workspaceId === workspaceId
    );
  }

  async findAll(): Promise<CommentInput[]> {
    return Array.from(this.store.values());
  }

  async exists(id: CommentInputId): Promise<boolean> {
    return this.store.has(id);
  }

  // Test helper: clear all data
  clear(): void {
    this.store.clear();
  }
}
