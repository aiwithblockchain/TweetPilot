import type { IAIProvider, AIOptions, AIResponse } from '../ai/IAIProvider.js';
import { ClaudeProvider } from '../ai/ClaudeProvider.js';
import { ReplyAgent } from '../agents/ReplyAgent.js';
import { candidateReplyRepository } from '../data/candidateReplyRepositoryInstance.js';
import { roleRepository } from '../data/roleRepositoryInstance.js';
import { EmptyKnowledgeBase } from '../knowledge/EmptyKnowledgeBase.js';

function createFallbackAIProvider(): IAIProvider {
  return {
    async generateText(prompt: string, options?: AIOptions): Promise<AIResponse> {
      const commentMatch = prompt.match(/你需要回复以下评论:\n(.+?)(?:\n\n|$)/s);
      const comment = commentMatch?.[1]?.trim() ?? '这条评论';
      const rolePromptMatch = prompt.match(/角色设定:\n(.+?)(?:\n\n|$)/s);
      const rolePrompt = rolePromptMatch?.[1] ?? '';
      const knowledgeLines =
        prompt.match(/参考知识:\n([\s\S]+?)(?:\n\n|历史互动:|请生成一个合适的回复。)/)?.[1]
          ?.split('\n')
          .filter((line) => line.startsWith('- '))
          .map((line) => line.replace(/^- /, '').trim()) ?? [];

      let prefix = '候选回复';
      if (rolePrompt.includes('专业客服')) {
        prefix = '专业客服建议';
      } else if (rolePrompt.includes('友好助手')) {
        prefix = '友好助手回复';
      } else if (rolePrompt.includes('增长运营')) {
        prefix = '增长运营建议';
      }

      const variant =
        typeof options?.temperature === 'number' && options.temperature >= 0.85
          ? '扩展版'
          : typeof options?.temperature === 'number' && options.temperature >= 0.75
            ? '平衡版'
            : '稳健版';
      const knowledgeHint =
        knowledgeLines.length > 0
          ? ` 参考信息：${knowledgeLines[0]}。`
          : '';

      const text = `${prefix}${variant}：针对“${comment}”，建议先确认用户诉求，再给出清晰下一步。${knowledgeHint}`;

      return {
        text,
        usage: {
          inputTokens: Math.max(12, Math.round(prompt.length / 4)),
          outputTokens: Math.max(8, Math.round(text.length / 4)),
        },
      };
    },
  };
}

function createAIProvider(): IAIProvider {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY?.trim();

  if (apiKey) {
    return new ClaudeProvider({
      apiKey,
      defaultModel: 'claude-3-5-sonnet-20241022',
    });
  }

  return createFallbackAIProvider();
}

export const aiProvider = createAIProvider();
export const knowledgeBase = new EmptyKnowledgeBase();
export const replyAgent = new ReplyAgent(aiProvider, knowledgeBase, roleRepository);

export { candidateReplyRepository, roleRepository };
