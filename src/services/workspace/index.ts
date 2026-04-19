import { workspaceTauriService } from './tauri'

export type {
  CreateWorkspaceEntryInput,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceFolderSummary,
  WorkspaceHistory,
  WorkspaceService,
} from './types'

export const workspaceService = workspaceTauriService
