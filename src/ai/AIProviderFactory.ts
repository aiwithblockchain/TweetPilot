/**
 * AI Provider 工厂类
 * 根据类型创建不同的 AI Provider 实例
 */

import { IAIProvider } from './IAIProvider.js';
import { ClaudeProvider, ClaudeConfig } from './ClaudeProvider.js';

export type ProviderType = 'claude' | 'openai' | 'local';

export type ProviderConfig = ClaudeConfig; // 第二阶段可扩展为联合类型

export class AIProviderFactory {
  /**
   * 创建 AI Provider 实例
   * @param type Provider 类型
   * @param config Provider 配置
   * @returns AI Provider 实例
   */
  static create(type: ProviderType, config: ProviderConfig): IAIProvider {
    switch (type) {
      case 'claude':
        return new ClaudeProvider(config as ClaudeConfig);
      case 'openai':
        throw new Error('OpenAI provider not implemented yet');
      case 'local':
        throw new Error('Local provider not implemented yet');
      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }
}
