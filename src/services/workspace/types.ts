export interface WorkspaceHistory {
  path: string
  name: string
  lastAccessed: string
}

export interface WorkspaceService {
  selectLocalDirectory(): Promise<string | null>
  cloneFromGithub(repositoryUrl: string, targetPath: string): Promise<string>
  getRecentWorkspaces(): Promise<WorkspaceHistory[]>
  setCurrentWorkspace(path: string): Promise<void>
  clearCurrentWorkspace(): Promise<void>
  getCurrentWorkspace(): Promise<string | null>
  openWorkspaceInNewWindow(): Promise<void>
  checkDirectoryExists(path: string): Promise<boolean>
}
