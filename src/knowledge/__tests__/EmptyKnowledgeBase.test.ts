import { describe, it, expect } from 'vitest';
import { EmptyKnowledgeBase } from '../EmptyKnowledgeBase.js';

describe('EmptyKnowledgeBase', () => {
  it('should return empty array', async () => {
    const kb = new EmptyKnowledgeBase();
    const result = await kb.search('test query');

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should return empty array with options', async () => {
    const kb = new EmptyKnowledgeBase();
    const result = await kb.search('test query', {
      limit: 5,
      type: 'document',
      filters: { category: 'tech' },
    });

    expect(result).toEqual([]);
  });
});
