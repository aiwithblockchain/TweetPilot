import { Bot, Database, FolderOpen, Settings, UserRound, Zap } from 'lucide-react'
import type { AppInstance } from '@/types/layout'

export type View = 'workspace' | 'accounts' | 'data-blocks' | 'tasks' | 'settings'
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

export const SIDEBAR_ITEMS: Record<View, SidebarItem[]> = {
  workspace: [
    { id: 'ws-default', label: 'TweetPilot 工作区', description: '当前项目总览' },
    { id: 'ws-assets', label: '资源面板', description: '组件与素材目录' },
    { id: 'ws-notes', label: '重构说明', description: 'UI 重构执行记录' },
  ],
  accounts: [
    { id: 'acc-main', label: '@tweetpilot_main', description: '主账号 / 在线' },
    { id: 'acc-growth', label: '@tweetpilot_growth', description: '增长账号 / 空闲' },
    { id: 'acc-backup', label: '@tweetpilot_backup', description: '备用账号 / 离线' },
  ],
  'data-blocks': [
    { id: 'db-trending', label: 'Trending Topics', description: '热点追踪卡片' },
    { id: 'db-mentions', label: 'Mentions Monitor', description: '互动监控卡片' },
    { id: 'db-content', label: 'Content Queue', description: '内容候选池' },
  ],
  tasks: [
    { id: 'task-publish', label: '定时发布任务', description: '今天 18:00' },
    { id: 'task-sync', label: '账号同步任务', description: '每 60 秒执行' },
    { id: 'task-review', label: '内容审核任务', description: '待处理 3 条' },
  ],
  settings: [
    { id: 'setting-account', label: '账号设置', description: 'Google 登录与配额' },
    { id: 'setting-system', label: '系统偏好', description: '语言 / 主题 / LocalBridge' },
  ],
}

export const TAB_META: Record<TabId, { title: string; icon: typeof FolderOpen }> = {
  workspace: { title: 'Workspace', icon: FolderOpen },
  accounts: { title: 'Accounts', icon: UserRound },
  'data-blocks': { title: 'Data Blocks', icon: Database },
  tasks: { title: 'Tasks', icon: Zap },
  settings: { title: 'Settings', icon: Settings },
  'claude-chat': { title: 'Claude Chat', icon: Bot },
}
