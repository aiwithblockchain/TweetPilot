import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIProviderError, AIErrorCode } from '../../src/ai/errors.js';
import type { IAIProvider } from '../../src/ai/IAIProvider.js';
import { ReplyAgent } from '../../src/agents/ReplyAgent.js';
import { createCommentInput } from '../../src/domain/commentInput.js';
import { createRole, type Role } from '../../src/domain/role.js';
import type { IRoleRepository } from '../../src/data/repositories/IRoleRepository.js';
import type { IKnowledgeBase } from '../../src/knowledge/IKnowledgeBase.js';

describe('ReplyAgent Integration', () => {
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
    vi.mocked(mockRoleRepository.getDefaultRole).mockResolvedValue(defaultRole);
    vi.mocked(mockRoleRepository.findById).mockImplementation(async (id) => {
      if (id === alternateRole.id) {
        return alternateRole;
      }

      return defaultRole;
    });

    agent = new ReplyAgent(mockAIProvider, mockKnowledgeBase, mockRoleRepository);
  });

  const comment = createCommentInput({
    workspaceId: 'ws-001',
    accountId: 'acc-001',
    content: '这个功能支持什么配置？',
    targetTweetId: 'tweet-001',
  });

  it('should generate a single reply end-to-end', async () => {
    vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
      {
        id: 'k-1',
        content: '该功能支持在设置页中配置。',
        source: 'docs',
        relevance: 0.9,
      },
    ]);
    vi.mocked(mockAIProvider.generateText).mockResolvedValue({
      text: '你可以在设置页中完成配置。',
      usage: { inputTokens: 32, outputTokens: 12 },
    });

    const result = await agent.generateReply(comment);

    expect(result.reply).toBe('你可以在设置页中完成配置。');
    expect(result.metadata).toMatchObject({
      knowledgeHits: 1,
      roleUsed: defaultRole.id,
    });
  });

  it('should generate multiple replies in parallel', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    vi.mocked(mockAIProvider.generateText).mockImplementation(async (_prompt, options) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 30));
      inFlight -= 1;

      return { text: `reply-${String(options?.temperature)}` };
    });

    const results = await agent.generateMultipleReplies(comment, 3);

    expect(results.map((item) => item.reply)).toEqual([
      'reply-0.7',
      'reply-0.8',
      'reply-0.9',
    ]);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it('should change output when role changes', async () => {
    vi.mocked(mockAIProvider.generateText).mockImplementation(async (prompt) => ({
      text: prompt.includes(alternateRole.prompt) ? '友好版回复' : '专业版回复',
    }));

    const defaultResult = await agent.generateReply(comment);
    const alternateResult = await agent.generateReply(comment, {
      role: alternateRole.id,
    });

    expect(defaultResult.reply).toBe('专业版回复');
    expect(alternateResult.reply).toBe('友好版回复');
  });

  it('should change output when knowledge is injected', async () => {
    vi.mocked(mockKnowledgeBase.search).mockResolvedValue([
      {
        id: 'k-1',
        content: '本周有新品试用活动。',
        source: 'campaign',
        relevance: 0.95,
      },
    ]);
    vi.mocked(mockAIProvider.generateText).mockImplementation(async (prompt) => ({
      text: prompt.includes('新品试用活动') ? '活动知识已生效' : '没有注入知识',
    }));

    const result = await agent.generateReply(comment);

    expect(result.reply).toBe('活动知识已生效');
  });

  it('should propagate AI provider errors for common failure modes', async () => {
    const errors = [
      AIProviderError.fromStatusCode(401, 'Unauthorized'),
      AIProviderError.fromStatusCode(429, 'Rate limited'),
      AIProviderError.fromStatusCode(503, 'Service unavailable'),
      new AIProviderError(AIErrorCode.TIMEOUT, 'Request timeout'),
    ];

    for (const error of errors) {
      vi.mocked(mockAIProvider.generateText).mockRejectedValueOnce(error);
      await expect(agent.generateReply(comment)).rejects.toBe(error);
    }
  });
});
