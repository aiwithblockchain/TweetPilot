import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeProvider } from "../ClaudeProvider.js";
import { AIErrorCode, AIProviderError } from "../errors.js";

vi.mock("@anthropic-ai/sdk");

describe("ClaudeProvider", () => {
	let provider: ClaudeProvider;
	let mockClient: any;

	beforeEach(() => {
		mockClient = {
			messages: {
				create: vi.fn(),
			},
		};

		vi.mocked(Anthropic).mockImplementation(() => mockClient);

		provider = new ClaudeProvider({
			apiKey: "test-api-key",
			defaultModel: "claude-3-5-sonnet-20241022",
		});
	});

	describe("generateText", () => {
		it("should generate text successfully", async () => {
			mockClient.messages.create.mockResolvedValue({
				content: [{ type: "text", text: "Hello, world!" }],
				usage: { input_tokens: 10, output_tokens: 5 },
			});

			const result = await provider.generateText("Test prompt");

			expect(result.text).toBe("Hello, world!");
			expect(result.usage).toEqual({
				inputTokens: 10,
				outputTokens: 5,
			});
		});

		it("should support custom parameters", async () => {
			mockClient.messages.create.mockResolvedValue({
				content: [{ type: "text", text: "Response" }],
				usage: { input_tokens: 10, output_tokens: 5 },
			});

			await provider.generateText("Test prompt", {
				temperature: 0.7,
				maxTokens: 2048,
				model: "claude-3-opus-20240229",
			});

			expect(mockClient.messages.create).toHaveBeenCalledWith({
				model: "claude-3-opus-20240229",
				max_tokens: 2048,
				temperature: 0.7,
				stop_sequences: undefined,
				messages: [{ role: "user", content: "Test prompt" }],
			});
		});

		it("should throw AUTH_ERROR on 401", async () => {
			const authError = { status: 401, message: "Invalid API key" };
			mockClient.messages.create.mockRejectedValue(authError);

			await expect(provider.generateText("Test")).rejects.toThrow(
				AIProviderError,
			);

			try {
				await provider.generateText("Test");
			} catch (error) {
				expect(error).toBeInstanceOf(AIProviderError);
				expect((error as AIProviderError).code).toBe(AIErrorCode.AUTH_ERROR);
			}
		});

		it("should throw RATE_LIMIT on 429", async () => {
			const rateLimitError = { status: 429, message: "Rate limit exceeded" };
			mockClient.messages.create.mockRejectedValue(rateLimitError);

			try {
				await provider.generateText("Test");
			} catch (error) {
				expect(error).toBeInstanceOf(AIProviderError);
				expect((error as AIProviderError).code).toBe(AIErrorCode.RATE_LIMIT);
			}
		});

		it("should throw SERVICE_UNAVAILABLE on 503", async () => {
			const serviceError = { status: 503, message: "Service unavailable" };
			mockClient.messages.create.mockRejectedValue(serviceError);

			try {
				await provider.generateText("Test");
			} catch (error) {
				expect(error).toBeInstanceOf(AIProviderError);
				expect((error as AIProviderError).code).toBe(
					AIErrorCode.SERVICE_UNAVAILABLE,
				);
			}
		});

		it("should throw TIMEOUT on timeout error", async () => {
			const timeoutError = new Error("Request timeout");
			mockClient.messages.create.mockRejectedValue(timeoutError);

			try {
				await provider.generateText("Test");
			} catch (error) {
				expect(error).toBeInstanceOf(AIProviderError);
				expect((error as AIProviderError).code).toBe(AIErrorCode.TIMEOUT);
			}
		});

		it("should handle multiple text blocks", async () => {
			mockClient.messages.create.mockResolvedValue({
				content: [
					{ type: "text", text: "Part 1 " },
					{ type: "text", text: "Part 2" },
				],
				usage: { input_tokens: 10, output_tokens: 5 },
			});

			const result = await provider.generateText("Test");
			expect(result.text).toBe("Part 1 Part 2");
		});
	});

	describe("generateTextStream", () => {
		it("should stream text successfully", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield {
						type: "content_block_delta",
						delta: { type: "text_delta", text: "Hello" },
					};
					yield {
						type: "content_block_delta",
						delta: { type: "text_delta", text: " world" },
					};
				},
			};

			mockClient.messages.create.mockResolvedValue(mockStream);

			const chunks: string[] = [];
			for await (const chunk of provider.generateTextStream!("Test")) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Hello", " world"]);
		});

		it("should throw error on stream failure", async () => {
			const streamError = { status: 401, message: "Unauthorized" };
			mockClient.messages.create.mockRejectedValue(streamError);

			try {
				const stream = provider.generateTextStream!("Test");
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				for await (const _ of stream) {
					// Should not reach here
				}
			} catch (error) {
				expect(error).toBeInstanceOf(AIProviderError);
				expect((error as AIProviderError).code).toBe(AIErrorCode.AUTH_ERROR);
			}
		});
	});
});
