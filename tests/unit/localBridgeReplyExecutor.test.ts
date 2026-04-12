import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalBridgeReplyExecutor } from "../../src/adapters/localBridge/localBridgeReplyExecutor";

describe("LocalBridgeReplyExecutor", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns invalid input when tweetId or text is missing", async () => {
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: vi.fn() as unknown as typeof fetch,
		});

		await expect(
			executor.postReply({
				tweetId: "",
				text: "",
				accountId: "acc-001",
				workspaceId: "ws-001",
			}),
		).resolves.toMatchObject({
			success: false,
			code: "INVALID_INPUT",
			retryable: false,
		});
	});

	it("maps successful LocalBridge reply response", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				ok: true,
				data: {
					create_tweet: {
						tweet_results: {
							result: {
								rest_id: "tweet-999",
							},
						},
					},
				},
			}),
		});

		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		const result = await executor.postReply({
			tweetId: "tweet-123",
			text: "hello world",
			accountId: "acc-001",
			workspaceId: "ws-001",
		});

		expect(fetchImpl).toHaveBeenCalledWith(
			"http://127.0.0.1:10088/api/v1/x/replies",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					tweetId: "tweet-123",
					text: "hello world",
				}),
			}),
		);
		expect(result).toEqual({
			success: true,
			replyTweetId: "tweet-999",
			rawResponse: {
				ok: true,
				data: {
					create_tweet: {
						tweet_results: {
							result: {
								rest_id: "tweet-999",
							},
						},
					},
				},
			},
		});
	});

	it("maps failed LocalBridge response and marks manual intervention", async () => {
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					ok: false,
					error: {
						code: "RATE_LIMITED",
						message: "too many requests",
					},
				}),
			}) as unknown as typeof fetch,
		});

		await expect(
			executor.postReply({
				tweetId: "tweet-123",
				text: "hello world",
				accountId: "acc-001",
				workspaceId: "ws-001",
			}),
		).resolves.toMatchObject({
			success: false,
			code: "RATE_LIMITED",
			retryable: true,
			requiresManualIntervention: true,
		});
	});

	it("maps network failures to retryable network errors", async () => {
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: vi.fn().mockRejectedValue(new Error("socket closed")) as unknown as typeof fetch,
		});

		await expect(
			executor.postReply({
				tweetId: "tweet-123",
				text: "hello world",
				accountId: "acc-001",
				workspaceId: "ws-001",
			}),
		).resolves.toMatchObject({
			success: false,
			code: "NETWORK_ERROR",
			retryable: true,
		});
	});

	it("checks executor availability through status endpoint", async () => {
		const fetchImpl = vi.fn().mockResolvedValue({
			ok: true,
		});
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		await expect(executor.isAvailable()).resolves.toBe(true);
		expect(fetchImpl).toHaveBeenCalledWith(
			"http://127.0.0.1:10088/api/v1/x/status",
			expect.objectContaining({
				method: "GET",
			}),
		);
	});
});
