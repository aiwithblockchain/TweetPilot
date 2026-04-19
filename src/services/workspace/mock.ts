import { defaultCurrentWorkspace, defaultRecentWorkspaces } from '../mock-data/workspaces'
import type {
  CreateWorkspaceEntryInput,
  WorkspaceEntry,
  WorkspaceFileContent,
  WorkspaceFolderSummary,
  WorkspaceHistory,
  WorkspaceService,
} from './types'

let currentWorkspace: string | null = defaultCurrentWorkspace
let recentWorkspaces: WorkspaceHistory[] = [...defaultRecentWorkspaces]

interface MockNode {
  kind: 'file' | 'directory'
  children?: Record<string, MockNode>
  content?: string
  contentType?: WorkspaceFileContent['contentType']
}

const mockTree: Record<string, MockNode> = {
  src: {
    kind: 'directory',
    children: {
      components: {
        kind: 'directory',
        children: {
          'AppShell.tsx': {
            kind: 'file',
            contentType: 'text',
            content: "export function AppShell() {\n  return <div>TweetPilot</div>\n}\n",
          },
        },
      },
      'main.tsx': {
        kind: 'file',
        contentType: 'text',
        content: "console.log('TweetPilot workspace mock')\n",
      },
    },
  },
  docs: {
    kind: 'directory',
    children: {
      'explorer-v1.md': {
        kind: 'file',
        contentType: 'text',
        content: '# Explorer v1\n\n- lazy tree\n- file preview\n- folder summary\n',
      },
    },
  },
  assets: {
    kind: 'directory',
    children: {
      'cover.png': {
        kind: 'file',
        contentType: 'image',
      },
    },
  },
}

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

function normalizeSegments(path: string) {
  return path.replace(/\\/g, '/').split('/').filter(Boolean)
}

function getNode(path: string): MockNode | null {
  if (!currentWorkspace || path === currentWorkspace) {
    return { kind: 'directory', children: mockTree }
  }

  const rootSegments = normalizeSegments(currentWorkspace)
  const targetSegments = normalizeSegments(path)
  const relativeSegments = targetSegments.slice(rootSegments.length)

  let node: MockNode = { kind: 'directory', children: mockTree }

  for (const segment of relativeSegments) {
    if (!node.children?.[segment]) {
      return null
    }
    node = node.children[segment]
  }

  return node
}

function joinPath(parent: string, name: string) {
  return `${parent.replace(/\/$/, '')}/${name}`
}

function createEntry(path: string, node: MockNode): WorkspaceEntry {
  const name = path.split('/').filter(Boolean).pop() ?? path
  return {
    path,
    name,
    kind: node.kind,
    extension: node.kind === 'file' && name.includes('.') ? name.split('.').pop() ?? null : null,
    size: node.kind === 'file' ? node.content?.length ?? null : null,
    modifiedAt: new Date().toISOString(),
    hasChildren: node.kind === 'directory' ? Object.keys(node.children ?? {}).length > 0 : false,
  }
}

function ensureDirectory(path: string): MockNode {
  const node = getNode(path)
  if (!node || node.kind !== 'directory') {
    throw new Error('目录不存在')
  }
  if (!node.children) {
    node.children = {}
  }
  return node
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
    return true
  },

  async listDirectory(path: string) {
    await randomDelay(40, 120)
    const node = ensureDirectory(path)
    return Object.entries(node.children ?? {})
      .map(([name, child]) => createEntry(joinPath(path, name), child))
      .sort((a, b) => {
        if (a.kind !== b.kind) {
          return a.kind === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
  },

  async readFile(path: string) {
    await randomDelay(30, 120)
    const node = getNode(path)
    if (!node || node.kind !== 'file') {
      throw new Error('文件不存在')
    }

    const name = path.split('/').filter(Boolean).pop() ?? path
    const extension = name.includes('.') ? name.split('.').pop() ?? null : null

    return {
      path,
      name,
      extension,
      contentType: node.contentType ?? 'unsupported',
      textContent: node.contentType === 'text' ? node.content ?? '' : undefined,
      imageSrc: undefined,
      size: node.content?.length ?? null,
      modifiedAt: new Date().toISOString(),
    }
  },

  async getFolderSummary(path: string) {
    await randomDelay(30, 120)
    const node = ensureDirectory(path)
    const children = Object.values(node.children ?? {})
    const folderCount = children.filter((child) => child.kind === 'directory').length
    const fileCount = children.filter((child) => child.kind === 'file').length
    return {
      path,
      name: path.split('/').filter(Boolean).pop() ?? path,
      itemCount: children.length,
      folderCount,
      fileCount,
    }
  },

  async createFile(input: CreateWorkspaceEntryInput) {
    await randomDelay(40, 120)
    const parent = ensureDirectory(input.parentPath)
    if (parent.children?.[input.name]) {
      throw new Error('同名文件已存在')
    }
    const node: MockNode = { kind: 'file', contentType: 'text', content: '' }
    parent.children = { ...(parent.children ?? {}), [input.name]: node }
    return createEntry(joinPath(input.parentPath, input.name), node)
  },

  async createFolder(input: CreateWorkspaceEntryInput) {
    await randomDelay(40, 120)
    const parent = ensureDirectory(input.parentPath)
    if (parent.children?.[input.name]) {
      throw new Error('同名文件夹已存在')
    }
    const node: MockNode = { kind: 'directory', children: {} }
    parent.children = { ...(parent.children ?? {}), [input.name]: node }
    return createEntry(joinPath(input.parentPath, input.name), node)
  },
}
