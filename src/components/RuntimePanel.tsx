type RuntimePanelProps = {
	platform: string;
	appName: string;
};

export default function RuntimePanel({ platform, appName }: RuntimePanelProps) {
	return (
		<div className="panel compact">
			<p className="panel-title">Runtime</p>
			<div className="kv">
				<span>Platform</span>
				<strong>{platform}</strong>
			</div>
			<div className="kv">
				<span>App</span>
				<strong>{appName}</strong>
			</div>
		</div>
	);
}
