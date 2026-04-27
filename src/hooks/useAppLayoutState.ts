import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen, emit } from '@tauri-apps/api/event'
import type { AccountListItem } from '@/services/account'
import { DATA_BLOCK_CATALOG } from '@/config/data-blocks'
import { useTasksSidebarItems } from './useTasksSidebarItems'
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  INSTANCE_MOCKS,
  LEFT_WIDTH_STORAGE_KEY,
  MAX_LEFT_WIDTH,
  MAX_RIGHT_WIDTH,
  MIN_LEFT_WIDTH,
  MIN_RIGHT_WIDTH,
  RIGHT_PANEL_VISIBLE_STORAGE_KEY,
  RIGHT_WIDTH_STORAGE_KEY,
  SIDEBAR_ITEMS,
  SIDEBAR_SECTION_CONFIG,
  TAB_META,
  type OpenTab,
  type SidebarItem,
  type TabId,
  type View,
} from '@/config/layout'
import type { SidebarTreeItem } from '@/components/LeftSidebar'
import { useToast } from '@/contexts/ToastContext'
import { useBlockingOverlay } from '@/contexts/BlockingOverlayContext'
import { dataBlocksService, getManagedAccounts, getUnmanagedOnlineAccounts, workspaceService } from '@/services'
import { layoutService } from '@/services/layout'
import type { WorkspaceEntry, WorkspaceFileContent, WorkspaceFolderSummary, WorkspaceWatcherEvent } from '@/services/workspace'
import type { AppInstance } from '@/types/layout'

export type WorkspaceCreateKind = 'file' | 'folder'

export interface WorkspaceInlineCreateState {
  active: boolean
  kind: WorkspaceCreateKind | null
  parentPath: string | null
  value: string
  pending: boolean
  error: string | null
}

export interface WorkspaceRenameState {
  active: boolean
  path: string | null
  value: string
  pending: boolean
  error: string | null
}

export interface WorkspaceDeleteState {
  open: boolean
  path: string | null
  label: string
  pending: boolean
  error: string | null
}

export interface WorkspaceRecentMutation {
  path: string | null
  kind: 'create' | 'rename' | null
  timestamp: number | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getStoredNumber(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  const value = raw ? Number(raw) : NaN
  return Number.isFinite(value) ? value : fallback
}

function getStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  const raw = window.localStorage.getItem(key)
  if (raw === null) return fallback
  return raw === 'true'
}

function getEntryDescription(entry: WorkspaceEntry) {
  if (entry.kind === 'directory') {
    return '文件夹'
  }

  return entry.extension ? `${entry.extension.toUpperCase()} 文件` : '文件'
}

function getEntryIcon(entry: WorkspaceEntry): SidebarTreeItem['icon'] {
  if (entry.kind === 'directory') {
    return 'folder'
  }

  const extension = entry.extension?.toLowerCase()
  if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
    return 'image'
  }

  if (extension && ['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'scss', 'html', 'rs', 'toml', 'yml', 'yaml', 'txt'].includes(extension)) {
    return 'text'
  }

  return 'file'
}

function mapAccountToSidebarItem(account: AccountListItem, group: 'managed' | 'unmanaged'): SidebarItem {
  return {
    id: account.twitterId,
    label: account.displayName || `@${account.screenName}` || account.twitterId,
    description: account.instanceId || account.extensionName || account.twitterId,
    badge: group === 'managed'
      ? account.isOnline ? 'managed · online' : 'managed'
      : 'unmanaged · online',
    badgeTone: group === 'managed'
      ? account.isOnline ? 'success' : 'default'
      : 'warning',
    group,
    source: account.source,
  }
}

