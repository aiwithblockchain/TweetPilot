import { describe, expect, it } from "vitest";
import {
	PLATFORM_DATA_SOURCE_ENV_KEY,
	resolveConfiguredDataSourceMode,
} from "../../src/data/platformState";

describe("resolveConfiguredDataSourceMode", () => {
	it("should default to seed when env is undefined", () => {
		expect(resolveConfiguredDataSourceMode(undefined)).toBe("seed");
	});

	it("should resolve local-bridge-hybrid when env matches", () => {
		expect(resolveConfiguredDataSourceMode("local-bridge-hybrid")).toBe(
			"local-bridge-hybrid",
		);
	});

	it("should fall back to seed for unsupported values", () => {
		expect(resolveConfiguredDataSourceMode("unexpected-mode")).toBe("seed");
	});

	it("should expose the data source env key as a constant", () => {
		expect(PLATFORM_DATA_SOURCE_ENV_KEY).toBe("VITE_PLATFORM_DATA_SOURCE");
	});
});
