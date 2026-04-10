import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIProviderFactory } from "../AIProviderFactory.js";
import { ClaudeProvider } from "../ClaudeProvider.js";

vi.mock("../ClaudeProvider.js");

describe("AIProviderFactory", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should create Claude provider", () => {
		const config = {
			apiKey: "test-key",
			defaultModel: "claude-3-5-sonnet-20241022",
		};

		const provider = AIProviderFactory.create("claude", config);

		expect(ClaudeProvider).toHaveBeenCalledWith(config);
		expect(provider).toBeInstanceOf(ClaudeProvider);
	});

	it("should throw error for OpenAI provider (not implemented)", () => {
		expect(() => {
			AIProviderFactory.create("openai", { apiKey: "test" } as any);
		}).toThrow("OpenAI provider not implemented yet");
	});

	it("should throw error for local provider (not implemented)", () => {
		expect(() => {
			AIProviderFactory.create("local", { apiKey: "test" } as any);
		}).toThrow("Local provider not implemented yet");
	});

	it("should throw error for unknown provider type", () => {
		expect(() => {
			AIProviderFactory.create("unknown" as any, {} as any);
		}).toThrow("Unknown provider type: unknown");
	});
});
