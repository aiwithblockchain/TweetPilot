import { defaultCurrentWorkspace, defaultRecentWorkspaces } from '../mock-data/workspaces'
import type { WorkspaceHistory, WorkspaceService } from './types'

let currentWorkspace: string | null = defaultCurrentWorkspace
let recentWorkspaces: WorkspaceHistory[] = [...defaultRecentWorkspaces]

function randomDelay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getWorkspaceName(path: string): string {
  const normalizedPath = path.replace(/\\/g, '/')
  const name = normalizedPath.split('/').filter(Boolean).pop()
  return name ?? path
}

function updateRecentWorkspaces(path: string) {
  const now = new Date().toISOString()
  const nextItem: WorkspaceHistory = {
    path,
    name: getWorkspaceName(path),
    lastAccessed: now,
  }

  recentWorkspaces = [nextItem, ...recentWorkspaces.filter((item) => item.path !== path)].slice(0, 10)
}

export const workspaceMockService: WorkspaceService = {
  async selectLocalDirectory() {
    await randomDelay(50, 150)
    return '/Users/demo/projects/tweetpilot-workspace'
  },

  async cloneFromGithub(repositoryUrl: string, targetPath: string) {
    await randomDelay(300, 1500)

    if (!repositoryUrl.trim()) {
      throw new Error('仓库地址不能为空')
    }

    if (!repositoryUrl.startsWith('http')) {
      throw new Error('仓库地址格式非法')
    }

    const repoName = repositoryUrl.split('/').pop()?.replace('.git', '') || 'repo'
    const clonedPath = `${targetPath}/${repoName}`
    currentWorkspace = clonedPath
    updateRecentWorkspaces(clonedPath)
    return clonedPath
  },

  async getRecentWorkspaces() {
    await randomDelay(50, 150)
    return [...recentWorkspaces]
  },

  async setCurrentWorkspace(path: string) {
    await randomDelay(100, 250)

    if (!path.trim()) {
      throw new Error('工作目录不能为空')
    }

    currentWorkspace = path
    updateRecentWorkspaces(path)
  },

  async clearCurrentWorkspace() {
    await randomDelay(50, 150)
    currentWorkspace = null
  },

  async getCurrentWorkspace() {
    await randomDelay(50, 150)
    return currentWorkspace
  },

  async openWorkspaceInNewWindow() {
    await randomDelay(300, 1500)

    if (!currentWorkspace) {
      throw new Error('当前没有可打开的工作目录')
    }
  },

  async checkDirectoryExists(_path: string) {
    await randomDelay(50, 100)
    // In mock mode, assume all directories exist
    return true
  },
}
