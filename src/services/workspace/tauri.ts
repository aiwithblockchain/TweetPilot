import { tauriInvoke } from '@/lib/tauri-api'
import type {
  CreateWorkspaceEntryInput,
  RenameWorkspaceEntryInput,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceFolderSummary,
  WorkspaceHistory,
  WorkspaceService,
} from './types'

interface TauriWorkspaceHistory {
  path: string
  name: string
  last_accessed: string
}

interface TauriWorkspaceEntry {
  path: string
  name: string
  kind: 'file' | 'directory'
  extension?: string | null
  size?: number | null
  modified_at?: string | null
  has_children?: boolean
}

interface TauriWorkspaceFileContent {
  path: string
  name: string
  extension?: string | null
  content_type: 'text' | 'image' | 'unsupported'
  text_content?: string
  image_src?: string
  size?: number | null
  modified_at?: string | null
}

interface TauriWorkspaceFolderSummary {
  path: string
  name: string
  item_count: number
  folder_count: number
  file_count: number
}

function mapWorkspaceHistory(item: TauriWorkspaceHistory): WorkspaceHistory {
  return {
    path: item.path,
    name: item.name,
    lastAccessed: item.last_accessed,
  }
}

function mapWorkspaceEntry(item: TauriWorkspaceEntry): WorkspaceEntry {
  return {
    path: item.path,
    name: item.name,
    kind: item.kind,
    extension: item.extension ?? null,
    size: item.size ?? null,
    modifiedAt: item.modified_at ?? null,
    hasChildren: item.has_children ?? false,
  }
}

function mapWorkspaceFileContent(item: TauriWorkspaceFileContent): WorkspaceFileContent {
  return {
    path: item.path,
    name: item.name,
    extension: item.extension ?? null,
    contentType: item.content_type,
    textContent: item.text_content,
    imageSrc: item.image_src,
    size: item.size ?? null,
    modifiedAt: item.modified_at ?? null,
  }
}

function mapWorkspaceFolderSummary(item: TauriWorkspaceFolderSummary): WorkspaceFolderSummary {
  return {
    path: item.path,
    name: item.name,
    itemCount: item.item_count,
    folderCount: item.folder_count,
    fileCount: item.file_count,
  }
}

export const workspaceTauriService: WorkspaceService = {
  async selectLocalDirectory() {
    return tauriInvoke<string | null>('select_local_directory')
  },

  async cloneFromGithub(repositoryUrl, targetPath) {
    return tauriInvoke<string>('clone_from_github', { repositoryUrl, targetPath })
  },

  async getRecentWorkspaces() {
    const response = await tauriInvoke<TauriWorkspaceHistory[]>('get_recent_workspaces')
    return response.map(mapWorkspaceHistory)
  },

  async deleteRecentWorkspace(path: string) {
    await tauriInvoke<void>('delete_recent_workspace', { path })
  },

  async setCurrentWorkspace(path: string) {
    await tauriInvoke<void>('set_current_workspace', { path })
  },

  async clearCurrentWorkspace() {
    await tauriInvoke<void>('clear_current_workspace_command')
  },

  async getCurrentWorkspace() {
    return tauriInvoke<string | null>('get_current_workspace')
  },

  async checkDirectoryExists(path: string) {
    return tauriInvoke<boolean>('check_directory_exists', { path })
  },

  async listDirectory(path: string) {
    const response = await tauriInvoke<TauriWorkspaceEntry[]>('list_workspace_directory', { path })
    return response.map(mapWorkspaceEntry)
  },

  async readFile(path: string) {
    const response = await tauriInvoke<TauriWorkspaceFileContent>('read_workspace_file', { path })
    return mapWorkspaceFileContent(response)
  },

  async getFolderSummary(path: string) {
    const response = await tauriInvoke<TauriWorkspaceFolderSummary>('get_workspace_folder_summary', { path })
    return mapWorkspaceFolderSummary(response)
  },

  async createFile(input: CreateWorkspaceEntryInput) {
    const response = await tauriInvoke<TauriWorkspaceEntry>('create_workspace_file', input as unknown as Record<string, unknown>)
    return mapWorkspaceEntry(response)
  },

  async createFolder(input: CreateWorkspaceEntryInput) {
    const response = await tauriInvoke<TauriWorkspaceEntry>('create_workspace_folder', input as unknown as Record<string, unknown>)
    return mapWorkspaceEntry(response)
  },

  async renameEntry(input: RenameWorkspaceEntryInput) {
    const response = await tauriInvoke<TauriWorkspaceEntry>('rename_workspace_entry', input as unknown as Record<string, unknown>)
    return mapWorkspaceEntry(response)
  },

  async deleteEntry(path: string) {
    await tauriInvoke<void>('delete_workspace_entry', { path })
  },

  async startWorkspaceWatcher(path: string) {
    await tauriInvoke<void>('start_workspace_watcher', { path })
  },

  async stopWorkspaceWatcher() {
    await tauriInvoke<void>('stop_workspace_watcher')
  },
}
