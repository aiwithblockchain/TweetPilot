import type {
	ITwitterReplyExecutor,
	PostReplyInput,
	PostReplyResult,
} from "../../domain/twitterReplyExecutor";

interface LocalBridgeReplyResponse {
	ok: boolean;
	data?: {
		create_tweet?: {
			tweet_results?: {
				result?: {
					rest_id?: string;
				};
			};
		};
	};
	error?: {
		code: string;
		message: string;
	};
}

export interface LocalBridgeReplyExecutorOptions {
	baseUrl?: string;
	timeout?: number;
	fetchImpl?: typeof fetch;
}

export class LocalBridgeReplyExecutor implements ITwitterReplyExecutor {
	readonly type = "localbridge" as const;

	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly fetchImpl: typeof fetch;

	constructor(options: LocalBridgeReplyExecutorOptions = {}) {
		this.baseUrl = options.baseUrl ?? "http://127.0.0.1:10088";
		this.timeout = options.timeout ?? 10_000;
		this.fetchImpl = options.fetchImpl ?? fetch;
	}

	async isAvailable(): Promise<boolean> {
		try {
			const response = await this.fetchWithTimeout("/api/v1/x/status", {
				method: "GET",
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async postReply(input: PostReplyInput): Promise<PostReplyResult> {
		if (!input.tweetId || !input.text) {
			return {
				success: false,
				code: "INVALID_INPUT",
				message: "Missing tweetId or text",
				retryable: false,
			};
		}

		try {
			const response = await this.fetchWithTimeout("/api/v1/x/replies", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tweetId: input.tweetId,
					text: input.text,
				}),
			});
			const data = (await response.json()) as LocalBridgeReplyResponse;

			if (data.ok && data.data?.create_tweet?.tweet_results?.result?.rest_id) {
				return {
					success: true,
					replyTweetId: data.data.create_tweet.tweet_results.result.rest_id,
					rawResponse: data as unknown as Record<string, unknown>,
				};
			}

			const code = data.error?.code ?? "UNKNOWN_ERROR";
			const message = data.error?.message ?? "Unknown error from LocalBridge";

			return {
				success: false,
				code,
				message,
				retryable: this.isRetryableError(code),
				requiresManualIntervention: this.requiresManualIntervention(code),
				rawResponse: data as unknown as Record<string, unknown>,
			};
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				return {
					success: false,
					code: "TIMEOUT",
					message: "LocalBridge request timeout",
					retryable: true,
				};
			}

			return {
				success: false,
				code: "NETWORK_ERROR",
				message: error instanceof Error ? error.message : String(error),
				retryable: true,
			};
		}
	}

	private async fetchWithTimeout(
		path: string,
		options: RequestInit,
	): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await this.fetchImpl(`${this.baseUrl}${path}`, {
				...options,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private isRetryableError(code: string): boolean {
		return [
			"RATE_LIMITED",
			"NETWORK_ERROR",
			"TIMEOUT",
			"LOCALBRIDGE_UNAVAILABLE",
			"UNKNOWN_ERROR",
		].includes(code);
	}

	private requiresManualIntervention(code: string): boolean {
		return [
			"NOT_LOGGED_IN",
			"RATE_LIMITED",
			"CONTENT_VIOLATION",
			"ACCOUNT_SUSPENDED",
			"PERMISSION_DENIED",
		].includes(code);
	}
}
