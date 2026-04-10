type MountPointProps = {
	title: string;
	description: string;
	status?: "pending" | "available";
};

export default function MountPoint({
	title,
	description,
	status = "pending",
}: MountPointProps) {
	return (
		<div className="panel mount-point">
			<div className="mount-point-header">
				<p className="panel-title">{title}</p>
				<span
					className={`status-badge ${status === "available" ? "status-ok" : "status-pending"}`}
				>
					{status === "pending" ? "Pending Implementation" : "Available"}
				</span>
			</div>
			<p className="muted">{description}</p>
		</div>
	);
}
