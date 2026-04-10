// LocalBridge HTTP client - minimal read capabilities for Phase 1
// Encapsulates communication with LocalBridge REST API

import type {
  LocalBridgeInstance,
  LocalBridgeTabStatus,
  LocalBridgeTweetDetailResponse,
  LocalBridgeRepliesResponse,
} from './types';

export interface LocalBridgeClientConfig {
  baseUrl?: string;
  timeout?: number;
}

export class LocalBridgeClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: LocalBridgeClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:10088';
    this.timeout = config.timeout || 10000;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LocalBridge API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Get all connected X instances
  async getInstances(): Promise<LocalBridgeInstance[]> {
    return this.fetch<LocalBridgeInstance[]>('/api/v1/x/instances');
  }

  // Get X tab status
  async getTabStatus(instanceId?: string): Promise<LocalBridgeTabStatus> {
    const params = instanceId ? `?instanceId=${instanceId}` : '';
    return this.fetch<LocalBridgeTabStatus>(`/api/v1/x/status${params}`);
  }

  // Get tweet detail
  async getTweet(tweetId: string, tabId?: number): Promise<LocalBridgeTweetDetailResponse> {
    const params = tabId ? `?tabId=${tabId}` : '';
    return this.fetch<LocalBridgeTweetDetailResponse>(`/api/v1/x/tweets/${tweetId}${params}`);
  }

  // Get tweet replies
  async getTweetReplies(
    tweetId: string,
    options?: { cursor?: string; tabId?: number }
  ): Promise<LocalBridgeRepliesResponse> {
    const params = new URLSearchParams();
    if (options?.cursor) params.append('cursor', options.cursor);
    if (options?.tabId) params.append('tabId', options.tabId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.fetch<LocalBridgeRepliesResponse>(`/api/v1/x/tweets/${tweetId}/replies${query}`);
  }
}
