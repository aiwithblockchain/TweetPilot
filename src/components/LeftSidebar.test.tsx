import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LeftSidebar, type SidebarTreeItem } from './LeftSidebar'
import type { SidebarSectionConfig } from '@/config/layout'
import type { WorkspaceInlineCreateState } from '@/hooks/useAppLayoutState'

const workspaceSection: SidebarSectionConfig = {
  title: 'EXPLORER',
  description: '浏览当前工作区目录并选择文件在中间预览。',
  actions: [
    { id: 'new-file', label: '新建文件', icon: 'add-file' },
    { id: 'new-folder', label: '新建文件夹', icon: 'add-folder' },
    { id: 'refresh-workspace', label: '刷新', icon: 'refresh' },
    { id: 'rename-workspace-entry', label: '重命名', icon: 'rename' },
    { id: 'delete-workspace-entry', label: '删除', icon: 'delete' },
  ],
  emptyMessage: '当前工作区为空',
}

const treeItems: SidebarTreeItem[] = [
  {
    id: '/workspace/src',
    label: 'src',
    description: '文件夹',
    depth: 0,
    kind: 'directory',
    expanded: true,
    isBranch: true,
    icon: 'folder',
  },
  {
    id: '/workspace/src/index.ts',
    label: 'index.ts',
    description: 'TS 文件',
    depth: 1,
    kind: 'file',
    expanded: false,
    isBranch: false,
    icon: 'text',
  },
]

afterEach(() => {
  cleanup()
})

function renderSidebar(overrides?: Partial<ComponentProps<typeof LeftSidebar>>) {
  const defaultInlineCreate: WorkspaceInlineCreateState = {
    active: false,
    kind: null,
    parentPath: null,
    value: '',
    pending: false,
    error: null,
  }

  const defaultRenameState = {
    active: false,
    path: null,
    value: '',
    pending: false,
    error: null,
  }

  const defaultDeleteState = {
    open: false,
    path: null,
    label: '',
    pending: false,
    error: null,
  }

  const props: ComponentProps<typeof LeftSidebar> = {
    activeView: 'workspace',
    width: 280,
    items: [],
    treeItems,
    section: workspaceSection,
    selectedItemId: '/workspace/src',
    workspaceInlineCreate: defaultInlineCreate,
    workspaceRenameState: defaultRenameState,
    workspaceDeleteState: defaultDeleteState,
    workspaceRecentMutation: { path: null, kind: null, timestamp: null },
    workspaceRefreshPending: false,
    workspaceRefreshError: null,
    onSelectItem: vi.fn(),
    onAction: vi.fn(),
    onToggleTreeItem: vi.fn(),
    onWorkspaceInlineCreateChange: vi.fn(),
    onWorkspaceInlineCreateSubmit: vi.fn(),
    onWorkspaceInlineCreateCancel: vi.fn(),
    onWorkspaceRenameChange: vi.fn(),
    onWorkspaceRenameSubmit: vi.fn(),
    onWorkspaceRenameCancel: vi.fn(),
    ...overrides,
  }

  render(<LeftSidebar {...props} />)
  return props
}

describe('LeftSidebar workspace inline create', () => {
  it('renders inline create input and submits/cancels with keyboard', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const onChange = vi.fn()

    renderSidebar({
      workspaceInlineCreate: {
        active: true,
        kind: 'file',
        parentPath: '/workspace/src',
        value: 'draft.ts',
        pending: false,
        error: null,
      },
      onWorkspaceInlineCreateSubmit: onSubmit,
      onWorkspaceInlineCreateCancel: onCancel,
      onWorkspaceInlineCreateChange: onChange,
    })

    const input = screen.getByPlaceholderText('输入新文件名称')
    fireEvent.change(input, { target: { value: 'next.ts' } })
    expect(onChange).toHaveBeenCalledWith('next.ts')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders root-level inline create when parent path is not visible in tree', () => {
    renderSidebar({
      workspaceInlineCreate: {
        active: true,
        kind: 'file',
        parentPath: '/workspace',
        value: 'root.ts',
        pending: false,
        error: null,
      },
    })

    expect(screen.getByPlaceholderText('输入新文件名称')).toBeTruthy()
    expect(screen.getByDisplayValue('root.ts')).toBeTruthy()
  })

  it('shows inline create error and pending state', () => {
    renderSidebar({
      workspaceInlineCreate: {
        active: true,
        kind: 'folder',
        parentPath: '/workspace/src',
        value: 'components',
        pending: true,
        error: '当前目录下已存在同名项目',
      },
      workspaceRefreshPending: true,
    })

    expect(screen.getByText('当前目录下已存在同名项目')).toBeTruthy()
    expect(screen.getByText('创建中...')).toBeTruthy()
    expect(screen.getByText('正在刷新工作区...')).toBeTruthy()
    expect(screen.getAllByLabelText('刷新').some((element) => element.hasAttribute('disabled'))).toBe(true)
  })

  it('renders rename input and submits/cancels with keyboard', () => {
    const onSubmit = vi.fn()
    const onCancel = vi.fn()
    const onChange = vi.fn()

    renderSidebar({
      workspaceRenameState: {
        active: true,
        path: '/workspace/src/index.ts',
        value: 'renamed.ts',
        pending: false,
        error: null,
      },
      onWorkspaceRenameSubmit: onSubmit,
      onWorkspaceRenameCancel: onCancel,
      onWorkspaceRenameChange: onChange,
    })

    const input = screen.getByPlaceholderText('输入新名称')
    fireEvent.change(input, { target: { value: 'final.ts' } })
    expect(onChange).toHaveBeenCalledWith('final.ts')

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('opens workspace context menu and triggers action', () => {
    const onAction = vi.fn()

    renderSidebar({ onAction })

    fireEvent.contextMenu(screen.getByText('src'))
    expect(screen.getByRole('menu')).toBeTruthy()

    fireEvent.click(screen.getByRole('menuitem', { name: '重命名' }))
    expect(onAction).toHaveBeenCalledWith('rename-workspace-entry')
  })

  it('hides create actions in context menu for file nodes', () => {
    renderSidebar()

    fireEvent.contextMenu(screen.getByText('index.ts'))
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: '新建文件' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: '新建文件夹' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: '重命名' })).toBeTruthy()
  })

  it('highlights recently mutated tree item', () => {
    renderSidebar({
      workspaceRecentMutation: {
        path: '/workspace/src/index.ts',
        kind: 'rename',
        timestamp: Date.now(),
      },
    })

    const itemButton = screen.getByText('index.ts').closest('button')
    expect(itemButton?.className).toContain('border-[#0E639C]')
  })

  it('disables rename and delete actions while delete is pending', () => {
    renderSidebar({
      workspaceDeleteState: {
        open: true,
        path: '/workspace/src/index.ts',
        label: 'index.ts',
        pending: true,
        error: null,
      },
    })

    expect(screen.getByLabelText('重命名').hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('删除').hasAttribute('disabled')).toBe(true)
  })

  it('cancels inline create on blur when not pending', () => {
    const onCancel = vi.fn()

    renderSidebar({
      workspaceInlineCreate: {
        active: true,
        kind: 'file',
        parentPath: '/workspace/src',
        value: 'draft.ts',
        pending: false,
        error: null,
      },
      onWorkspaceInlineCreateCancel: onCancel,
    })

    fireEvent.blur(screen.getByPlaceholderText('输入新文件名称'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
