import { workspaceTauriService } from './tauri'

export type {
  CreateWorkspaceEntryInput,
  RenameWorkspaceEntryInput,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceFolderSummary,
  WorkspaceHistory,
  WorkspaceService,
} from './types'

export const workspaceService = workspaceTauriService
