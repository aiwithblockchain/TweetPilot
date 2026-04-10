import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReplyAgent } from '../ReplyAgent.js';
import { IAIProvider } from '../../ai/IAIProvider.js';
import { IKnowledgeBase } from '../../knowledge/IKnowledgeBase.js';

describe('ReplyAgent', () => {
  let mockAIProvider: IAIProvider;
  let mockKnowledgeBase: IKnowledgeBase;
  let agent: ReplyAgent;

  beforeEach(() => {
    mockAIProvider = {
      generateText: vi.fn(),
    };

    mockKnowledgeBase = {
      search: vi.fn(),
    };

    agent = new ReplyAgent(mockAIProvider, mockKnowledgeBase);
  });

  describe('generateReply', () => {
    it('should generate reply without options', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'Thank you for your comment!',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result = await agent.generateReply('Great post!');

      expect(result.reply).toBe('Thank you for your comment!');
      expect(result.riskLevel).toBe('low');
      expect(result.confidence).toBe(0.8);
      expect(result.metadata?.knowledgeUsed).toBe(false);
    });

    it('should generate reply with role parameter', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'As a technical expert, I appreciate your feedback.',
        usage: { inputTokens: 15, outputTokens: 10 },
      });

      const result = await agent.generateReply('Great post!', {
        role: 'technical expert',
      });

      expect(result.reply).toContain('technical expert');
      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('You are acting as: technical expert'),
        expect.any(Object)
      );
    });

    it('should pass temperature and maxTokens to AI provider', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'Reply',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      await agent.generateReply('Comment', {
        temperature: 0.5,
        maxTokens: 500,
      });

      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.any(String),
        {
          temperature: 0.5,
          maxTokens: 500,
        }
      );
    });

    it('should assess high risk level', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'We will delete your account.',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result = await agent.generateReply('Comment');

      expect(result.riskLevel).toBe('high');
    });

    it('should assess medium risk level', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'Warning: this action cannot be undone.',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result = await agent.generateReply('Comment');

      expect(result.riskLevel).toBe('medium');
    });

    it('should calculate confidence based on reply length and risk level', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);

      // Test low risk with 280 characters (full score)
      const longReply = 'a'.repeat(280);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: longReply,
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result1 = await agent.generateReply('Comment');
      expect(result1.confidence).toBe(1.0); // 280/280 - 0 = 1.0

      // Test medium risk with 280 characters
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: longReply + ' sorry',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result2 = await agent.generateReply('Comment');
      expect(result2.confidence).toBe(0.8); // 1.0 - 0.2 = 0.8

      // Test high risk with 280 characters
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: longReply + ' refund',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result3 = await agent.generateReply('Comment');
      expect(result3.confidence).toBe(0.6); // 1.0 - 0.4 = 0.6
    });

    it('should calculate confidence for short replies', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);

      // Test 140 characters (half score)
      const shortReply = 'a'.repeat(140);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: shortReply,
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result = await agent.generateReply('Comment');
      expect(result.confidence).toBe(0.5); // 140/280 = 0.5
    });

    it('should support Chinese risk keywords', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);

      // Test Chinese high risk keyword
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: '我们会为您办理退款',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result1 = await agent.generateReply('Comment');
      expect(result1.riskLevel).toBe('high');

      // Test Chinese medium risk keyword
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: '抱歉给您带来不便',
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const result2 = await agent.generateReply('Comment');
      expect(result2.riskLevel).toBe('medium');
    });
  });

  describe('buildPrompt', () => {
    it('should inject knowledge when available', () => {
      const knowledge = [
        {
          id: '1',
          content: 'Our product supports OAuth 2.0',
          source: 'docs',
          relevance: 0.9,
        },
        {
          id: '2',
          content: 'We use JWT tokens',
          source: 'wiki',
          relevance: 0.8,
        },
      ];

      const prompt = agent.buildPrompt('How does auth work?', knowledge);

      expect(prompt).toContain('Relevant knowledge:');
      expect(prompt).toContain('Our product supports OAuth 2.0');
      expect(prompt).toContain('We use JWT tokens');
      expect(prompt).toContain('source: docs');
      expect(prompt).toContain('source: wiki');
    });

    it('should inject role when provided', () => {
      const prompt = agent.buildPrompt(
        'Comment',
        [],
        'customer support agent'
      );

      expect(prompt).toContain('You are acting as: customer support agent');
    });

    it('should not inject knowledge section when empty', () => {
      const prompt = agent.buildPrompt('Comment', []);

      expect(prompt).not.toContain('Relevant knowledge:');
    });

    it('should not inject role section when not provided', () => {
      const prompt = agent.buildPrompt('Comment', []);

      expect(prompt).not.toContain('You are acting as:');
    });

    it('should always include the comment and reply instruction', () => {
      const prompt = agent.buildPrompt('Test comment', []);

      expect(prompt).toContain('Comment: Test comment');
      expect(prompt).toContain(
        'Generate a professional and helpful reply to the following comment'
      );
      expect(prompt).toContain('Reply:');
    });
  });

  describe('integration', () => {
    it('should integrate AI provider and knowledge base correctly', async () => {
      const knowledge = [
        {
          id: '1',
          content: 'Product feature X is available',
          source: 'docs',
          relevance: 0.9,
        },
      ];

      vi.mocked(mockKnowledgeBase.search).mockResolvedValue(knowledge);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'Yes, feature X is available!',
        usage: { inputTokens: 20, outputTokens: 10 },
      });

      const result = await agent.generateReply('Do you have feature X?', {
        role: 'product expert',
        temperature: 0.7,
      });

      // Verify knowledge base was searched
      expect(mockKnowledgeBase.search).toHaveBeenCalledWith(
        'Do you have feature X?',
        { limit: 3 }
      );

      // Verify AI provider was called with correct prompt
      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('You are acting as: product expert'),
        { temperature: 0.7, maxTokens: undefined }
      );

      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.stringContaining('Product feature X is available'),
        expect.any(Object)
      );

      // Verify result
      expect(result.reply).toBe('Yes, feature X is available!');
      expect(result.metadata?.knowledgeUsed).toBe(true);
      expect(result.metadata?.inputTokens).toBe(20);
      expect(result.metadata?.outputTokens).toBe(10);
    });
  });
});
