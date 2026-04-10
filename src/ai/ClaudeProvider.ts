/**
 * Claude AI Provider 实现
 * 使用 Anthropic SDK 调用 Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider, AIOptions, AIResponse } from './IAIProvider.js';
import { AIProviderError, AIErrorCode } from './errors.js';

export interface ClaudeConfig {
  /** API Key */
  apiKey: string;
  /** 默认模型 */
  defaultModel?: string;
  /** 请求超时时间（毫秒） */
  timeout?: number;
}

export class ClaudeProvider implements IAIProvider {
  private client: Anthropic;
  private defaultModel: string;
  private timeout: number;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout,
    });
    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
    this.timeout = config.timeout || 60000;
  }

  async generateText(
    prompt: string,
    options?: AIOptions
  ): Promise<AIResponse> {
    try {
      const response = await this.client.messages.create({
        model: options?.model || this.defaultModel,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature,
        stop_sequences: options?.stopSequences,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // 提取文本内容
      const textContent = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('');

      return {
        text: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (error) {
      throw AIProviderError.fromError(error);
    }
  }

  async *generateTextStream(
    prompt: string,
    options?: AIOptions
  ): AsyncIterableIterator<string> {
    try {
      const stream = await this.client.messages.create({
        model: options?.model || this.defaultModel,
        max_tokens: options?.maxTokens || 1024,
        temperature: options?.temperature,
        stop_sequences: options?.stopSequences,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (error) {
      throw AIProviderError.fromError(error);
    }
  }
}
