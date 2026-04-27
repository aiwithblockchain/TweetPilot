import { workspaceTauriService } from './tauri'

export type {
  CreateWorkspaceEntryInput,
  RenameWorkspaceEntryInput,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceFolderSummary,
  WorkspaceHistory,
  WorkspaceService,
  WorkspaceWatcherEvent,
} from './types'

export const workspaceService = workspaceTauriService
