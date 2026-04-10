import type { WorkspaceId } from './types';

export type RoleId = string;

export interface Role {
  id: RoleId;
  name: string;
  description: string;
  prompt: string;
  workspaceId: WorkspaceId;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateRoleParams {
  name: string;
  description: string;
  prompt: string;
  workspaceId: WorkspaceId;
  metadata?: Record<string, unknown>;
}

export function generateRoleId(): RoleId {
  return crypto.randomUUID();
}

export function createRole(params: CreateRoleParams): Role {
  return {
    id: generateRoleId(),
    name: params.name.trim(),
    description: params.description.trim(),
    prompt: params.prompt.trim(),
    workspaceId: params.workspaceId,
    createdAt: new Date(),
    metadata: params.metadata,
  };
}
