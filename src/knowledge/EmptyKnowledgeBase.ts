/**
 * 空知识库实现
 * 第一阶段返回空数组，第二阶段可替换为真实 MCP 知识库实现
 */

import { IKnowledgeBase, KnowledgeItem, SearchOptions } from './IKnowledgeBase.js';

export class EmptyKnowledgeBase implements IKnowledgeBase {
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<KnowledgeItem[]> {
    // 第一阶段返回空数组
    return [];
  }
}
