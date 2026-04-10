import type { AccountId } from './types';
import type { RoleId } from './role';

export interface AccountRole {
  accountId: AccountId;
  roleId: RoleId;
  isDefault: boolean;
  createdAt: Date;
}

export interface CreateAccountRoleParams {
  accountId: AccountId;
  roleId: RoleId;
  isDefault?: boolean;
}

export function createAccountRole(params: CreateAccountRoleParams): AccountRole {
  return {
    accountId: params.accountId,
    roleId: params.roleId,
    isDefault: params.isDefault ?? false,
    createdAt: new Date(),
  };
}
