import type { Role } from "../../domain/role";

type RoleListItem = {
	role: Role;
	boundCount: number;
	defaultCount: number;
};

type RoleListProps = {
	roles: RoleListItem[];
	selectedRoleId?: string | null;
	disabled?: boolean;
	onSelectRole?: (role: Role) => void;
	onEditRole?: (role: Role) => void;
	onDeleteRole?: (roleId: string) => void;
};

export default function RoleList({
	roles,
	selectedRoleId,
	disabled = false,
	onSelectRole,
	onEditRole,
	onDeleteRole,
}: RoleListProps) {
	return (
		<section className="panel role-panel">
			<p className="panel-title">Workspace Roles ({roles.length})</p>
			{roles.length === 0 ? (
				<p className="muted">No roles in this workspace yet.</p>
			) : (
				<div className="role-list">
					{roles.map(({ role, boundCount, defaultCount }) => (
						<article
							key={role.id}
							className={`role-card ${selectedRoleId === role.id ? "is-selected" : ""}`}
						>
							<button
								type="button"
								className="role-card-main"
								disabled={disabled}
								onClick={() => onSelectRole?.(role)}
							>
								<div className="role-card-header">
									<strong>{role.name}</strong>
									<span className="role-stats">
										Bound {boundCount}
										{" · "}
										Default {defaultCount}
									</span>
								</div>
								<p>{role.description}</p>
								<p className="muted">Prompt: {role.prompt}</p>
							</button>
							<div className="action-row">
								<button
									type="button"
									className="secondary-button"
									disabled={disabled}
									onClick={() => onEditRole?.(role)}
								>
									Edit
								</button>
								<button
									type="button"
									className="secondary-button danger-button"
									disabled={disabled}
									onClick={() => onDeleteRole?.(role.id)}
								>
									Delete
								</button>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
