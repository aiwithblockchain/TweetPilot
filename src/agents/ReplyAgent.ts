/**
 * Reply Agent - 生成回复的核心代理
 * 支持不同角色生成不同风格回复
 */

import { IAIProvider } from '../ai/IAIProvider.js';
import { IKnowledgeBase, KnowledgeItem } from '../knowledge/IKnowledgeBase.js';

export interface ReplyOptions {
  /** 角色设定（可选） */
  role?: string;
  /** 温度参数 */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 扩展参数 */
  [key: string]: unknown;
}

export interface ReplyResult {
  /** 生成的回复内容 */
  reply: string;
  /** 风险等级 (low, medium, high) */
  riskLevel: 'low' | 'medium' | 'high';
  /** 置信度 (0-1) */
  confidence: number;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

export class ReplyAgent {
  constructor(
    private aiProvider: IAIProvider,
    private knowledgeBase: IKnowledgeBase
  ) {}

  /**
   * 生成回复
   * @param comment 评论内容
   * @param options 生成选项
   * @returns 回复结果
   */
  async generateReply(
    comment: string,
    options?: ReplyOptions
  ): Promise<ReplyResult> {
    // 搜索相关知识
    const knowledge = await this.knowledgeBase.search(comment, { limit: 3 });

    // 构建 prompt
    const prompt = this.buildPrompt(comment, knowledge, options?.role);

    // 调用 AI 生成回复
    const response = await this.aiProvider.generateText(prompt, {
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    // 评估风险
    const riskLevel = this.assessRisk(response.text);

    // 计算置信度
    const confidence = this.calculateConfidence(response.text, riskLevel);

    return {
      reply: response.text,
      riskLevel,
      confidence,
      metadata: {
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        knowledgeUsed: knowledge.length > 0,
      },
    };
  }

  /**
   * 构建 prompt
   * 支持角色注入和知识注入
   */
  buildPrompt(
    comment: string,
    knowledge: KnowledgeItem[],
    role?: string
  ): string {
    let prompt = '';

    // 角色注入
    if (role) {
      prompt += `You are acting as: ${role}\n\n`;
    }

    // 知识注入
    if (knowledge.length > 0) {
      prompt += 'Relevant knowledge:\n';
      knowledge.forEach((item, index) => {
        prompt += `${index + 1}. ${item.content} (source: ${item.source})\n`;
      });
      prompt += '\n';
    }

    // 主要任务
    prompt += `Generate a professional and helpful reply to the following comment:\n\n`;
    prompt += `Comment: ${comment}\n\n`;
    prompt += `Reply:`;

    return prompt;
  }

  /**
   * 计算置信度
   * 基于回复长度和风险等级
   */
  private calculateConfidence(
    reply: string,
    riskLevel: 'low' | 'medium' | 'high'
  ): number {
    // 基础置信度: 回复长度(归一化到 0-1)
    const lengthScore = Math.min(reply.length / 280, 1); // 280 字符 = 满分

    // 风险惩罚
    const riskPenalty = {
      low: 0,
      medium: 0.2,
      high: 0.4,
    };

    const confidence = Math.max(0, lengthScore - riskPenalty[riskLevel]);

    return Math.round(confidence * 100) / 100; // 保留 2 位小数
  }

  /**
   * 简单风险评估
   * 支持中英文关键词检测
   */
  private assessRisk(reply: string): 'low' | 'medium' | 'high' {
    const lowerReply = reply.toLowerCase();

    // 高风险关键词(中英文)
    const highRiskKeywords = [
      // 中文
      '退款',
      '赔偿',
      '法律',
      '投诉',
      // 英文
      'refund',
      'compensation',
      'legal',
      'complaint',
    ];

    // 中风险关键词(中英文)
    const mediumRiskKeywords = [
      // 中文
      '抱歉',
      '问题',
      '错误',
      // 英文
      'sorry',
      'issue',
      'error',
    ];

    if (highRiskKeywords.some((keyword) => lowerReply.includes(keyword))) {
      return 'high';
    }

    if (mediumRiskKeywords.some((keyword) => lowerReply.includes(keyword))) {
      return 'medium';
    }

    return 'low';
  }
}
