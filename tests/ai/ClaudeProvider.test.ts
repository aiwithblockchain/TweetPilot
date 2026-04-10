/**
 * ClaudeProvider 测试
 * 使用 Mock 测试 Claude API 调用
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClaudeProvider } from "../../src/ai/ClaudeProvider.js";
import { AIProviderError } from "../../src/ai/errors.js";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
	return {
		default: class MockAnthropic {
			messages = {
				create: vi.fn(),
			};
			constructor() {}
		},
	};
});

describe("ClaudeProvider", () => {
	let provider: ClaudeProvider;
	let mockCreate: ReturnType<typeof vi.fn>;

	beforeEach(async () => {
		const Anthropic = (await import("@anthropic-ai/sdk")).default;
		provider = new ClaudeProvider({
			apiKey: "test-api-key",
			defaultModel: "claude-3-5-sonnet-20241022",
			timeout: 30000,
		});

		// Get the mocked create function
		mockCreate = (provider as any).client.messages.create;
		mockCreate.mockClear();
	});

	describe("generateText", () => {
		it("should generate text successfully", async () => {
			const mockResponse = {
				content: [{ type: "text", text: "Hello, world!" }],
				usage: { input_tokens: 10, output_tokens: 5 },
			};
			mockCreate.mockResolvedValue(mockResponse);

			const result = await provider.generateText("Test prompt");

			expect(result.text).toBe("Hello, world!");
			expect(result.usage).toEqual({
				inputTokens: 10,
				outputTokens: 5,
			});
			expect(mockCreate).toHaveBeenCalledWith({
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1024,
				temperature: undefined,
				stop_sequences: undefined,
				messages: [{ role: "user", content: "Test prompt" }],
			});
		});

		it("should use custom options", async () => {
			const mockResponse = {
				content: [{ type: "text", text: "Custom response" }],
				usage: { input_tokens: 15, output_tokens: 8 },
			};
			mockCreate.mockResolvedValue(mockResponse);

			await provider.generateText("Test prompt", {
				model: "claude-3-opus-20240229",
				maxTokens: 2048,
				temperature: 0.7,
				stopSequences: ["STOP"],
			});

			expect(mockCreate).toHaveBeenCalledWith({
				model: "claude-3-opus-20240229",
				max_tokens: 2048,
				temperature: 0.7,
				stop_sequences: ["STOP"],
				messages: [{ role: "user", content: "Test prompt" }],
			});
		});

		it("should handle multiple text blocks", async () => {
			const mockResponse = {
				content: [
					{ type: "text", text: "Part 1" },
					{ type: "text", text: " Part 2" },
				],
				usage: { input_tokens: 10, output_tokens: 5 },
			};
			mockCreate.mockResolvedValue(mockResponse);

			const result = await provider.generateText("Test prompt");

			expect(result.text).toBe("Part 1 Part 2");
		});

		it("should throw AIProviderError on API error", async () => {
			mockCreate.mockRejectedValue(new Error("API Error"));

			await expect(provider.generateText("Test prompt")).rejects.toThrow(
				AIProviderError,
			);
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
						delta: { type: "text_delta", text: ", " },
					};
					yield {
						type: "content_block_delta",
						delta: { type: "text_delta", text: "world!" },
					};
				},
			};
			mockCreate.mockResolvedValue(mockStream);

			const chunks: string[] = [];
			for await (const chunk of provider.generateTextStream("Test prompt")) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Hello", ", ", "world!"]);
			expect(mockCreate).toHaveBeenCalledWith({
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1024,
				temperature: undefined,
				stop_sequences: undefined,
				messages: [{ role: "user", content: "Test prompt" }],
				stream: true,
			});
		});

		it("should filter non-text events", async () => {
			const mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "message_start" };
					yield {
						type: "content_block_delta",
						delta: { type: "text_delta", text: "Hello" },
					};
					yield { type: "message_stop" };
				},
			};
			mockCreate.mockResolvedValue(mockStream);

			const chunks: string[] = [];
			for await (const chunk of provider.generateTextStream("Test prompt")) {
				chunks.push(chunk);
			}

			expect(chunks).toEqual(["Hello"]);
		});

		it("should throw AIProviderError on stream error", async () => {
			mockCreate.mockRejectedValue(new Error("Stream Error"));

			const generator = provider.generateTextStream("Test prompt");
			await expect(generator.next()).rejects.toThrow(AIProviderError);
		});
	});
});
