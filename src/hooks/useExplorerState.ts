import { useEffect, useState } from 'react'
import { workspaceService } from '@/services'
import type { WorkspaceEntry, WorkspaceFileContent, WorkspaceFolderSummary } from '@/services/workspace/types'

export interface ExplorerNode extends WorkspaceEntry {
  children?: ExplorerNode[]
  isExpanded?: boolean
  isLoaded?: boolean
}

export type ExplorerDetail =
  | { type: 'directory'; data: WorkspaceFolderSummary }
  | { type: 'file'; data: WorkspaceFileContent }
  | { type: 'empty' }

export function useExplorerState() {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [treeData, setTreeData] = useState<ExplorerNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [detail, setDetail] = useState<ExplorerDetail>({ type: 'empty' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialize = async () => {
    try {
      setLoading(true)
      setError(null)
      const currentWorkspace = await workspaceService.getCurrentWorkspace()

      if (!currentWorkspace) {
        setError('未选择工作目录')
        setTreeData([])
        return
      }

      setRootPath(currentWorkspace)
      const entries = await workspaceService.listDirectory(currentWorkspace)
      setTreeData(entries.map(entry => ({ ...entry, isExpanded: false, isLoaded: false })))
    } catch (err) {
      console.error('Failed to initialize explorer:', err)
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  const loadChildren = async (path: string): Promise<ExplorerNode[]> => {
    const entries = await workspaceService.listDirectory(path)
    return entries.map(entry => ({ ...entry, isExpanded: false, isLoaded: false }))
  }

  const updateNodeInTree = (
    nodes: ExplorerNode[],
    targetPath: string,
    updater: (node: ExplorerNode) => ExplorerNode
  ): ExplorerNode[] => {
    return nodes.map(node => {
      if (node.path === targetPath) {
        return updater(node)
      }
      if (node.children) {
        return { ...node, children: updateNodeInTree(node.children, targetPath, updater) }
      }
      return node
    })
  }

  const toggleExpand = async (path: string) => {
    const isCurrentlyExpanded = expandedPaths.has(path)

    if (isCurrentlyExpanded) {
      setExpandedPaths(prev => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
      setTreeData(prev => updateNodeInTree(prev, path, node => ({ ...node, isExpanded: false })))
    } else {
      try {
        setExpandedPaths(prev => new Set(prev).add(path))

        setTreeData(prev => updateNodeInTree(prev, path, node => {
          if (node.isLoaded && node.children) {
            return { ...node, isExpanded: true }
          }
          return { ...node, isExpanded: true }
        }))

        const node = findNode(treeData, path)
        if (!node?.isLoaded) {
          const children = await loadChildren(path)
          setTreeData(prev => updateNodeInTree(prev, path, node => ({
            ...node,
            children,
            isLoaded: true,
            isExpanded: true,
          })))
        }
      } catch (err) {
        console.error('Failed to load children:', err)
        setError(err instanceof Error ? err.message : '加载子目录失败')
        setExpandedPaths(prev => {
          const next = new Set(prev)
          next.delete(path)
          return next
        })
      }
    }
  }

  const findNode = (nodes: ExplorerNode[], targetPath: string): ExplorerNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) return node
      if (node.children) {
        const found = findNode(node.children, targetPath)
        if (found) return found
      }
    }
    return null
  }

  const selectNode = async (path: string) => {
    setSelectedPath(path)

    try {
      setLoading(true)
      setError(null)

      const node = findNode(treeData, path)
      if (!node) {
        setDetail({ type: 'empty' })
        return
      }

      if (node.kind === 'directory') {
        const summary = await workspaceService.getFolderSummary(path)
        setDetail({ type: 'directory', data: summary })
      } else {
        const content = await workspaceService.readFile(path)
        setDetail({ type: 'file', data: content })
      }
    } catch (err) {
      console.error('Failed to load node detail:', err)
      setError(err instanceof Error ? err.message : '加载详情失败')
      setDetail({ type: 'empty' })
    } finally {
      setLoading(false)
    }
  }

  const refresh = async () => {
    await initialize()
    if (selectedPath) {
      await selectNode(selectedPath)
    }
  }

  useEffect(() => {
    void initialize()
  }, [])

  return {
    rootPath,
    treeData,
    expandedPaths,
    selectedPath,
    detail,
    loading,
    error,
    toggleExpand,
    selectNode,
    refresh,
  }
}
