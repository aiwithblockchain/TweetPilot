import { describe, expect, it, vi } from "vitest";
import { LocalBridgeReplyExecutor } from "../../src/adapters/localBridge/localBridgeReplyExecutor";

describe("LocalBridgeReplyExecutor contract", () => {
	it("sends the documented request payload shape", async () => {
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

		await executor.postReply({
			tweetId: "tweet-123",
			text: "Contract test reply",
			accountId: "acc-001",
			workspaceId: "ws-001",
		});

		expect(fetchImpl).toHaveBeenCalledWith(
			"http://127.0.0.1:10088/api/v1/x/replies",
			expect.objectContaining({
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					tweetId: "tweet-123",
					text: "Contract test reply",
				}),
			}),
		);
	});

	it("parses the documented success response shape", async () => {
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: vi.fn().mockResolvedValue({
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
			}) as unknown as typeof fetch,
		});

		await expect(
			executor.postReply({
				tweetId: "tweet-123",
				text: "Contract test reply",
				accountId: "acc-001",
				workspaceId: "ws-001",
			}),
		).resolves.toEqual({
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

	it("parses the documented failure response shape", async () => {
		const executor = new LocalBridgeReplyExecutor({
			fetchImpl: vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					ok: false,
					error: {
						code: "NOT_LOGGED_IN",
						message: "Please log in",
					},
				}),
			}) as unknown as typeof fetch,
		});

		await expect(
			executor.postReply({
				tweetId: "tweet-123",
				text: "Contract test reply",
				accountId: "acc-001",
				workspaceId: "ws-001",
			}),
		).resolves.toMatchObject({
			success: false,
			code: "NOT_LOGGED_IN",
			message: "Please log in",
			retryable: false,
			requiresManualIntervention: true,
		});
	});
});
