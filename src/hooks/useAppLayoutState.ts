import { useEffect, useMemo, useState } from 'react'
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
  type View,
} from '@/config/layout'
import type { SidebarTreeItem } from '@/components/LeftSidebar'
import { useToast } from '@/contexts/ToastContext'
import { accountService, dataBlocksService, workspaceService } from '@/services'
import { layoutService } from '@/services/layout'
import type { WorkspaceEntry, WorkspaceFileContent, WorkspaceFolderSummary } from '@/services/workspace'
import type { AppInstance } from '@/types/layout'

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

export function useAppLayoutState() {
  const tasksSidebar = useTasksSidebarItems()
  const toast = useToast()
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
  const [accountsError, setAccountsError] = useState<string | null>(null)
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
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0)
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
    if (activeView === 'accounts' && accountsError) {
      return {
        ...SIDEBAR_SECTION_CONFIG.accounts,
        description: `账号列表加载失败：${accountsError}`,
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
  }, [activeView, tasksSidebar.error, tasksSidebar.loading, accountsError, accountsLoading, workspaceRootName])

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

      for (const entries of Object.values(workspaceTree)) {
        const match = entries.find((entry) => entry.path === selectedSidebarItemId)
        if (match) {
          return {
            id: match.path,
            label: match.name,
            description: getEntryDescription(match),
          }
        }
      }

      return null
    }

    return currentSidebarItems.find((item) => item.id === selectedSidebarItemId) ?? null
  }, [activeView, currentSidebarItems, selectedSidebarItemId, workspaceRoot, workspaceRootName, workspaceTree])

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

  useEffect(() => {
    let cancelled = false

    const loadWorkspaceRoot = async () => {
      try {
        const currentWorkspace = await workspaceService.getCurrentWorkspace()
        if (cancelled) return

        if (!currentWorkspace) {
          setWorkspaceRoot(null)
          setWorkspaceTree({})
          setExpandedWorkspacePaths({})
          setSelectedItemsByView((prev) => ({ ...prev, workspace: null }))
          setCenterMode(activeView === 'workspace' ? 'empty' : centerMode)
          return
        }

        const normalizedName = currentWorkspace.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? currentWorkspace
        setWorkspaceRoot(currentWorkspace)
        setWorkspaceRootName(normalizedName)
        setExpandedWorkspacePaths({ [currentWorkspace]: true })
        const entries = await workspaceService.listDirectory(currentWorkspace)
        if (cancelled) return

        setWorkspaceTree({ [currentWorkspace]: entries })
        setSelectedItemsByView((prev) => ({
          ...prev,
          workspace: prev.workspace ?? currentWorkspace,
        }))
        if (activeView === 'workspace') {
          setCenterMode('detail')
        }
      } catch (error) {
        if (cancelled) return
        setWorkspaceError(error instanceof Error ? error.message : '工作区加载失败')
      }
    }

    void loadWorkspaceRoot()

    return () => {
      cancelled = true
    }
  }, [workspaceRefreshKey])

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
    let cancelled = false

    const loadAccounts = async () => {
      setAccountsLoading(true)
      try {
        const accounts = await accountService.getMappedAccounts()
        if (cancelled) return

        const items: SidebarItem[] = accounts.map((account) => ({
          id: account.screenName,
          label: account.screenName,
          description: account.displayName,
        }))

        setAccountItems(items)
        setAccountsError(null)
      } catch (error) {
        if (cancelled) return
        setAccountsError(error instanceof Error ? error.message : '账号列表获取失败')
      } finally {
        if (!cancelled) {
          setAccountsLoading(false)
        }
      }
    }

    void loadAccounts()
    const interval = window.setInterval(loadAccounts, 60000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
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
    const parentPath = (() => {
      const selectedPath = selectedItemsByView.workspace
      if (!selectedPath) return workspaceRoot
      if (selectedPath === workspaceRoot) return workspaceRoot

      const selectedEntry = Object.values(workspaceTree)
        .flat()
        .find((entry) => entry.path === selectedPath)

      if (selectedEntry?.kind === 'directory') {
        return selectedEntry.path
      }

      return selectedPath.slice(0, selectedPath.lastIndexOf('/')) || workspaceRoot
    })()

    if (!parentPath) {
      toast.error('当前没有可用的工作区目录')
      return
    }

    const rawName = window.prompt(kind === 'file' ? '请输入新文件名' : '请输入新文件夹名')
    const name = rawName?.trim()
    if (!name) {
      return
    }

    try {
      const created = kind === 'file'
        ? await workspaceService.createFile({ parentPath, name })
        : await workspaceService.createFolder({ parentPath, name })

      await loadWorkspaceChildren(parentPath, true)
      if (kind === 'folder') {
        setExpandedWorkspacePaths((prev) => ({ ...prev, [parentPath]: true }))
      }
      setSelectedItemsByView((prev) => ({ ...prev, workspace: created.path }))
      setCenterMode('detail')
      toast.success(kind === 'file' ? '文件已创建' : '文件夹已创建')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '创建失败')
    }
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
          const expandedPaths = Object.entries(expandedWorkspacePaths)
            .filter(([, expanded]) => expanded)
            .map(([path]) => path)
          await Promise.all(expandedPaths.map((path) => loadWorkspaceChildren(path, true)))
          if (selectedItemsByView.workspace) {
            setCenterMode('detail')
          }
          toast.success('工作区已刷新')
        } catch (error) {
          toast.error(error instanceof Error ? error.message : '刷新失败')
        }
      }
      return
    }

    if (actionId === 'refresh-accounts') {
      try {
        setAccountsLoading(true)
        await accountService.refreshAllAccountsStatus()
        const accounts = await accountService.getMappedAccounts()
        const items: SidebarItem[] = accounts.map((account) => ({
          id: account.screenName,
          label: account.screenName,
          description: account.displayName,
        }))
        setAccountItems(items)
        setAccountsError(null)
        toast.success('账号列表已刷新')
      } catch (error) {
        const message = error instanceof Error ? error.message : '刷新账号失败'
        setAccountsError(message)
        toast.error(message)
      } finally {
        setAccountsLoading(false)
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

  const handleCloseTab = (tabId: View) => {
    if (tabId === 'workspace' && openTabs.length === 1) return

    setOpenTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId)
      const fallbackTab = nextTabs[nextTabs.length - 1]?.id ?? 'workspace'

      if (activeView === tabId) {
        setActiveView(fallbackTab)
        const fallbackSelectedId = fallbackTab === 'workspace'
          ? selectedItemsByView.workspace ?? workspaceRoot
          : selectedItemsByView[fallbackTab] ?? SIDEBAR_ITEMS[fallbackTab][0]?.id ?? null
        setCenterMode(fallbackSelectedId ? 'detail' : 'empty')
      }

      return nextTabs.length > 0 ? nextTabs : [prev[0]]
    })
  }

  const handleActivateTab = (tabId: View) => {
    setActiveView(tabId)
    const nextSelectedId = tabId === 'workspace'
      ? selectedItemsByView.workspace ?? workspaceRoot
      : selectedItemsByView[tabId] ?? SIDEBAR_ITEMS[tabId][0]?.id ?? null
    if (nextSelectedId && !selectedItemsByView[tabId]) {
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
    persistRightPanelVisible(!rightPanelVisible)
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
    closeDataBlockMenu,
    closeSettingsDialog,
    toggleLeftSidebarVisible,
    toggleRightPanelVisible,
    workspaceDetailLoading,
    workspaceError,
    workspaceFileContent,
    workspaceFolderSummary,
    workspaceRoot,
    workspaceRootName,
    workspaceTreeItems,
    workspaceLoadingPaths,
  }
}
