import type { AccountRole } from '../../domain/accountRole';
import { createAccountRole } from '../../domain/accountRole';
import type { Role, RoleId } from '../../domain/role';
import type { ICandidateReplyRepository } from './ICandidateReplyRepository';
import type { IRoleRepository } from './IRoleRepository';

const roleNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export class InMemoryRoleRepository implements IRoleRepository {
  private roles: Map<RoleId, Role> = new Map();
  private accountRoles: AccountRole[] = [];

  constructor(private candidateReplyRepository: ICandidateReplyRepository) {}

  async save(role: Role): Promise<void> {
    this.roles.set(role.id, role);
  }

  async findById(id: RoleId): Promise<Role | null> {
    return this.roles.get(id) ?? null;
  }

  async findByWorkspace(workspaceId: string): Promise<Role[]> {
    return Array.from(this.roles.values())
      .filter((role) => role.workspaceId === workspaceId)
      .sort((left, right) => roleNameCollator.compare(left.name, right.name));
  }

  async delete(id: RoleId): Promise<void> {
    const repliesUsingRole = await this.candidateReplyRepository.findByRole(id);
    if (repliesUsingRole.length > 0) {
      throw new Error(
        `Cannot delete role ${id}: ${repliesUsingRole.length} candidate replies reference this role.`
      );
    }

    const bindings = this.accountRoles.filter((binding) => binding.roleId === id);
    if (bindings.length > 0) {
      throw new Error(
        `Cannot delete role ${id}: ${bindings.length} accounts are bound to this role.`
      );
    }

    this.roles.delete(id);
  }

  async bindRole(
    accountId: string,
    roleId: string,
    isDefault: boolean
  ): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role ${roleId} does not exist.`);
    }

    if (isDefault) {
      this.accountRoles = this.accountRoles.map((binding) =>
        binding.accountId === accountId
          ? { ...binding, isDefault: false }
          : binding
      );
    }

    const existingIndex = this.accountRoles.findIndex(
      (binding) => binding.accountId === accountId && binding.roleId === roleId
    );

    if (existingIndex >= 0) {
      this.accountRoles[existingIndex] = {
        ...this.accountRoles[existingIndex],
        isDefault,
      };
      return;
    }

    this.accountRoles.push(
      createAccountRole({
        accountId,
        roleId,
        isDefault,
      })
    );
  }

  async unbindRole(accountId: string, roleId: string): Promise<void> {
    this.accountRoles = this.accountRoles.filter(
      (binding) => !(binding.accountId === accountId && binding.roleId === roleId)
    );
  }

  async getAccountRoles(accountId: string): Promise<Role[]> {
    const bindings = this.accountRoles
      .filter((binding) => binding.accountId === accountId)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));

    return bindings
      .map((binding) => this.roles.get(binding.roleId) ?? null)
      .filter((role): role is Role => role !== null);
  }

  async getDefaultRole(accountId: string): Promise<Role | null> {
    const defaultBinding = this.accountRoles.find(
      (binding) => binding.accountId === accountId && binding.isDefault
    );

    if (!defaultBinding) {
      return null;
    }

    return this.roles.get(defaultBinding.roleId) ?? null;
  }

  clear(): void {
    this.roles.clear();
    this.accountRoles = [];
  }
}
