import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIProviderError, AIErrorCode } from '../../src/ai/errors.js';
import type { IAIProvider } from '../../src/ai/IAIProvider.js';
import { ReplyAgent } from '../../src/agents/ReplyAgent.js';
import { createCommentInput } from '../../src/domain/commentInput.js';
import { createRole, type Role } from '../../src/domain/role.js';
import type { IRoleRepository } from '../../src/data/repositories/IRoleRepository.js';
import type { IKnowledgeBase } from '../../src/knowledge/IKnowledgeBase.js';

describe('ReplyAgent', () => {
  let mockAIProvider: IAIProvider;
  let mockKnowledgeBase: IKnowledgeBase;
  let mockRoleRepository: IRoleRepository;
  let agent: ReplyAgent;
  let defaultRole: Role;
  let alternateRole: Role;

  beforeEach(() => {
    defaultRole = createRole({
      name: '专业客服',
      description: '标准客服场景',
      prompt: '请以专业客服的方式回复，先澄清问题再给出动作。',
      workspaceId: 'ws-001',
    });
    alternateRole = createRole({
      name: '友好助手',
      description: '社区互动场景',
      prompt: '请以友好助手的方式回复，语气更亲切自然。',
      workspaceId: 'ws-001',
    });

    mockAIProvider = {
      generateText: vi.fn(),
    };

    mockKnowledgeBase = {
      search: vi.fn(),
    };

    mockRoleRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findByWorkspace: vi.fn(),
      delete: vi.fn(),
      bindRole: vi.fn(),
      unbindRole: vi.fn(),
      getAccountRoles: vi.fn(),
      getDefaultRole: vi.fn(),
    };

    vi.mocked(mockKnowledgeBase.search).mockResolvedValue([]);
    vi.mocked(mockRoleRepository.findById).mockResolvedValue(null);
    vi.mocked(mockRoleRepository.getDefaultRole).mockResolvedValue(defaultRole);

    agent = new ReplyAgent(mockAIProvider, mockKnowledgeBase, mockRoleRepository);
  });

  const createTestComment = () =>
    createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: '请问这个功能怎么使用？',
      targetTweetId: 'tweet-123',
      targetTweetUrl: 'https://x.com/demo/status/123',
    });

  describe('assembleContext', () => {
    it('should assemble comment, default role, history, and knowledge', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
        {
          id: 'k-1',
          content: '产品支持 OAuth 登录。',
          source: 'docs',
          relevance: 0.9,
        },
      ]);

      const context = await agent.assembleContext(createTestComment());

      expect(context.comment.content).toBe('请问这个功能怎么使用？');
      expect(context.comment.targetTweetId).toBe('tweet-123');
      expect(context.role?.id).toBe(defaultRole.id);
      expect(context.history).toEqual([]);
      expect(context.knowledge).toHaveLength(1);
      expect(mockRoleRepository.getDefaultRole).toHaveBeenCalledWith('acc-001');
      expect(mockKnowledgeBase.search).toHaveBeenCalledWith('请问这个功能怎么使用？', {
        limit: 5,
        type: 'semantic',
      });
    });

    it('should use explicit role when role id is provided', async () => {
      vi.mocked(mockRoleRepository.findById).mockResolvedValue(alternateRole);

      const context = await agent.assembleContext(createTestComment(), {
        role: alternateRole.id,
      });

      expect(context.role?.id).toBe(alternateRole.id);
      expect(mockRoleRepository.findById).toHaveBeenCalledWith(alternateRole.id);
      expect(mockRoleRepository.getDefaultRole).not.toHaveBeenCalled();
    });
  });

  describe('buildPrompt', () => {
    it('should build prompt without role and knowledge', () => {
      const prompt = agent.buildPrompt({
        comment: {
          content: '测试评论',
        },
        role: null,
        history: [],
        knowledge: [],
      });

      expect(prompt).toContain('你需要回复以下评论:\n测试评论');
      expect(prompt).not.toContain('角色设定:');
      expect(prompt).not.toContain('参考知识:');
      expect(prompt).not.toContain('历史互动:');
      expect(prompt).toContain('请生成一个合适的回复。');
    });

    it('should inject role prompt when role exists', () => {
      const prompt = agent.buildPrompt({
        comment: {
          content: '测试评论',
        },
        role: defaultRole,
        history: [],
        knowledge: [],
      });

      expect(prompt).toContain('角色设定:');
      expect(prompt).toContain(defaultRole.prompt);
    });

    it('should inject knowledge items when knowledge exists', () => {
      const prompt = agent.buildPrompt({
        comment: {
          content: '测试评论',
        },
        role: null,
        history: [],
        knowledge: [
          {
            id: 'k-1',
            content: '这是第一条知识。',
            source: 'docs',
            relevance: 0.9,
          },
        ],
      });

      expect(prompt).toContain('参考知识:');
      expect(prompt).toContain('这是第一条知识。');
    });
  });

  describe('risk and confidence', () => {
    it('should classify high risk replies', () => {
      expect(agent.assessRisk('我们会为你办理退款')).toBe('high');
    });

    it('should classify medium risk replies', () => {
      expect(agent.assessRisk('抱歉，这里有一个问题需要确认')).toBe('medium');
    });

    it('should classify low risk replies', () => {
      expect(agent.assessRisk('感谢你的反馈，我们会尽快跟进。')).toBe('low');
    });

    it('should return high confidence for long low-risk replies', () => {
      expect(agent.calculateConfidence('a'.repeat(280), 'low')).toBe(1);
    });

    it('should return low confidence for short high-risk replies', () => {
      expect(agent.calculateConfidence('refund', 'high')).toBe(0);
    });

    it('should handle confidence edge cases', () => {
      expect(agent.calculateConfidence('', 'low')).toBe(0);
      expect(agent.calculateConfidence('a'.repeat(1000), 'medium')).toBe(0.8);
    });
  });

  describe('generateReply', () => {
    it('should generate a reply with metadata and default options', async () => {
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: '您好，我们建议先检查设置页面中的开关。',
        usage: { inputTokens: 30, outputTokens: 18 },
      });

      const result = await agent.generateReply(createTestComment());

      expect(result.reply).toBe('您好，我们建议先检查设置页面中的开关。');
      expect(result.riskLevel).toBe('low');
      expect(result.metadata).toMatchObject({
        modelSource: 'claude',
        knowledgeHits: 0,
        roleUsed: defaultRole.id,
        inputTokens: 30,
        outputTokens: 18,
      });
      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.any(String),
        {
          temperature: 0.7,
          maxTokens: 500,
          model: undefined,
        }
      );
    });

    it('should pass explicit generation options to AI provider', async () => {
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: 'reply',
      });

      await agent.generateReply(createTestComment(), {
        role: alternateRole.id,
        temperature: 0.5,
        maxTokens: 320,
        model: 'claude-3-5-sonnet',
      });

      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.any(String),
        {
          temperature: 0.5,
          maxTokens: 320,
          model: 'claude-3-5-sonnet',
        }
      );
    });
  });

  describe('integration', () => {
    it('should generate a single reply end-to-end', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
        {
          id: 'k-1',
          content: '该功能位于设置页的通知模块。',
          source: 'docs',
          relevance: 0.8,
        },
      ]);
      vi.mocked(mockAIProvider.generateText).mockResolvedValue({
        text: '你可以在设置页的通知模块开启该功能。',
        usage: { inputTokens: 40, outputTokens: 20 },
      });

      const result = await agent.generateReply(createTestComment());

      expect(result.reply).toContain('设置页');
      expect(result.metadata?.knowledgeHits).toBe(1);
    });

    it('should generate multiple replies in parallel with stepped temperatures', async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      vi.mocked(mockAIProvider.generateText).mockImplementation(async (_prompt, options) => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 30));
        inFlight -= 1;

        return {
          text: `reply-${String(options?.temperature)}`,
        };
      });

      const results = await agent.generateMultipleReplies(createTestComment(), 3);

      expect(results).toHaveLength(3);
      expect(results.map((item) => item.reply)).toEqual([
        'reply-0.7',
        'reply-0.8',
        'reply-0.9',
      ]);
      expect(maxInFlight).toBeGreaterThan(1);
    });

    it('should reflect role switching in generated output', async () => {
      vi.mocked(mockRoleRepository.findById).mockImplementation(async (id) => {
        if (id === alternateRole.id) {
          return alternateRole;
        }
        return defaultRole;
      });
      vi.mocked(mockAIProvider.generateText).mockImplementation(async (prompt) => ({
        text: prompt.includes(alternateRole.prompt)
          ? '友好版回复'
          : '专业版回复',
      }));

      const professional = await agent.generateReply(createTestComment());
      const friendly = await agent.generateReply(createTestComment(), {
        role: alternateRole.id,
      });

      expect(professional.reply).toBe('专业版回复');
      expect(friendly.reply).toBe('友好版回复');
    });

    it('should reflect knowledge injection in generated output', async () => {
      vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
        {
          id: 'k-1',
          content: '本周活动提供七折优惠。',
          source: 'campaign',
          relevance: 0.95,
        },
      ]);
      vi.mocked(mockAIProvider.generateText).mockImplementation(async (prompt) => ({
        text: prompt.includes('七折优惠') ? '活动信息已加入回复' : '未命中知识',
      }));

      const result = await agent.generateReply(createTestComment());
      expect(result.reply).toBe('活动信息已加入回复');
    });

    it('should propagate AI provider errors', async () => {
      const errors = [
        AIProviderError.fromStatusCode(401, 'Unauthorized'),
        AIProviderError.fromStatusCode(429, 'Rate limited'),
        AIProviderError.fromStatusCode(503, 'Service unavailable'),
        new AIProviderError(AIErrorCode.TIMEOUT, 'Request timeout'),
      ];

      for (const error of errors) {
        vi.mocked(mockAIProvider.generateText).mockRejectedValueOnce(error);
        await expect(agent.generateReply(createTestComment())).rejects.toBe(error);
      }
    });
  });
});
