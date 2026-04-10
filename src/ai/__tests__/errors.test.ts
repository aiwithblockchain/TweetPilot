import { describe, expect, it } from "vitest";
import { AIErrorCode, AIProviderError } from "../errors.js";

describe("AIProviderError", () => {
	it("should create error with correct properties", () => {
		const error = new AIProviderError(
			AIErrorCode.AUTH_ERROR,
			"Authentication failed",
			new Error("Original error"),
			401,
		);

		expect(error.name).toBe("AIProviderError");
		expect(error.code).toBe(AIErrorCode.AUTH_ERROR);
		expect(error.message).toBe("Authentication failed");
		expect(error.statusCode).toBe(401);
		expect(error.originalError).toBeInstanceOf(Error);
	});

	it("should create AUTH_ERROR from 401 status code", () => {
		const error = AIProviderError.fromStatusCode(401, "Unauthorized");
		expect(error.code).toBe(AIErrorCode.AUTH_ERROR);
		expect(error.statusCode).toBe(401);
	});

	it("should create AUTH_ERROR from 403 status code", () => {
		const error = AIProviderError.fromStatusCode(403, "Forbidden");
		expect(error.code).toBe(AIErrorCode.AUTH_ERROR);
		expect(error.statusCode).toBe(403);
	});

	it("should create RATE_LIMIT from 429 status code", () => {
		const error = AIProviderError.fromStatusCode(429, "Too many requests");
		expect(error.code).toBe(AIErrorCode.RATE_LIMIT);
		expect(error.statusCode).toBe(429);
	});

	it("should create SERVICE_UNAVAILABLE from 503 status code", () => {
		const error = AIProviderError.fromStatusCode(503, "Service unavailable");
		expect(error.code).toBe(AIErrorCode.SERVICE_UNAVAILABLE);
		expect(error.statusCode).toBe(503);
	});

	it("should create SERVICE_UNAVAILABLE from 502 status code", () => {
		const error = AIProviderError.fromStatusCode(502, "Bad gateway");
		expect(error.code).toBe(AIErrorCode.SERVICE_UNAVAILABLE);
		expect(error.statusCode).toBe(502);
	});

	it("should create TIMEOUT from timeout error message", () => {
		const timeoutError = new Error("Request timeout");
		const error = AIProviderError.fromError(timeoutError);
		expect(error.code).toBe(AIErrorCode.TIMEOUT);
	});

	it("should create TIMEOUT from ETIMEDOUT error", () => {
		const timeoutError = new Error("ETIMEDOUT");
		const error = AIProviderError.fromError(timeoutError);
		expect(error.code).toBe(AIErrorCode.TIMEOUT);
	});

	it("should return same error if already AIProviderError", () => {
		const original = new AIProviderError(
			AIErrorCode.RATE_LIMIT,
			"Rate limit exceeded",
		);
		const error = AIProviderError.fromError(original);
		expect(error).toBe(original);
	});

	it("should handle error with status property", () => {
		const httpError = { status: 429, message: "Rate limited" };
		const error = AIProviderError.fromError(httpError);
		expect(error.code).toBe(AIErrorCode.RATE_LIMIT);
		expect(error.statusCode).toBe(429);
	});

	it("should handle unknown error types", () => {
		const error = AIProviderError.fromError("string error");
		expect(error.code).toBe(AIErrorCode.UNKNOWN);
		expect(error.message).toBe("Unknown error occurred");
	});
});
