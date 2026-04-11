import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorBoundary, {
	getUserVisibleErrorMessage,
} from "../../src/components/ErrorBoundary";

function ThrowingChild(): ReactElement {
	throw new Error("boom");
}

function StableChild(): ReactElement {
	return <div>Recovered child</div>;
}

describe("ErrorBoundary", () => {
	it("should render fallback UI when a child throws", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(
			<ErrorBoundary>
				<ThrowingChild />
			</ErrorBoundary>,
		);

		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
		expect(screen.getByText("boom")).toBeInTheDocument();

		consoleError.mockRestore();
	});

	it("should reset after retry when the child no longer throws", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		let shouldThrow = true;

		function MaybeChild(): ReactElement {
			return shouldThrow ? <ThrowingChild /> : <StableChild />;
		}

		render(
			<ErrorBoundary>
				<MaybeChild />
			</ErrorBoundary>,
		);

		shouldThrow = false;
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		expect(screen.getByText("Recovered child")).toBeInTheDocument();

		consoleError.mockRestore();
	});

	it("should use a custom fallback when provided", () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		render(
			<ErrorBoundary
				fallback={(error, reset) => (
					<div>
						<span>Custom fallback: {error.message}</span>
						<button type="button" onClick={reset}>
							Reset custom fallback
						</button>
					</div>
				)}
			>
				<ThrowingChild />
			</ErrorBoundary>,
		);

		expect(screen.getByText("Custom fallback: boom")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Reset custom fallback" }),
		).toBeInTheDocument();

		consoleError.mockRestore();
	});

	it("should sanitize production error messages", () => {
		expect(getUserVisibleErrorMessage(new Error("secret details"))).toBe(
			import.meta.env.DEV ? "secret details" : "An unexpected error occurred",
		);
	});
});
