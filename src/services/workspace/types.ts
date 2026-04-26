export interface WorkspaceHistory {
  path: string
  name: string
  lastAccessed: string
  exists?: boolean
}

export type WorkspaceEntryKind = 'file' | 'directory'

export interface WorkspaceEntry {
  path: string
  name: string
  kind: WorkspaceEntryKind
  extension?: string | null
  size?: number | null
  modifiedAt?: string | null
  hasChildren?: boolean
}

export interface WorkspaceFileContent {
  path: string
  name: string
  extension?: string | null
  contentType: 'text' | 'image' | 'unsupported'
  textContent?: string
  imageSrc?: string
  size?: number | null
  modifiedAt?: string | null
}

export interface WorkspaceFolderSummary {
  path: string
  name: string
  itemCount: number
  folderCount: number
  fileCount: number
}

export interface CreateWorkspaceEntryInput {
  parentPath: string
  name: string
}

export interface RenameWorkspaceEntryInput {
  path: string
  newName: string
}

export interface WorkspaceService {
  selectLocalDirectory(): Promise<string | null>
  cloneFromGithub(repositoryUrl: string, targetPath: string): Promise<string>
  getRecentWorkspaces(): Promise<WorkspaceHistory[]>
  deleteRecentWorkspace(path: string): Promise<void>
  setCurrentWorkspace(path: string): Promise<void>
  clearCurrentWorkspace(): Promise<void>
  getCurrentWorkspace(): Promise<string | null>
  openWorkspaceInNewWindow(): Promise<void>
  checkDirectoryExists(path: string): Promise<boolean>
  listDirectory(path: string): Promise<WorkspaceEntry[]>
  readFile(path: string): Promise<WorkspaceFileContent>
  getFolderSummary(path: string): Promise<WorkspaceFolderSummary>
  createFile(input: CreateWorkspaceEntryInput): Promise<WorkspaceEntry>
  createFolder(input: CreateWorkspaceEntryInput): Promise<WorkspaceEntry>
  renameEntry(input: RenameWorkspaceEntryInput): Promise<WorkspaceEntry>
  deleteEntry(path: string): Promise<void>
}
