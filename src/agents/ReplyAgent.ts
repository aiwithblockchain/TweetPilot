import type { IAIProvider } from '../ai/IAIProvider.js';
import type { CommentInput } from '../domain/commentInput.js';
import type { Role } from '../domain/role.js';
import type { IRoleRepository } from '../data/repositories/IRoleRepository.js';
import type { IKnowledgeBase, KnowledgeItem } from '../knowledge/IKnowledgeBase.js';

export interface ReplyOptions {
  role?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  [key: string]: unknown;
}

export interface CommentContext {
  content: string;
  targetTweetId?: string;
  targetTweetUrl?: string;
}

export interface HistoryEntry {
  summary: string;
}

export interface GenerationContext {
  comment: CommentContext;
  role: Role | null;
  history: HistoryEntry[];
  knowledge: KnowledgeItem[];
}

export interface ReplyResult {
  reply: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 500;

// Keywords are intentionally conservative in Phase 1.
// They provide a cheap first-pass risk signal before a richer review workflow exists.
const HIGH_RISK_KEYWORDS = [
  '退款',
  '赔偿',
  '法律',
  '投诉',
  'refund',
  'compensation',
  'legal',
  'complaint',
  'delete your account',
];

// Medium-risk keywords flag replies that may need additional human review,
// but do not necessarily imply policy or legal exposure.
const MEDIUM_RISK_KEYWORDS = [
  '抱歉',
  '问题',
  '错误',
  'sorry',
  'issue',
  'error',
  'warning',
];

export class ReplyAgent {
  constructor(
    private aiProvider: IAIProvider,
    private knowledgeBase: IKnowledgeBase,
    private roleRepository: IRoleRepository
  ) {}

  async assembleContext(
    comment: CommentInput,
    options?: ReplyOptions
  ): Promise<GenerationContext> {
    const commentContext: CommentContext = {
      content: comment.content,
      targetTweetId: comment.targetTweetId,
      targetTweetUrl: comment.targetTweetUrl,
    };

    const role = options?.role
      ? await this.roleRepository.findById(options.role)
      : await this.roleRepository.getDefaultRole(comment.accountId);

    if (options?.role && !role) {
      console.warn(
        `ReplyAgent: role ${options.role} was requested for account ${comment.accountId}, but no matching role was found.`
      );
    }

    const [history, knowledge] = await Promise.all([
      this.getMinimalHistory(comment.accountId),
      this.knowledgeBase.search(comment.content, {
        limit: 5,
        type: 'semantic',
      }),
    ]);

    return {
      comment: commentContext,
      role,
      history,
      knowledge,
    };
  }

  buildPrompt(context: GenerationContext): string {
    let prompt = `你需要回复以下评论:\n${context.comment.content}\n\n`;

    if (context.comment.targetTweetId) {
      prompt += `目标推文 ID: ${context.comment.targetTweetId}\n`;
    }

    if (context.comment.targetTweetUrl) {
      prompt += `目标推文链接: ${context.comment.targetTweetUrl}\n`;
    }

    if (context.comment.targetTweetId || context.comment.targetTweetUrl) {
      prompt += '\n';
    }

    if (context.role) {
      prompt += `角色设定:\n${context.role.prompt}\n\n`;
    }

    if (context.knowledge.length > 0) {
      prompt += '参考知识:\n';
      context.knowledge.forEach((item) => {
        prompt += `- ${item.content}\n`;
      });
      prompt += '\n';
    }

    if (context.history.length > 0) {
      prompt += '历史互动:\n';
      context.history.forEach((item) => {
        prompt += `- ${item.summary}\n`;
      });
      prompt += '\n';
    }

    prompt += '请生成一个合适的回复。';
    return prompt;
  }

  async generateReply(
    comment: CommentInput,
    options?: ReplyOptions
  ): Promise<ReplyResult> {
    const context = await this.assembleContext(comment, options);
    const prompt = this.buildPrompt(context);
    const response = await this.aiProvider.generateText(prompt, {
      temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      model: options?.model,
    });

    const riskLevel = this.assessRisk(response.text);
    const confidence = this.calculateConfidence(response.text, riskLevel);

    return {
      reply: response.text,
      riskLevel,
      confidence,
      metadata: {
        modelSource: 'claude',
        knowledgeHits: context.knowledge.length,
        roleUsed: context.role?.id,
        generatedAt: new Date().toISOString(),
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
      },
    };
  }

  async generateMultipleReplies(
    comment: CommentInput,
    count: number = 3,
    options?: ReplyOptions
  ): Promise<ReplyResult[]> {
    if (count <= 0) {
      return [];
    }

    const baseTemperature = options?.temperature ?? DEFAULT_TEMPERATURE;
    const tasks = Array.from({ length: count }, (_, index) =>
      this.generateReply(comment, {
        ...options,
        temperature: Number((baseTemperature + index * 0.1).toFixed(2)),
      })
    );

    return Promise.all(tasks);
  }

  assessRisk(reply: string): 'low' | 'medium' | 'high' {
    const normalizedReply = reply.toLowerCase();

    if (HIGH_RISK_KEYWORDS.some((keyword) => normalizedReply.includes(keyword))) {
      return 'high';
    }

    if (MEDIUM_RISK_KEYWORDS.some((keyword) => normalizedReply.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }

  calculateConfidence(
    reply: string,
    riskLevel: 'low' | 'medium' | 'high'
  ): number {
    const lengthScore = Math.min(reply.length / 280, 1);
    const riskPenalty = {
      low: 0,
      medium: 0.2,
      high: 0.4,
    };

    return Math.round(Math.max(0, lengthScore - riskPenalty[riskLevel]) * 100) / 100;
  }

  private async getMinimalHistory(_accountId: string): Promise<HistoryEntry[]> {
    // Phase 1 does not persist conversational history yet.
    // Keep the method so later slices can add real history without changing the agent contract.
    return [];
  }
}
