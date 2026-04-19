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
import { dataBlocksService } from '@/services/data-blocks'
import { layoutService } from '@/services/layout'
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

export function useAppLayoutState() {
  const tasksSidebar = useTasksSidebarItems()
  const [activeView, setActiveView] = useState<View>('workspace')
  const [leftWidth, setLeftWidth] = useState(() => getStoredNumber(LEFT_WIDTH_STORAGE_KEY, DEFAULT_LEFT_WIDTH))
  const [rightWidth, setRightWidth] = useState(() => getStoredNumber(RIGHT_WIDTH_STORAGE_KEY, DEFAULT_RIGHT_WIDTH))
  const [rightPanelVisible, setRightPanelVisible] = useState(() =>
    getStoredBoolean(RIGHT_PANEL_VISIBLE_STORAGE_KEY, true)
  )
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true)
  const [selectedItemsByView, setSelectedItemsByView] = useState<Record<View, string | null>>({
    workspace: SIDEBAR_ITEMS.workspace[0]?.id ?? null,
    accounts: null,
    'data-blocks': null,
    tasks: null,
  })
  const [centerMode, setCenterMode] = useState<'empty' | 'detail' | 'create-task'>('detail')
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [dataBlockMenuOpen, setDataBlockMenuOpen] = useState(false)
  const [instances, setInstances] = useState<AppInstance[]>(INSTANCE_MOCKS)
  const [instancesError, setInstancesError] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    {
      id: 'workspace',
      title: TAB_META.workspace.title,
      icon: TAB_META.workspace.icon,
    },
  ])

  const currentSidebarItems = useMemo(() => {
    if (activeView === 'tasks') {
      return tasksSidebar.items
    }
    return SIDEBAR_ITEMS[activeView]
  }, [activeView, tasksSidebar.items])
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
    return SIDEBAR_SECTION_CONFIG[activeView]
  }, [activeView, tasksSidebar.error, tasksSidebar.loading])
  const selectedSidebarItemId = selectedItemsByView[activeView]
  const selectedSidebarItem = useMemo<SidebarItem | null>(
    () => currentSidebarItems.find((item) => item.id === selectedSidebarItemId) ?? null,
    [currentSidebarItems, selectedSidebarItemId]
  )

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
  }, [activeView, centerMode, currentSidebarItems, selectedItemsByView])

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

    const nextSelectedId = selectedItemsByView[view] ?? SIDEBAR_ITEMS[view][0]?.id ?? null
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

    if (actionId === 'refresh-accounts' || actionId === 'refresh-workspace') {
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
        const fallbackSelectedId = selectedItemsByView[fallbackTab] ?? SIDEBAR_ITEMS[fallbackTab][0]?.id ?? null
        setCenterMode(fallbackSelectedId ? 'detail' : 'empty')
      }

      return nextTabs.length > 0 ? nextTabs : [prev[0]]
    })
  }

  const handleActivateTab = (tabId: View) => {
    setActiveView(tabId)
    const nextSelectedId = selectedItemsByView[tabId] ?? SIDEBAR_ITEMS[tabId][0]?.id ?? null
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

  const openSettingsDialog = () => {
    setSettingsDialogOpen(true)
  }

  const closeSettingsDialog = () => {
    setSettingsDialogOpen(false)
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
    closeDataBlockMenu,
    closeSettingsDialog,
    toggleLeftSidebarVisible,
    toggleRightPanelVisible,
  }
}
