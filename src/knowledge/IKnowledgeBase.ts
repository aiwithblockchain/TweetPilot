/**
 * 知识库接口
 * 定义统一的知识检索接口，支持多种知识源
 */

export interface KnowledgeItem {
  /** 知识项唯一标识 */
  id: string;
  /** 知识内容 */
  content: string;
  /** 知识来源 */
  source: string;
  /** 相关性得分 (0-1) */
  relevance: number;
  /** 扩展元数据 */
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  /** 返回结果数量限制 */
  limit?: number;
  /** 知识类型过滤 */
  type?: string;
  /** 自定义过滤条件 */
  filters?: Record<string, unknown>;
}

export interface IKnowledgeBase {
  /**
   * 搜索知识库
   * @param query 搜索查询
   * @param options 搜索选项
   * @returns 知识项列表
   */
  search(query: string, options?: SearchOptions): Promise<KnowledgeItem[]>;
}
