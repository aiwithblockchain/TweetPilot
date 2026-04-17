import { tauriInvoke } from '@/lib/tauri-api'
import type { WorkspaceHistory, WorkspaceService } from './types'

interface TauriWorkspaceHistory {
  path: string
  name: string
  last_accessed: string
}

function mapWorkspaceHistory(item: TauriWorkspaceHistory): WorkspaceHistory {
  return {
    path: item.path,
    name: item.name,
    lastAccessed: item.last_accessed,
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

  async setCurrentWorkspace(path: string) {
    await tauriInvoke<void>('set_current_workspace', { path })
  },

  async clearCurrentWorkspace() {
    await tauriInvoke<void>('clear_current_workspace_command')
  },

  async getCurrentWorkspace() {
    return tauriInvoke<string | null>('get_current_workspace')
  },

  async openWorkspaceInNewWindow() {
    await tauriInvoke<void>('open_workspace_in_new_window')
  },
}
