/**
 * AI Provider 接口
 * 定义统一的 AI 服务调用接口，支持多种 AI 模型提供商
 */

export interface AIOptions {
	/** 模型名称 */
	model?: string;
	/** 温度参数，控制输出随机性 (0-1) */
	temperature?: number;
	/** 最大生成 token 数 */
	maxTokens?: number;
	/** 停止序列 */
	stopSequences?: string[];
}

export interface AIResponse {
	/** 生成的文本内容 */
	text: string;
	/** 使用的 token 数量 */
	usage?: {
		inputTokens: number;
		outputTokens: number;
	};
}

export interface IAIProvider {
	/**
	 * 生成文本
	 * @param prompt 输入提示词
	 * @param options 生成选项
	 * @returns 生成的文本响应
	 */
	generateText(prompt: string, options?: AIOptions): Promise<AIResponse>;

	/**
	 * 流式生成文本（预留接口）
	 * @param prompt 输入提示词
	 * @param options 生成选项
	 * @returns 异步迭代器，逐步返回生成的文本片段
	 */
	generateTextStream?(
		prompt: string,
		options?: AIOptions,
	): AsyncIterableIterator<string>;
}
