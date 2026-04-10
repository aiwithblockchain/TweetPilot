/**
 * AI Provider 错误类型定义
 */

export enum AIErrorCode {
  /** 认证失败 (401) */
  AUTH_ERROR = 'AUTH_ERROR',
  /** 速率限制 (429) */
  RATE_LIMIT = 'RATE_LIMIT',
  /** 服务不可用 (503) */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  /** 请求超时 */
  TIMEOUT = 'TIMEOUT',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN',
}

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly originalError?: unknown;
  public readonly statusCode?: number;

  constructor(
    code: AIErrorCode,
    message: string,
    originalError?: unknown,
    statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.originalError = originalError;
    this.statusCode = statusCode;

    // 保持正确的原型链
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }

  /**
   * 从 HTTP 状态码创建错误
   */
  static fromStatusCode(
    statusCode: number,
    message: string,
    originalError?: unknown
  ): AIProviderError {
    let code: AIErrorCode;

    switch (statusCode) {
      case 401:
      case 403:
        code = AIErrorCode.AUTH_ERROR;
        break;
      case 429:
        code = AIErrorCode.RATE_LIMIT;
        break;
      case 503:
      case 502:
      case 504:
        code = AIErrorCode.SERVICE_UNAVAILABLE;
        break;
      default:
        code = AIErrorCode.UNKNOWN;
    }

    return new AIProviderError(code, message, originalError, statusCode);
  }

  /**
   * 从通用错误创建 AIProviderError
   */
  static fromError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    if (error && typeof error === 'object' && 'status' in error) {
      const statusCode = (error as { status: number }).status;
      const message =
        'message' in error && typeof error.message === 'string'
          ? error.message
          : 'AI Provider request failed';
      return AIProviderError.fromStatusCode(statusCode, message, error);
    }

    if (error instanceof Error) {
      // 检查是否是超时错误
      if (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT')
      ) {
        return new AIProviderError(
          AIErrorCode.TIMEOUT,
          'Request timeout',
          error
        );
      }

      return new AIProviderError(AIErrorCode.UNKNOWN, error.message, error);
    }

    return new AIProviderError(
      AIErrorCode.UNKNOWN,
      'Unknown error occurred',
      error
    );
  }
}
