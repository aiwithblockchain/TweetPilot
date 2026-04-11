import React from "react";

type ErrorBoundaryProps = {
	children: React.ReactNode;
	fallback?: (error: Error, reset: () => void) => React.ReactNode;
};

type ErrorBoundaryState = {
	error: Error | null;
	retryKey: number;
};

export function getUserVisibleErrorMessage(error: Error): string {
	return import.meta.env.DEV ? error.message : "An unexpected error occurred";
}

export default class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = {
		error: null,
		retryKey: 0,
	};

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return { error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	private reset = () => {
		this.setState((state) => ({
			error: null,
			retryKey: state.retryKey + 1,
		}));
	};

	render() {
		if (this.state.error) {
			if (this.props.fallback) {
				return this.props.fallback(this.state.error, this.reset);
			}

			return (
				<section className="error-boundary panel" role="alert">
					<p className="panel-title">Application Error</p>
					<h2>Something went wrong</h2>
					<p className="muted">
						{getUserVisibleErrorMessage(this.state.error)}
					</p>
					<button type="button" onClick={this.reset}>
						Try again
					</button>
				</section>
			);
		}

		return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
	}
}