function buildAccountSidebarItems(managed: AccountListItem[], unmanaged: AccountListItem[]): SidebarItem[] {
  return [
    ...managed.map((account) => mapAccountToSidebarItem(account, 'managed')),
    ...unmanaged.map((account) => mapAccountToSidebarItem(account, 'unmanaged')),
  ]
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function getParentDirectoryPath(path: string, workspaceRoot: string | null) {
  if (!workspaceRoot) return null

  const normalizedPath = normalizePath(path)
  const normalizedRoot = normalizePath(workspaceRoot)

  if (normalizedPath === normalizedRoot) {
    return workspaceRoot
  }

  const index = normalizedPath.lastIndexOf('/')
  if (index <= 0) {
    return workspaceRoot
  }

  const parent = normalizedPath.slice(0, index)
  return parent || workspaceRoot
}

function collectWorkspaceEntries(tree: Record<string, WorkspaceEntry[]>) {
  return Object.values(tree).flat()
}

function collectWorkspacePaths(tree: Record<string, WorkspaceEntry[]>, workspaceRoot: string | null) {
  const allPaths = new Set<string>()
  const directoryPaths = new Set<string>()

  if (workspaceRoot) {
    allPaths.add(workspaceRoot)
    directoryPaths.add(workspaceRoot)
  }

  for (const entries of Object.values(tree)) {
    for (const entry of entries) {
      allPaths.add(entry.path)
      if (entry.kind === 'directory') {
        directoryPaths.add(entry.path)
      }
    }
  }

  return { allPaths, directoryPaths }
}

function findNearestExistingPath(path: string | null, validPaths: Set<string>, workspaceRoot: string | null) {
  if (!workspaceRoot) return null
  if (!path) return workspaceRoot
  if (validPaths.has(path)) return path

  let currentPath: string | null = path
  while (currentPath && currentPath !== workspaceRoot) {
    currentPath = getParentDirectoryPath(currentPath, workspaceRoot)
    if (currentPath && validPaths.has(currentPath)) {
      return currentPath
    }
  }

  return validPaths.has(workspaceRoot) ? workspaceRoot : null
}

function getWorkspaceCreateErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function validateWorkspaceEntryName(name: string) {
  const trimmedName = name.trim()

  if (!trimmedName) {
    return '名称不能为空'
  }

  if (trimmedName === '.' || trimmedName === '..') {
    return '名称不能为 . 或 ..'
  }

  if (/[\\/]/.test(trimmedName)) {
    return '名称不能包含 / 或 \\'
  }

  if (trimmedName.length > 255) {
    return '名称长度不能超过 255 个字符'
  }

  return null
}

export function useAppLayoutState() {
  const tasksSidebar = useTasksSidebarItems()
  const toast = useToast()
  const { block, unblock } = useBlockingOverlay()
  const [activeView, setActiveView] = useState<View>('workspace')
  const [leftWidth, setLeftWidth] = useState(() => getStoredNumber(LEFT_WIDTH_STORAGE_KEY, DEFAULT_LEFT_WIDTH))
  const [rightWidth, setRightWidth] = useState(() => getStoredNumber(RIGHT_WIDTH_STORAGE_KEY, DEFAULT_RIGHT_WIDTH))
  const [rightPanelVisible, setRightPanelVisible] = useState(() =>
    getStoredBoolean(RIGHT_PANEL_VISIBLE_STORAGE_KEY, true)
  )
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true)
  const [selectedItemsByView, setSelectedItemsByView] = useState<Record<View, string | null>>({
    workspace: null,
    accounts: null,
    'data-blocks': null,
    tasks: null,
  })
  const [centerMode, setCenterMode] = useState<'empty' | 'detail' | 'create-task'>('empty')
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settingsInitialSection, setSettingsInitialSection] = useState<'account' | 'preferences' | 'ai-providers'>('account')
  const [dataBlockMenuOpen, setDataBlockMenuOpen] = useState(false)
  const [instances, setInstances] = useState<AppInstance[]>(INSTANCE_MOCKS)
  const [instancesError, setInstancesError] = useState<string | null>(null)
  const [accountItems, setAccountItems] = useState<SidebarItem[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [managedAccounts, setManagedAccounts] = useState<AccountListItem[]>([])
  const [unmanagedAccounts, setUnmanagedAccounts] = useState<AccountListItem[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    {
      id: 'workspace',
      title: TAB_META.workspace.title,
      icon: TAB_META.workspace.icon,
    },
  ])
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null)
  const [workspaceRootName, setWorkspaceRootName] = useState('Workspace')
  const [workspaceTree, setWorkspaceTree] = useState<Record<string, WorkspaceEntry[]>>({})
  const [expandedWorkspacePaths, setExpandedWorkspacePaths] = useState<Record<string, boolean>>({})
  const [workspaceLoadingPaths, setWorkspaceLoadingPaths] = useState<Record<string, boolean>>({})
  const [workspaceInlineCreate, setWorkspaceInlineCreate] = useState<WorkspaceInlineCreateState>({
    active: false,
    kind: null,
    parentPath: null,
    value: '',
    pending: false,
    error: null,
  })
  const [workspaceRenameState, setWorkspaceRenameState] = useState<WorkspaceRenameState>({
    active: false,
    path: null,
    value: '',
    pending: false,
    error: null,
  })
  const [workspaceDeleteState, setWorkspaceDeleteState] = useState<WorkspaceDeleteState>({
    open: false,
    path: null,
    label: '',
    pending: false,
    error: null,
  })
  const [workspaceRecentMutation, setWorkspaceRecentMutation] = useState<WorkspaceRecentMutation>({
    path: null,
    kind: null,
    timestamp: null,
  })
  const [workspaceRefreshPending, setWorkspaceRefreshPending] = useState(false)
  const [workspaceRefreshError, setWorkspaceRefreshError] = useState<string | null>(null)
  const workspaceRefreshInFlightRef = useRef(false)
  const workspaceRefreshQueuedRef = useRef(false)
  const workspaceFsRefreshTimerRef = useRef<number | null>(null)
  const [workspaceFileContent, setWorkspaceFileContent] = useState<WorkspaceFileContent | null>(null)
  const [workspaceFolderSummary, setWorkspaceFolderSummary] = useState<WorkspaceFolderSummary | null>(null)
  const [workspaceDetailLoading, setWorkspaceDetailLoading] = useState(false)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)

  const currentSidebarItems = useMemo(() => {
    if (activeView === 'tasks') {
      return tasksSidebar.items
    }
    if (activeView === 'workspace') {
      return []
    }
    if (activeView === 'accounts') {
      return accountItems
    }
    return SIDEBAR_ITEMS[activeView]
  }, [activeView, tasksSidebar.items, accountItems])

  const workspaceEntries = useMemo(() => collectWorkspaceEntries(workspaceTree), [workspaceTree])

  const workspaceEntryByPath = useMemo(() => {
    return new Map(workspaceEntries.map((entry) => [entry.path, entry]))
  }, [workspaceEntries])

  const currentSidebarSection = useMemo(() => {
    if (activeView === 'tasks' && tasksSidebar.error) {
      return {
        ...SIDEBAR_SECTION_CONFIG.tasks,
        description: `任务列表加载失败：${tasksSidebar.error}`,
      }
    }
    if (activeView === 'tasks' && tasksSidebar.loading) {
      return {
        ...SIDEBAR_SECTION_CONFIG.tasks,
        description: '正在加载真实任务列表...'
      }
    }
    if (activeView === 'accounts' && accountsLoading) {
      return {
        ...SIDEBAR_SECTION_CONFIG.accounts,
        description: '正在加载账号列表...'
      }
    }
    if (activeView === 'workspace' && workspaceRootName) {
      return {
        ...SIDEBAR_SECTION_CONFIG.workspace,
        description: `浏览 ${workspaceRootName} 工作区目录并在中间预览内容。`,
      }
    }
    return SIDEBAR_SECTION_CONFIG[activeView]
  }, [activeView, tasksSidebar.error, tasksSidebar.loading, accountsLoading, workspaceRootName])

  const selectedSidebarItemId = selectedItemsByView[activeView]

  const selectedSidebarItem = useMemo<SidebarItem | null>(() => {
    if (activeView === 'workspace') {
      if (!selectedSidebarItemId || !workspaceRoot) return null
      if (selectedSidebarItemId === workspaceRoot) {
        return {
          id: workspaceRoot,
          label: workspaceRootName,
          description: '当前工作区根目录',
        }
      }

      const match = workspaceEntryByPath.get(selectedSidebarItemId)
      if (match) {
        return {
          id: match.path,
          label: match.name,
          description: getEntryDescription(match),
        }
      }

      return null
    }

    return currentSidebarItems.find((item) => item.id === selectedSidebarItemId) ?? null
  }, [activeView, currentSidebarItems, selectedSidebarItemId, workspaceEntryByPath, workspaceRoot, workspaceRootName])

  const resetWorkspaceViewState = useCallback((nextWorkspace: string | null) => {
    const nextWorkspaceName = nextWorkspace
      ? nextWorkspace.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? nextWorkspace
      : 'Workspace'

    setWorkspaceRoot(nextWorkspace)
    setWorkspaceRootName(nextWorkspaceName)
    setWorkspaceTree({})
    setExpandedWorkspacePaths(nextWorkspace ? { [nextWorkspace]: true } : {})
    setWorkspaceLoadingPaths({})
    setSelectedItemsByView((prev) => ({
      ...prev,
      workspace: nextWorkspace,
    }))
    setWorkspaceFileContent(null)
    setWorkspaceFolderSummary(null)
    setWorkspaceDetailLoading(false)
    setWorkspaceError(null)
    setWorkspaceRefreshPending(false)
    setWorkspaceRefreshError(null)
    setWorkspaceInlineCreate({
      active: false,
      kind: null,
      parentPath: null,
      value: '',
      pending: false,
      error: null,
    })
    setWorkspaceRenameState({
      active: false,
      path: null,
      value: '',
      pending: false,
      error: null,
    })
    setWorkspaceDeleteState({
      open: false,
      path: null,
      label: '',
      pending: false,
      error: null,
    })
    setCenterMode((prev) => {
      if (activeView !== 'workspace') {
        return prev
      }

      return nextWorkspace ? 'detail' : 'empty'
    })
  }, [activeView])

  const loadWorkspaceRoot = useCallback(async (nextWorkspaceOverride?: string | null) => {
    const currentWorkspace = nextWorkspaceOverride ?? await workspaceService.getCurrentWorkspace()

    if (!currentWorkspace) {
      resetWorkspaceViewState(null)
      return
    }

    resetWorkspaceViewState(currentWorkspace)
    const entries = await workspaceService.listDirectory(currentWorkspace)

    setWorkspaceTree({ [currentWorkspace]: entries })
    setSelectedItemsByView((prev) => ({
      ...prev,
      workspace: currentWorkspace,
    }))
    setWorkspaceError(null)
  }, [resetWorkspaceViewState])

  const reloadAccounts = async () => {
    setAccountsLoading(true)
    try {
      const [managed, unmanaged] = await Promise.all([
        getManagedAccounts(),
        getUnmanagedOnlineAccounts(),
      ])

      setManagedAccounts(managed)
      setUnmanagedAccounts(unmanaged)
      setAccountItems(buildAccountSidebarItems(managed, unmanaged))
      console.log('[accounts] reloadAccounts', {
        managed: managed.length,
        unmanaged: unmanaged.length,
      })
    } finally {
      setAccountsLoading(false)
    }
  }

  const workspaceTreeItems = useMemo<SidebarTreeItem[]>(() => {
    if (!workspaceRoot) return []

    const items: SidebarTreeItem[] = []

    const walk = (parentPath: string, depth: number) => {
      const children = workspaceTree[parentPath] ?? []
      for (const child of children) {
        items.push({
          id: child.path,
          label: child.name,
          description: getEntryDescription(child),
          depth,
          kind: child.kind,
          expanded: child.kind === 'directory' ? expandedWorkspacePaths[child.path] ?? false : false,
          isBranch: child.kind === 'directory' ? (child.hasChildren ?? false) || Boolean(workspaceTree[child.path]?.length) : false,
          icon: getEntryIcon(child),
        })

        if (child.kind === 'directory' && expandedWorkspacePaths[child.path]) {
          walk(child.path, depth + 1)
        }
      }
    }

    walk(workspaceRoot, 0)
    return items
  }, [expandedWorkspacePaths, workspaceRoot, workspaceTree])

  const loadWorkspaceChildren = async (path: string, force = false) => {
    if (!force && workspaceTree[path]) {
      return workspaceTree[path]
    }

    setWorkspaceLoadingPaths((prev) => ({ ...prev, [path]: true }))
    try {
      const entries = await workspaceService.listDirectory(path)
      setWorkspaceTree((prev) => ({ ...prev, [path]: entries }))
      setWorkspaceError(null)
      return entries
    } catch (error) {
      const message = error instanceof Error ? error.message : '工作区目录加载失败'
      setWorkspaceError(message)
      throw error
    } finally {
      setWorkspaceLoadingPaths((prev) => ({ ...prev, [path]: false }))
    }
  }

  const refreshWorkspaceTree = async (options?: { preserveSelectionPath?: string | null }) => {
    if (!workspaceRoot) return null

    const previousExpandedPaths = Object.entries(expandedWorkspacePaths)
      .filter(([, expanded]) => expanded)
      .map(([path]) => path)
    const previousSelectedPath = options?.preserveSelectionPath ?? selectedItemsByView.workspace ?? workspaceRoot

    setWorkspaceRefreshPending(true)
    setWorkspaceRefreshError(null)

    try {
      const nextTree: Record<string, WorkspaceEntry[]> = {}
      const visited = new Set<string>()
      const queue = [workspaceRoot]

      while (queue.length > 0) {
        const currentPath = queue.shift()
        if (!currentPath || visited.has(currentPath)) continue
        visited.add(currentPath)

        const entries = await workspaceService.listDirectory(currentPath)
        nextTree[currentPath] = entries

        for (const entry of entries) {
          if (entry.kind === 'directory') {
            queue.push(entry.path)
          }
        }
      }

      const { allPaths, directoryPaths } = collectWorkspacePaths(nextTree, workspaceRoot)
      const nextExpandedPaths = previousExpandedPaths.reduce<Record<string, boolean>>((acc, path) => {
        if (directoryPaths.has(path)) {
          acc[path] = true
        }
        return acc
      }, { [workspaceRoot]: true })
      const nextSelectedPath = findNearestExistingPath(previousSelectedPath, allPaths, workspaceRoot)

      setWorkspaceTree(nextTree)
      setExpandedWorkspacePaths(nextExpandedPaths)
      setSelectedItemsByView((prev) => ({
        ...prev,
        workspace: nextSelectedPath,
      }))
      setWorkspaceError(null)
      setWorkspaceRefreshError(null)

      if (nextSelectedPath) {
        setCenterMode('detail')
      }

      return nextTree
    } catch (error) {
      const message = getWorkspaceCreateErrorMessage(error, '刷新失败')
      setWorkspaceRefreshError(message)
      throw error
    } finally {
      setWorkspaceRefreshPending(false)
    }
  }

  const runWorkspaceRefresh = useCallback(async (options?: { preserveSelectionPath?: string | null }) => {
    if (workspaceRefreshInFlightRef.current) {
      workspaceRefreshQueuedRef.current = true
      return null
    }

    workspaceRefreshInFlightRef.current = true

    try {
      let result = await refreshWorkspaceTree(options)

      while (workspaceRefreshQueuedRef.current) {
        workspaceRefreshQueuedRef.current = false
        result = await refreshWorkspaceTree(options)
      }

      return result
    } finally {
      workspaceRefreshInFlightRef.current = false
    }
  }, [expandedWorkspacePaths, selectedItemsByView.workspace, workspaceRoot])

  const resolveWorkspaceCreateParentPath = () => {
    const selectedPath = selectedItemsByView.workspace
    if (!selectedPath) return workspaceRoot
    if (selectedPath === workspaceRoot) return workspaceRoot

    const selectedEntry = workspaceEntryByPath.get(selectedPath)
    if (selectedEntry?.kind === 'directory') {
      return selectedEntry.path
    }

    return getParentDirectoryPath(selectedPath, workspaceRoot)
  }

  const resetWorkspaceInlineCreate = () => {
    setWorkspaceInlineCreate({
      active: false,
      kind: null,
      parentPath: null,
      value: '',
      pending: false,
      error: null,
    })
  }

  const resetWorkspaceRenameState = () => {
    setWorkspaceRenameState({
      active: false,
      path: null,
      value: '',
      pending: false,
      error: null,
    })
  }

  const closeWorkspaceDeleteDialog = (force = false) => {
    setWorkspaceDeleteState((prev) => {
      if (prev.pending && !force) return prev
      return {
        open: false,
        path: null,
        label: '',
        pending: false,
        error: null,
      }
    })
  }

  const startWorkspaceRename = () => {
    const selectedPath = selectedItemsByView.workspace
    if (!selectedPath || selectedPath === workspaceRoot) {
      toast.error('请选择要重命名的文件或文件夹')
      return
    }

    const selectedEntry = workspaceEntryByPath.get(selectedPath)
    if (!selectedEntry) {
      toast.error('当前节点不存在，无法重命名')
      return
    }

    setWorkspaceRenameState({
      active: true,
      path: selectedEntry.path,
      value: selectedEntry.name,
      pending: false,
      error: null,
    })
    setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => (prev.pending ? prev : {
      active: false,
      kind: null,
      parentPath: null,
      value: '',
      pending: false,
      error: null,
    }))
  }

  const updateWorkspaceRenameValue = (value: string) => {
    setWorkspaceRenameState((prev: WorkspaceRenameState) => ({
      ...prev,
      value,
      error: prev.error ? null : prev.error,
    }))
  }

  const cancelWorkspaceRename = () => {
    setWorkspaceRenameState((prev: WorkspaceRenameState) => {
      if (prev.pending) return prev
      return {
        active: false,
        path: null,
        value: '',
        pending: false,
        error: null,
      }
    })
  }

  const submitWorkspaceRename = async () => {
    if (!workspaceRenameState.active || !workspaceRenameState.path || workspaceRenameState.pending) {
      return
    }

    const validationError = validateWorkspaceEntryName(workspaceRenameState.value)
    if (validationError) {
      setWorkspaceRenameState((prev: WorkspaceRenameState) => ({ ...prev, error: validationError }))
      return
    }

    const nextName = workspaceRenameState.value.trim()
    const currentEntry = workspaceEntryByPath.get(workspaceRenameState.path)
    if (!currentEntry) {
      setWorkspaceRenameState((prev: WorkspaceRenameState) => ({ ...prev, error: '当前节点不存在，无法重命名' }))
      return
    }

    if (currentEntry.name === nextName) {
      resetWorkspaceRenameState()
      return
    }

    const parentPath = getParentDirectoryPath(workspaceRenameState.path, workspaceRoot)
    const siblingEntries = parentPath ? (workspaceTree[parentPath] ?? []) : []
    if (siblingEntries.some((entry) => entry.path !== workspaceRenameState.path && entry.name === nextName)) {
      setWorkspaceRenameState((prev: WorkspaceRenameState) => ({ ...prev, error: '当前目录下已存在同名项目' }))
      return
    }

    setWorkspaceRenameState((prev: WorkspaceRenameState) => ({ ...prev, pending: true, error: null, value: nextName }))

    try {
      const renamed = await workspaceService.renameEntry({
        path: workspaceRenameState.path,
        newName: nextName,
      })
      await runWorkspaceRefresh({ preserveSelectionPath: renamed.path })
      setWorkspaceRecentMutation({ path: renamed.path, kind: 'rename', timestamp: Date.now() })
      resetWorkspaceRenameState()
      toast.success('重命名成功')
    } catch (error) {
      const message = getWorkspaceCreateErrorMessage(error, '重命名失败')
      setWorkspaceRenameState((prev: WorkspaceRenameState) => ({ ...prev, pending: false, error: message }))
    }
  }

  const startWorkspaceDelete = () => {
    const selectedPath = selectedItemsByView.workspace
    if (!selectedPath || selectedPath === workspaceRoot) {
      toast.error('请选择要删除的文件或文件夹')
      return
    }

    const selectedEntry = workspaceEntryByPath.get(selectedPath)
    if (!selectedEntry) {
      toast.error('当前节点不存在，无法删除')
      return
    }

    setWorkspaceDeleteState({
      open: true,
      path: selectedEntry.path,
      label: selectedEntry.name,
      pending: false,
      error: null,
    })
  }

  const confirmWorkspaceDelete = async () => {
    if (!workspaceDeleteState.open || !workspaceDeleteState.path || workspaceDeleteState.pending) {
      return
    }

    const fallbackPath = getParentDirectoryPath(workspaceDeleteState.path, workspaceRoot) ?? workspaceRoot
    setWorkspaceDeleteState((prev: WorkspaceDeleteState) => ({ ...prev, pending: true, error: null }))
    block('正在删除...')

    try {
      await workspaceService.deleteEntry(workspaceDeleteState.path)
      await runWorkspaceRefresh({ preserveSelectionPath: fallbackPath })
      closeWorkspaceDeleteDialog(true)
      toast.success('删除成功')
    } catch (error) {
      const message = getWorkspaceCreateErrorMessage(error, '删除失败')
      setWorkspaceDeleteState((prev: WorkspaceDeleteState) => ({ ...prev, pending: false, error: message }))
    } finally {
      unblock()
    }
  }

  const startWorkspaceInlineCreate = (kind: WorkspaceCreateKind) => {
    const parentPath = resolveWorkspaceCreateParentPath()
    if (!parentPath) {
      toast.error('当前没有可用的工作区目录')
      return
    }

    resetWorkspaceRenameState()
    setExpandedWorkspacePaths((prev) => ({ ...prev, [parentPath]: true }))
    setWorkspaceInlineCreate({
      active: true,
      kind,
      parentPath,
      value: '',
      pending: false,
      error: null,
    })
    setWorkspaceRefreshError(null)
  }

  const updateWorkspaceInlineCreateValue = (value: string) => {
    setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => ({
      ...prev,
      value,
      error: prev.error ? null : prev.error,
    }))
  }

  const cancelWorkspaceInlineCreate = () => {
    setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => {
      if (prev.pending) return prev
      return {
        active: false,
        kind: null,
        parentPath: null,
        value: '',
        pending: false,
        error: null,
      }
    })
  }

  const submitWorkspaceInlineCreate = async () => {
    if (!workspaceInlineCreate.active || !workspaceInlineCreate.kind || !workspaceInlineCreate.parentPath || workspaceInlineCreate.pending) {
      return
    }

    const validationError = validateWorkspaceEntryName(workspaceInlineCreate.value)
    if (validationError) {
      setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => ({ ...prev, error: validationError }))
      return
    }

    const siblingEntries = workspaceTree[workspaceInlineCreate.parentPath] ?? []
    const nextName = workspaceInlineCreate.value.trim()
    if (siblingEntries.some((entry) => entry.name === nextName)) {
      setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => ({ ...prev, error: '当前目录下已存在同名项目' }))
      return
    }

    setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => ({ ...prev, pending: true, error: null, value: nextName }))

    try {
      const created = workspaceInlineCreate.kind === 'file'
        ? await workspaceService.createFile({ parentPath: workspaceInlineCreate.parentPath, name: nextName })
        : await workspaceService.createFolder({ parentPath: workspaceInlineCreate.parentPath, name: nextName })

      await runWorkspaceRefresh({ preserveSelectionPath: created.path })
      setWorkspaceRecentMutation({ path: created.path, kind: 'create', timestamp: Date.now() })
      resetWorkspaceInlineCreate()
      toast.success(workspaceInlineCreate.kind === 'file' ? '文件已创建' : '文件夹已创建')
    } catch (error) {
      const message = getWorkspaceCreateErrorMessage(error, workspaceInlineCreate.kind === 'file' ? '创建文件失败' : '创建文件夹失败')
      setWorkspaceInlineCreate((prev: WorkspaceInlineCreateState) => ({ ...prev, pending: false, error: message }))
    }
  }

  useEffect(() => {
    if (!workspaceInlineCreate.active || workspaceInlineCreate.pending) {
      return
    }

    const parentPath = workspaceInlineCreate.parentPath
    if (!parentPath || parentPath === workspaceRoot) {
      return
    }

    const parentExists = workspaceEntryByPath.get(parentPath)
    if (parentExists?.kind === 'directory') {
      return
    }

    cancelWorkspaceInlineCreate()
  }, [cancelWorkspaceInlineCreate, workspaceEntryByPath, workspaceInlineCreate, workspaceRoot])

  useEffect(() => {
    if (!workspaceRenameState.active || workspaceRenameState.pending || !workspaceRenameState.path) {
      return
    }

    const currentEntry = workspaceEntryByPath.get(workspaceRenameState.path)
    if (currentEntry) {
      return
    }

    cancelWorkspaceRename()
  }, [cancelWorkspaceRename, workspaceEntryByPath, workspaceRenameState])

  useEffect(() => {
    let cancelled = false

    const syncWorkspaceRoot = async () => {
      try {
        await loadWorkspaceRoot()
      } catch (error) {
        if (cancelled) return
        setWorkspaceError(error instanceof Error ? error.message : '工作区加载失败')
      }
    }

    void syncWorkspaceRoot()

    return () => {
      cancelled = true
    }
  }, [loadWorkspaceRoot])

  useEffect(() => {
    let disposed = false
    let unlisten: null | (() => void) = null

    const bindWorkspaceChanged = async () => {
      try {
        const cleanup = await listen<string>('workspace-changed', async (event) => {
          try {
            await loadWorkspaceRoot(event.payload)
          } catch (error) {
            setWorkspaceError(error instanceof Error ? error.message : '工作区加载失败')
          }
        })

        if (disposed) {
          cleanup()
          return
        }

        unlisten = cleanup
      } catch (error) {
        console.debug('[useAppLayoutState] Failed to register workspace listener', error)
      }
    }

    void bindWorkspaceChanged()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [loadWorkspaceRoot])

  useEffect(() => {
    if (!workspaceRoot) {
      return
    }

    let disposed = false

    const syncWatcher = async () => {
      try {
        await workspaceService.stopWorkspaceWatcher()
        await workspaceService.startWorkspaceWatcher(workspaceRoot)
      } catch (error) {
        if (!disposed) {
          console.debug('[workspace_watcher/client] Failed to sync workspace watcher', error)
        }
      }
    }

    void syncWatcher()

    return () => {
      disposed = true
      if (workspaceFsRefreshTimerRef.current !== null) {
        window.clearTimeout(workspaceFsRefreshTimerRef.current)
        workspaceFsRefreshTimerRef.current = null
      }
      void workspaceService.stopWorkspaceWatcher().catch((error) => {
        console.debug('[workspace_watcher/client] Failed to stop workspace watcher', error)
      })
    }
  }, [workspaceRoot])

  useEffect(() => {
    let disposed = false
    let unlisten: null | (() => void) = null

    const bindWorkspaceFsChanged = async () => {
      try {
        const cleanup = await listen<WorkspaceWatcherEvent>('workspace-fs-changed', (event) => {
          if (!workspaceRoot || event.payload.workspacePath !== workspaceRoot) {
            return
          }

          if (workspaceFsRefreshTimerRef.current !== null) {
            window.clearTimeout(workspaceFsRefreshTimerRef.current)
          }

          workspaceFsRefreshTimerRef.current = window.setTimeout(() => {
            workspaceFsRefreshTimerRef.current = null
            void runWorkspaceRefresh().catch((error) => {
              setWorkspaceError(error instanceof Error ? error.message : '工作区加载失败')
            })
          }, 200)
        })

        if (disposed) {
          cleanup()
          return
        }

        unlisten = cleanup
      } catch (error) {
        console.debug('[workspace_watcher/client] Failed to register workspace fs listener', error)
      }
    }

    void bindWorkspaceFsChanged()

    return () => {
      disposed = true
      unlisten?.()
      if (workspaceFsRefreshTimerRef.current !== null) {
        window.clearTimeout(workspaceFsRefreshTimerRef.current)
        workspaceFsRefreshTimerRef.current = null
      }
    }
  }, [runWorkspaceRefresh, workspaceRoot])

  useEffect(() => {
    let cancelled = false

    const loadInstances = async () => {
      try {
        const result = await layoutService.getInstances()
        if (cancelled) return

        if (result.length > 0) {
          setInstances(result)
        }
        setInstancesError(null)
      } catch (error) {
        if (cancelled) return
        setInstancesError(error instanceof Error ? error.message : '实例状态获取失败')
      }
    }

    void loadInstances()
    const interval = window.setInterval(loadInstances, 60000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (activeView !== 'accounts') {
      return
    }

    void reloadAccounts().catch((error) => {
      console.error('[accounts] active view reload failed', error)
    })
  }, [activeView])

  useEffect(() => {
    let cancelled = false

    const loadAccounts = async () => {
      setAccountsLoading(true)
      try {
        const [managed, unmanaged] = await Promise.all([
          getManagedAccounts(),
          getUnmanagedOnlineAccounts(),
        ])
        if (cancelled) return

        setManagedAccounts(managed)
        setUnmanagedAccounts(unmanaged)
        setAccountItems(buildAccountSidebarItems(managed, unmanaged))
        console.log('[accounts] initial load', {
          managed: managed.length,
          unmanaged: unmanaged.length,
        })
      } catch {
        if (cancelled) return
        setManagedAccounts([])
        setUnmanagedAccounts([])
        setAccountItems([])
      } finally {
        if (!cancelled) {
          setAccountsLoading(false)
        }
      }
    }

    void loadAccounts()
    const followUpTimeout = window.setTimeout(() => {
      void reloadAccounts().catch((error) => {
        console.error('[accounts] follow-up reload failed', error)
      })
    }, 3000)
    const interval = window.setInterval(() => {
      void reloadAccounts().catch(() => {})
    }, 60000)

    return () => {
      cancelled = true
      window.clearTimeout(followUpTimeout)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    let disposed = false
    let unlisten: null | (() => void) = null

    const bind = async () => {
      const fn = await listen('accounts-changed', () => {
        void reloadAccounts().catch(() => {})
      })

      if (disposed) {
        fn()
        return
      }

      unlisten = fn
    }

    void bind()

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    const syncResponsiveLayout = () => {
      const compact = window.innerWidth < 1180
      setIsCompactLayout(compact)

      if (compact) {
        setRightPanelVisible(false)
      } else {
        setMobileSidebarOpen(false)
      }
    }

    syncResponsiveLayout()
    window.addEventListener('resize', syncResponsiveLayout)

    return () => window.removeEventListener('resize', syncResponsiveLayout)
  }, [])

  useEffect(() => {
    if (centerMode === 'create-task') {
      return
    }

    if (activeView === 'workspace') {
      if (!workspaceRoot) {
        setCenterMode('empty')
        return
      }

      if (selectedItemsByView.workspace) {
        return
      }

      setSelectedItemsByView((prev) => ({
        ...prev,
        workspace: workspaceRoot,
      }))
      setCenterMode('detail')
      return
    }

    if (currentSidebarItems.length === 0) {
      setCenterMode('empty')
      return
    }

    if (selectedItemsByView[activeView]) {
      return
    }

    setSelectedItemsByView((prev) => ({
      ...prev,
      [activeView]: currentSidebarItems[0]?.id ?? null,
    }))

    if (activeView !== 'tasks') {
      setCenterMode('detail')
    }
  }, [activeView, centerMode, currentSidebarItems, selectedItemsByView, workspaceRoot])

  useEffect(() => {
    let cancelled = false

    const loadWorkspaceDetail = async () => {
      if (activeView !== 'workspace' || !selectedSidebarItemId) {
        return
      }

      setWorkspaceDetailLoading(true)
      setWorkspaceFileContent(null)
      setWorkspaceFolderSummary(null)

      try {
        if (selectedSidebarItemId === workspaceRoot) {
          const summary = await workspaceService.getFolderSummary(selectedSidebarItemId)
          if (cancelled) return
          setWorkspaceFolderSummary(summary)
          setWorkspaceError(null)
          return
        }

        const selectedEntry = Object.values(workspaceTree)
          .flat()
          .find((entry) => entry.path === selectedSidebarItemId)

        if (!selectedEntry || selectedEntry.kind === 'directory') {
          const summary = await workspaceService.getFolderSummary(selectedSidebarItemId)
          if (cancelled) return
          setWorkspaceFolderSummary(summary)
          setWorkspaceError(null)
          return
        }

        const file = await workspaceService.readFile(selectedSidebarItemId)
        if (cancelled) return
        setWorkspaceFileContent(file)
        setWorkspaceError(null)
      } catch (error) {
        if (cancelled) return
        setWorkspaceError(error instanceof Error ? error.message : '工作区详情加载失败')
      } finally {
        if (!cancelled) {
          setWorkspaceDetailLoading(false)
        }
      }
    }

    void loadWorkspaceDetail()

    return () => {
      cancelled = true
    }
  }, [activeView, selectedSidebarItemId, workspaceRoot, workspaceTree])

  const clearAccountsSelection = () => {
    setSelectedItemsByView((prev) => ({
      ...prev,
      accounts: null,
    }))
    if (activeView === 'accounts') {
      setCenterMode('empty')
    }
  }

  const persistLeftWidth = (nextWidth: number) => {
    const width = clamp(nextWidth, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH)
    setLeftWidth(width)
    window.localStorage.setItem(LEFT_WIDTH_STORAGE_KEY, String(width))
  }

  const persistRightWidth = (nextWidth: number) => {
    const width = clamp(nextWidth, MIN_RIGHT_WIDTH, MAX_RIGHT_WIDTH)
    setRightWidth(width)
    window.localStorage.setItem(RIGHT_WIDTH_STORAGE_KEY, String(width))
  }

  const persistRightPanelVisible = (visible: boolean) => {
    setRightPanelVisible(visible)
    window.localStorage.setItem(RIGHT_PANEL_VISIBLE_STORAGE_KEY, String(visible))
  }

  const openTab = (view: View) => {
    const meta = TAB_META[view]
    setOpenTabs((prev) => {
      if (prev.some((tab) => tab.id === view)) return prev
      return [...prev, { id: view, title: meta.title, icon: meta.icon }]
    })
  }

  const handleViewChange = (view: View) => {
    setActiveView(view)
    setMobileSidebarOpen(false)
    openTab(view)

    const nextSelectedId = view === 'workspace'
      ? selectedItemsByView.workspace ?? workspaceRoot
      : selectedItemsByView[view] ?? SIDEBAR_ITEMS[view][0]?.id ?? null

    if (nextSelectedId && !selectedItemsByView[view]) {
      setSelectedItemsByView((prev) => ({ ...prev, [view]: nextSelectedId }))
    }

    setCenterMode(nextSelectedId ? 'detail' : 'empty')
  }

  const handleSelectSidebarItem = (itemId: string) => {
    setSelectedItemsByView((prev) => ({
      ...prev,
      [activeView]: itemId,
    }))
    setCenterMode('detail')
    setMobileSidebarOpen(false)
    openTab(activeView)
  }

  const handleToggleWorkspaceItem = async (itemId: string) => {
    if (!workspaceRoot) return

    const isExpanded = expandedWorkspacePaths[itemId] ?? false
    if (isExpanded) {
      setExpandedWorkspacePaths((prev) => ({ ...prev, [itemId]: false }))
      return
    }

    try {
      await loadWorkspaceChildren(itemId)
      setExpandedWorkspacePaths((prev) => ({ ...prev, [itemId]: true }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '展开文件夹失败')
    }
  }

  const handleWorkspaceCreate = async (kind: 'file' | 'folder') => {
    startWorkspaceInlineCreate(kind)
  }

  const handleSidebarAction = async (actionId: string) => {
    if (actionId === 'create-task') {
      setActiveView('tasks')
      openTab('tasks')
      setCenterMode('create-task')
      setMobileSidebarOpen(false)
      return
    }

    if (actionId === 'add-data-block') {
      setDataBlockMenuOpen(true)
      setMobileSidebarOpen(false)
      return
    }

    if (actionId === 'new-file') {
      await handleWorkspaceCreate('file')
      return
    }

    if (actionId === 'new-folder') {
      await handleWorkspaceCreate('folder')
      return
    }

    if (actionId === 'refresh-workspace') {
      if (workspaceRoot) {
        try {
          await runWorkspaceRefresh()
          toast.success('工作区已刷新')
        } catch (error) {
          toast.error(getWorkspaceCreateErrorMessage(error, '刷新失败'))
        }
      }
      return
    }

    if (actionId === 'rename-workspace-entry') {
      startWorkspaceRename()
      return
    }

    if (actionId === 'delete-workspace-entry') {
      startWorkspaceDelete()
      return
    }

    if (actionId === 'refresh-accounts') {
      setAccountsLoading(true)
      try {
        await reloadAccounts()
        toast.success('账号列表已刷新')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '账号列表刷新失败')
      }
      setCenterMode(selectedItemsByView[activeView] ? 'detail' : 'empty')
      return
    }

    setCenterMode(activeView === 'tasks' ? 'create-task' : selectedItemsByView[activeView] ? 'detail' : 'empty')
  }

  const closeDataBlockMenu = () => {
    setDataBlockMenuOpen(false)
  }

  const handleAddDataBlock = async (cardType: (typeof DATA_BLOCK_CATALOG)[number]['id']) => {
    try {
      await dataBlocksService.addCard(cardType, {})
    } catch (error) {
      console.error('Failed to add data block:', error)
    }

    setSelectedItemsByView((prev) => ({
      ...prev,
      'data-blocks': cardType,
    }))
    setActiveView('data-blocks')
    openTab('data-blocks')
    setCenterMode('detail')
    setDataBlockMenuOpen(false)
  }

  const handleCloseTab = (tabId: TabId) => {
    if (tabId === 'workspace' && openTabs.length === 1) return

    setOpenTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId)
      const fallbackTab = nextTabs[nextTabs.length - 1]?.id ?? 'workspace'

      if (activeView === tabId) {
        setActiveView(fallbackTab as View)
        const fallbackSelectedId = fallbackTab === 'workspace'
          ? selectedItemsByView.workspace ?? workspaceRoot
          : selectedItemsByView[fallbackTab as View] ?? SIDEBAR_ITEMS[fallbackTab as View]?.[0]?.id ?? null
        setCenterMode(fallbackSelectedId ? 'detail' : 'empty')
      }

      return nextTabs.length > 0 ? nextTabs : [prev[0]]
    })
  }

  const handleActivateTab = (tabId: TabId) => {
    setActiveView(tabId as View)
    const nextSelectedId = tabId === 'workspace'
      ? selectedItemsByView.workspace ?? workspaceRoot
      : (selectedItemsByView[tabId as View] ?? (SIDEBAR_ITEMS[tabId as View] as SidebarItem[])[0]?.id ?? null)
    if (nextSelectedId && !selectedItemsByView[tabId as View]) {
      setSelectedItemsByView((prev) => ({ ...prev, [tabId]: nextSelectedId }))
    }
    setCenterMode(nextSelectedId ? 'detail' : 'empty')
  }

  const handleTaskCreated = async (taskId?: string) => {
    await tasksSidebar.reload()

    if (taskId) {
      setSelectedItemsByView((prev) => ({
        ...prev,
        tasks: taskId,
      }))
      setActiveView('tasks')
      setCenterMode('detail')
      setOpenTabs((prev) => {
        if (prev.some((tab) => tab.id === 'tasks')) return prev
        return [...prev, { id: 'tasks', title: TAB_META.tasks.title, icon: TAB_META.tasks.icon }]
      })
      return
    }

    setActiveView('tasks')
    setCenterMode('detail')
  }

  const handleTaskDeleted = async () => {
    await tasksSidebar.reload()
    setSelectedItemsByView((prev) => ({
      ...prev,
      tasks: null,
    }))
    setCenterMode('empty')
  }

  const openSettingsDialog = (section?: 'account' | 'preferences' | 'ai-providers') => {
    setSettingsInitialSection(section || 'account')
    setSettingsDialogOpen(true)
  }

  const closeSettingsDialog = () => {
    setSettingsDialogOpen(false)
    setSettingsInitialSection('account')
  }

  const toggleLeftSidebarVisible = () => {
    setLeftSidebarVisible((prev) => !prev)
  }

  const toggleRightPanelVisible = () => {
    const nextVisible = !rightPanelVisible
    persistRightPanelVisible(nextVisible)

    if (nextVisible) {
      void emit('tweetpilot-ai-panel-reopened')
    }
  }

  return {
    activeView,
    centerMode,
    currentSidebarItems,
    currentSidebarSection,
    dataBlockMenuOpen,
    handleActivateTab,
    handleAddDataBlock,
    handleCloseTab,
    handleSelectSidebarItem,
    handleSidebarAction,
    handleTaskCreated,
    handleTaskDeleted,
    handleToggleWorkspaceItem,
    handleViewChange,
    managedAccounts,
    unmanagedAccounts,
    reloadAccounts,
    instances,
    instancesError,
    isCompactLayout,
    leftSidebarVisible,
    leftWidth,
    mobileSidebarOpen,
    openSettingsDialog,
    openTabs,
    persistLeftWidth,
    persistRightPanelVisible,
    persistRightWidth,
    rightPanelVisible,
    rightWidth,
    selectedSidebarItem,
    selectedSidebarItemId,
    setMobileSidebarOpen,
    settingsDialogOpen,
    settingsInitialSection,
    clearAccountsSelection,
    closeDataBlockMenu,
    closeSettingsDialog,
    toggleLeftSidebarVisible,
    toggleRightPanelVisible,
    workspaceDetailLoading,
    workspaceError,
    workspaceFileContent,
    workspaceFolderSummary,
    workspaceInlineCreate,
    workspaceRenameState,
    workspaceDeleteState,
    workspaceRecentMutation,
    workspaceRefreshPending,
    workspaceRefreshError,
    workspaceRoot,
    workspaceRootName,
    workspaceTreeItems,
    workspaceLoadingPaths,
    cancelWorkspaceInlineCreate,
    submitWorkspaceInlineCreate,
    updateWorkspaceInlineCreateValue,
    cancelWorkspaceRename,
    closeWorkspaceDeleteDialog,
    confirmWorkspaceDelete,
    submitWorkspaceRename,
    updateWorkspaceRenameValue,
  }
}
