import type { Role, RoleId } from "../../domain/role";

export interface IRoleRepository {
	save(role: Role): Promise<void>;
	findById(id: RoleId): Promise<Role | null>;
	findByWorkspace(workspaceId: string): Promise<Role[]>;
	delete(id: RoleId): Promise<void>;
	bindRole(
		accountId: string,
		roleId: string,
		isDefault: boolean,
	): Promise<void>;
	unbindRole(accountId: string, roleId: string): Promise<void>;
	getAccountRoles(accountId: string): Promise<Role[]>;
	getDefaultRole(accountId: string): Promise<Role | null>;
}
