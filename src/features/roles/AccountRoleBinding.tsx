import type { Role } from "../../domain/role";
import type { Account } from "../../domain/types";

type AccountRoleBindingProps = {
	accounts: Account[];
	selectedAccountId: string;
	disabled?: boolean;
	onSelectAccount: (accountId: string) => void;
	workspaceRoles: Role[];
	boundRoles: Role[];
	defaultRoleId?: string | null;
	onBindRole: (
		accountId: string,
		roleId: string,
		isDefault: boolean,
	) => Promise<void> | void;
	onUnbindRole: (accountId: string, roleId: string) => Promise<void> | void;
	onSetDefaultRole: (accountId: string, roleId: string) => Promise<void> | void;
};

export default function AccountRoleBinding({
	accounts,
	selectedAccountId,
	disabled = false,
	onSelectAccount,
	workspaceRoles,
	boundRoles,
	defaultRoleId,
	onBindRole,
	onUnbindRole,
	onSetDefaultRole,
}: AccountRoleBindingProps) {
	const selectedAccount =
		accounts.find((account) => account.id === selectedAccountId) ??
		accounts[0] ??
		null;
	const boundRoleIds = new Set(boundRoles.map((role) => role.id));

	if (!selectedAccount) {
		return (
			<section className="panel role-panel">
				<p className="panel-title">Account Role Binding</p>
				<p className="muted">No accounts available in this workspace.</p>
			</section>
		);
	}

	return (
		<section className="panel role-panel">
			<div className="binding-header">
				<div>
					<p className="panel-title">Account Role Binding</p>
					<p className="muted">
						Bind roles and mark a default role per account.
					</p>
				</div>
				<label className="field field-inline">
					<span>Account</span>
					<select
						value={selectedAccount.id}
						disabled={disabled}
						onChange={(event) => onSelectAccount(event.target.value)}
					>
						{accounts.map((account) => (
							<option key={account.id} value={account.id}>
								{account.displayName}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className="binding-columns">
				<div>
					<h3 className="section-title">Bound Roles</h3>
					{boundRoles.length === 0 ? (
						<p className="muted">This account has no roles yet.</p>
					) : (
						<div className="binding-list">
							{boundRoles.map((role) => (
								<div key={role.id} className="binding-item">
									<div>
										<strong>{role.name}</strong>
										<p className="muted">{role.description}</p>
									</div>
									<div className="action-row">
										{defaultRoleId === role.id ? (
											<span className="default-pill">Default</span>
										) : (
											<button
												type="button"
												className="secondary-button"
												disabled={disabled}
												onClick={() =>
													onSetDefaultRole(selectedAccount.id, role.id)
												}
											>
												Set Default
											</button>
										)}
										<button
											type="button"
											className="secondary-button"
											disabled={disabled}
											onClick={() => onUnbindRole(selectedAccount.id, role.id)}
										>
											Unbind
										</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div>
					<h3 className="section-title">Available Workspace Roles</h3>
					{workspaceRoles.length === 0 ? (
						<p className="muted">Create a role first.</p>
					) : (
						<div className="binding-list">
							{workspaceRoles.map((role) => {
								const isBound = boundRoleIds.has(role.id);
								return (
									<div key={role.id} className="binding-item">
										<div>
											<strong>{role.name}</strong>
											<p className="muted">{role.prompt}</p>
										</div>
										<div className="action-row">
											{isBound ? (
												<span className="default-pill default-pill-muted">
													Bound
												</span>
											) : (
												<>
													<button
														type="button"
														className="secondary-button"
														disabled={disabled}
														onClick={() =>
															onBindRole(selectedAccount.id, role.id, false)
														}
													>
														Bind
													</button>
													<button
														type="button"
														className="action-button"
														disabled={disabled}
														onClick={() =>
															onBindRole(selectedAccount.id, role.id, true)
														}
													>
														Bind As Default
													</button>
												</>
											)}
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
