import { useEffect, useMemo, useState } from 'react'
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
  TAB_META,
  type OpenTab,
  type SidebarItem,
  type TabId,
  type View,
} from '@/config/layout'
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
  const [activeView, setActiveView] = useState<View>('workspace')
  const [leftWidth, setLeftWidth] = useState(() => getStoredNumber(LEFT_WIDTH_STORAGE_KEY, DEFAULT_LEFT_WIDTH))
  const [rightWidth, setRightWidth] = useState(() => getStoredNumber(RIGHT_WIDTH_STORAGE_KEY, DEFAULT_RIGHT_WIDTH))
  const [rightPanelVisible, setRightPanelVisible] = useState(() =>
    getStoredBoolean(RIGHT_PANEL_VISIBLE_STORAGE_KEY, true)
  )
  const [activeTab, setActiveTab] = useState<TabId>('workspace')
  const [selectedSidebarItemId, setSelectedSidebarItemId] = useState(() => SIDEBAR_ITEMS.workspace[0]?.id ?? '')
  const [isCompactLayout, setIsCompactLayout] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [instances, setInstances] = useState<AppInstance[]>(INSTANCE_MOCKS)
  const [instancesError, setInstancesError] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    {
      id: 'workspace',
      title: TAB_META.workspace.title,
      icon: TAB_META.workspace.icon,
    },
  ])

  const currentSidebarItems = useMemo(() => SIDEBAR_ITEMS[activeView], [activeView])
  const selectedSidebarItem = useMemo<SidebarItem | null>(
    () => currentSidebarItems.find((item) => item.id === selectedSidebarItemId) ?? currentSidebarItems[0] ?? null,
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
    const firstItemId = SIDEBAR_ITEMS[activeView][0]?.id ?? ''
    setSelectedSidebarItemId(firstItemId)
  }, [activeView])

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

  const openTab = (tabId: TabId) => {
    const meta = TAB_META[tabId]
    setOpenTabs((prev) => {
      if (prev.some((tab) => tab.id === tabId)) return prev
      return [...prev, { id: tabId, title: meta.title, icon: meta.icon }]
    })
    setActiveTab(tabId)
  }

  const handleViewChange = (view: View) => {
    setActiveView(view)
    setMobileSidebarOpen(false)
    openTab(view)
  }

  const handleSelectSidebarItem = (itemId: string) => {
    setSelectedSidebarItemId(itemId)
    setMobileSidebarOpen(false)
    openTab(activeView)
  }

  const handleCloseTab = (tabId: TabId) => {
    if (tabId === 'workspace' && openTabs.length === 1) return

    setOpenTabs((prev) => {
      const nextTabs = prev.filter((tab) => tab.id !== tabId)
      const fallbackTab = nextTabs[nextTabs.length - 1]?.id ?? 'workspace'

      if (activeTab === tabId) {
        setActiveTab(fallbackTab)
        if (fallbackTab !== 'claude-chat') {
          setActiveView(fallbackTab as View)
        }
      }

      return nextTabs.length > 0 ? nextTabs : [prev[0]]
    })
  }

  const handleActivateTab = (tabId: TabId) => {
    setActiveTab(tabId)
    if (tabId !== 'claude-chat') {
      setActiveView(tabId as View)
    }
  }

  return {
    activeTab,
    activeView,
    currentSidebarItems,
    handleActivateTab,
    handleCloseTab,
    handleSelectSidebarItem,
    handleViewChange,
    instances,
    instancesError,
    isCompactLayout,
    leftWidth,
    mobileSidebarOpen,
    openTabs,
    persistLeftWidth,
    persistRightPanelVisible,
    persistRightWidth,
    rightPanelVisible,
    rightWidth,
    selectedSidebarItem,
    setMobileSidebarOpen,
  }
}
