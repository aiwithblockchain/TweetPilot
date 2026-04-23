import { Bot, Database, FolderOpen, UserRound, Zap } from 'lucide-react'
import type { AccountSource } from '@/services/account'
import type { AppInstance } from '@/types/layout'

export type View = 'workspace' | 'accounts' | 'data-blocks' | 'tasks'
export type TabId = View | 'claude-chat'

export interface OpenTab {
  id: TabId
  title: string
  icon: typeof FolderOpen
}

export interface SidebarItem {
  id: string
  label: string
  description: string
  badge?: string
  badgeTone?: 'default' | 'success' | 'warning' | 'danger'
  group?: 'managed' | 'unmanaged'
  source?: AccountSource
}

export interface SidebarSectionAction {
  id: string
  label: string
  icon?: 'add' | 'add-file' | 'add-folder' | 'refresh'
}

export interface SidebarSectionConfig {
  title: string
  description: string
  actions?: SidebarSectionAction[]
  emptyMessage: string
}

export const LEFT_WIDTH_STORAGE_KEY = 'vscode-layout-left-width'
export const RIGHT_WIDTH_STORAGE_KEY = 'vscode-layout-right-width'
export const RIGHT_PANEL_VISIBLE_STORAGE_KEY = 'vscode-layout-right-visible'

export const DEFAULT_LEFT_WIDTH = 250
export const DEFAULT_RIGHT_WIDTH = 400
export const MIN_LEFT_WIDTH = 180
export const MAX_LEFT_WIDTH = 400
export const MIN_RIGHT_WIDTH = 300
export const MAX_RIGHT_WIDTH = 600

export const INSTANCE_MOCKS: AppInstance[] = [
  {
    id: 'b8311f7d',
    name: 'tweet-xiaohongshu',
    status: 'online',
    lastActive: '2分钟前',
  },
  {
    id: 'a7c22e8f',
    name: 'tweet-backup',
    status: 'offline',
    lastActive: '1小时前',
  },
]

const DATA_BLOCK_ITEMS: SidebarItem[] = [
  { id: 'latest_tweets', label: '最新推文列表', description: '内容流' },
  { id: 'account_basic_data', label: '粉丝统计', description: '账号画像' },
  { id: 'account_interaction_data', label: '推文互动数据', description: '互动报表' },
  { id: 'tweet_time_distribution', label: '推文时间分布', description: '发布时间报表' },
  { id: 'task_execution_stats', label: '任务执行统计', description: '任务报表' },
]

export const SIDEBAR_ITEMS: Record<View, SidebarItem[]> = {
  workspace: [
    { id: 'workspace-root', label: 'TweetPilot', description: '当前工作区根目录' },
    { id: 'workspace-docs', label: 'docs', description: '方案与说明文档' },
    { id: 'workspace-assets', label: 'assets', description: '图片与静态资源' },
  ],
  accounts: [
    { id: 'account-main', label: '@tweetpilot_main', description: '主账号' },
    { id: 'account-growth', label: '@tweetpilot_growth', description: '增长账号' },
    { id: 'account-backup', label: '@tweetpilot_backup', description: '备用账号' },
  ],
  'data-blocks': DATA_BLOCK_ITEMS,
  tasks: [
    { id: 'task-publish', label: '定时发布任务', description: '今天 18:00' },
    { id: 'task-sync', label: '账号同步任务', description: '每 60 秒执行' },
    { id: 'task-review', label: '内容审核任务', description: '待处理 3 条' },
  ],
}

export const SIDEBAR_SECTION_CONFIG: Record<View, SidebarSectionConfig> = {
  workspace: {
    title: 'EXPLORER',
    description: '浏览当前工作区目录并选择文件在中间预览。',
    actions: [
      { id: 'new-file', label: '新建文件', icon: 'add-file' },
      { id: 'new-folder', label: '新建文件夹', icon: 'add-folder' },
      { id: 'refresh-workspace', label: '刷新', icon: 'refresh' },
    ],
    emptyMessage: '当前工作区为空，后续可在这里显示真实目录树。',
  },
  accounts: {
    title: 'TWITTER ACCOUNTS',
    description: '左侧按当前已管理账号与未管理在线账号分组展示，中间查看详情。',
    actions: [{ id: 'refresh-accounts', label: '刷新', icon: 'refresh' }],
    emptyMessage: '当前没有推特账号，后续可在这里接入真实账号数据。',
  },
  'data-blocks': {
    title: 'DATA BLOCKS',
    description: '左侧维护数据积木列表，中间显示积木详情。',
    actions: [{ id: 'add-data-block', label: '新增积木', icon: 'add' }],
    emptyMessage: '当前没有数据积木，点击上方 + 号可新增。',
  },
  tasks: {
    title: 'TASKS',
    description: '左侧查看任务列表，中间查看任务详情或新建任务。',
    actions: [{ id: 'create-task', label: '新增任务', icon: 'add' }],
    emptyMessage: '当前没有任务，点击上方 + 号可创建任务。',
  },
}

export const TAB_META: Record<TabId, { title: string; icon: typeof FolderOpen }> = {
  workspace: { title: 'Workspace', icon: FolderOpen },
  accounts: { title: 'Accounts', icon: UserRound },
  'data-blocks': { title: 'Data Blocks', icon: Database },
  tasks: { title: 'Tasks', icon: Zap },
  'claude-chat': { title: 'Claude Chat', icon: Bot },
}
