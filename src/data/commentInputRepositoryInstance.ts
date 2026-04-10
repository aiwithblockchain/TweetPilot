// Global repository instance for comment inputs
// This provides a singleton instance that can be used across the application

import { InMemoryCommentInputRepository } from './commentInputRepository';

// Create a singleton instance
export const commentInputRepository = new InMemoryCommentInputRepository();
