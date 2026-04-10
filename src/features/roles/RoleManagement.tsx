import { useEffect, useMemo, useState } from "react";
import { platformState } from "../../data/platformState";
import { roleRepository } from "../../data/roleRepositoryInstance";
import { createRole, type Role } from "../../domain/role";
import AccountRoleBinding from "./AccountRoleBinding";
import RoleForm from "./RoleForm";
import RoleList from "./RoleList";

type AccountRoleView = {
	roles: Role[];
	defaultRoleId: string | null;
};

export default function RoleManagement() {
	const workspaces = platformState.getWorkspaces();
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
		workspaces[0]?.id ?? "",
	);
	const [selectedAccountId, setSelectedAccountId] = useState("");
	const [roles, setRoles] = useState<Role[]>([]);
	const [accountRoleViews, setAccountRoleViews] = useState<
		Record<string, AccountRoleView>
	>({});
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadingMessage, setLoadingMessage] = useState("Loading role data...");

	const accounts = useMemo(
		() => platformState.getAccounts(selectedWorkspaceId),
		[selectedWorkspaceId],
	);

	useEffect(() => {
		if (!accounts.some((account) => account.id === selectedAccountId)) {
			setSelectedAccountId(accounts[0]?.id ?? "");
		}
	}, [accounts, selectedAccountId]);

	const selectedWorkspace =
		workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
		null;
	const selectedAccountRoles = accountRoleViews[selectedAccountId]?.roles ?? [];
	const selectedDefaultRoleId =
		accountRoleViews[selectedAccountId]?.defaultRoleId ?? null;

	const roleItems = roles.map((role) => {
		const boundAccounts = Object.values(accountRoleViews).filter((view) =>
			view.roles.some((boundRole) => boundRole.id === role.id),
		);
		const defaultAccounts = boundAccounts.filter(
			(view) => view.defaultRoleId === role.id,
		);

		return {
			role,
			boundCount: boundAccounts.length,
			defaultCount: defaultAccounts.length,
		};
	});

	const loadWorkspaceData = async (workspaceId: string) => {
		const workspaceRoles = await roleRepository.findByWorkspace(workspaceId);
		const workspaceAccounts = platformState.getAccounts(workspaceId);
		const accountEntries = await Promise.all(
			workspaceAccounts.map(async (account) => {
				const boundRoles = await roleRepository.getAccountRoles(account.id);
				const defaultRole = await roleRepository.getDefaultRole(account.id);
				return [
					account.id,
					{
						roles: boundRoles,
						defaultRoleId: defaultRole?.id ?? null,
					},
				] as const;
			}),
		);

		return {
			workspaceRoles,
			accountRoleViews: Object.fromEntries(accountEntries),
		};
	};

	const reload = async (
		workspaceId: string = selectedWorkspaceId,
		message: string = "Loading role data...",
	) => {
		setIsLoading(true);
		setLoadingMessage(message);
		try {
			const { workspaceRoles, accountRoleViews: nextAccountRoleViews } =
				await loadWorkspaceData(workspaceId);

			setRoles(workspaceRoles);
			setAccountRoleViews(nextAccountRoleViews);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void reload(selectedWorkspaceId, "Loading role data...");
	}, [selectedWorkspaceId]);

	const runWithLoading = async (
		message: string,
		action: () => Promise<void> | void,
	) => {
		setIsLoading(true);
		setLoadingMessage(message);
		try {
			await action();
			const { workspaceRoles, accountRoleViews: nextAccountRoleViews } =
				await loadWorkspaceData(selectedWorkspaceId);
			setRoles(workspaceRoles);
			setAccountRoleViews(nextAccountRoleViews);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="roles-layout" aria-busy={isLoading}>
			<section className="panel">
				<div className="binding-header">
					<div>
						<p className="panel-title">Workspace Scope</p>
						<p className="muted">Roles are isolated per workspace.</p>
					</div>
					<label className="field field-inline">
						<span>Workspace</span>
						<select
							value={selectedWorkspaceId}
							disabled={isLoading}
							onChange={(event) => {
								setSelectedWorkspaceId(event.target.value);
								setEditingRole(null);
								setFeedback(null);
							}}
						>
							{workspaces.map((workspace) => (
								<option key={workspace.id} value={workspace.id}>
									{workspace.name}
								</option>
							))}
						</select>
					</label>
				</div>
				{feedback && <p className="feedback-message">{feedback}</p>}
				{isLoading && <p className="muted busy-indicator">{loadingMessage}</p>}
			</section>

			<div className="roles-grid">
				<div className="roles-grid-left">
					<RoleForm
						workspaceName={selectedWorkspace?.name ?? selectedWorkspaceId}
						editingRole={editingRole}
						disabled={isLoading}
						onCancelEdit={() => setEditingRole(null)}
						onSubmit={async (values) => {
							const roleToSave = editingRole
								? {
										...editingRole,
										name: values.name.trim(),
										description: values.description.trim(),
										prompt: values.prompt.trim(),
									}
								: createRole({
										...values,
										workspaceId: selectedWorkspaceId,
									});

							await runWithLoading(
								editingRole ? "Saving role..." : "Creating role...",
								async () => {
									await roleRepository.save(roleToSave);
									setEditingRole(null);
									setFeedback(
										editingRole
											? `Updated role ${roleToSave.name}.`
											: `Created role ${roleToSave.name}.`,
									);
								},
							);
						}}
					/>

					<RoleList
						roles={roleItems}
						selectedRoleId={editingRole?.id ?? null}
						disabled={isLoading}
						onSelectRole={(role) => setEditingRole(role)}
						onEditRole={(role) => setEditingRole(role)}
						onDeleteRole={async (roleId) => {
							await runWithLoading("Deleting role...", async () => {
								try {
									await roleRepository.delete(roleId);
									setFeedback("Role deleted.");
									if (editingRole?.id === roleId) {
										setEditingRole(null);
									}
								} catch (error) {
									setFeedback(
										error instanceof Error
											? error.message
											: "Failed to delete role.",
									);
								}
							});
						}}
					/>
				</div>

				<AccountRoleBinding
					accounts={accounts}
					selectedAccountId={selectedAccountId}
					disabled={isLoading}
					onSelectAccount={setSelectedAccountId}
					workspaceRoles={roles}
					boundRoles={selectedAccountRoles}
					defaultRoleId={selectedDefaultRoleId}
					onBindRole={async (accountId, roleId, isDefault) => {
						await runWithLoading(
							isDefault ? "Binding default role..." : "Binding role...",
							async () => {
								await roleRepository.bindRole(accountId, roleId, isDefault);
								setFeedback(
									isDefault
										? "Bound role as default."
										: "Bound role to account.",
								);
							},
						);
					}}
					onUnbindRole={async (accountId, roleId) => {
						await runWithLoading("Unbinding role...", async () => {
							await roleRepository.unbindRole(accountId, roleId);
							setFeedback("Unbound role from account.");
						});
					}}
					onSetDefaultRole={async (accountId, roleId) => {
						await runWithLoading("Switching default role...", async () => {
							await roleRepository.bindRole(accountId, roleId, true);
							setFeedback("Updated default role.");
						});
					}}
				/>
			</div>
		</div>
	);
}
