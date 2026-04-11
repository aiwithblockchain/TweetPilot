import { useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { getUserVisibleErrorMessage } from "./components/ErrorBoundary";
import Navigation from "./components/Navigation";
import RuntimePanel from "./components/RuntimePanel";
import DashboardView from "./features/shell/DashboardView";

const navigationItems = [
	{ id: "dashboard", label: "Dashboard", active: true },
	{ id: "workspace", label: "Customer Workspace" },
	{ id: "accounts", label: "Accounts" },
	{ id: "roles", label: "Roles" },
	{ id: "instances", label: "Instances" },
	{ id: "channels", label: "Execution Channels" },
	{ id: "inputs", label: "Comment Inputs" },
	{ id: "tasks", label: "Tasks" },
	{ id: "reports", label: "Reports" },
	{ id: "extensions", label: "Extensions" },
];

export default function App() {
	const [currentView, setCurrentView] = useState("dashboard");

	const handleNavigate = (id: string) => {
		setCurrentView(id);
	};

	const activeItems = navigationItems.map((item) => ({
		...item,
		active: item.id === currentView,
	}));

	return (
		<div className="shell">
			<aside className="sidebar">
				<div>
					<h1>TweetPilot</h1>
					<p className="muted">
						Platform control center for Twitter operations.
					</p>
				</div>

				<Navigation items={activeItems} onNavigate={handleNavigate} />

				<RuntimePanel
					platform={window.tweetOps.runtime.platform}
					appName={window.tweetOps.appName}
				/>
			</aside>

			<ErrorBoundary
				fallback={(error, reset) => (
					<main className="main">
						<section className="error-boundary panel" role="alert">
							<p className="panel-title">Application Error</p>
							<h2>Something went wrong</h2>
							<p className="muted">{getUserVisibleErrorMessage(error)}</p>
							<button type="button" onClick={reset}>
								Try again
							</button>
						</section>
					</main>
				)}
			>
				<DashboardView currentView={currentView} />
			</ErrorBoundary>
		</div>
	);
}
