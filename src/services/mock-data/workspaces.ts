import type { WorkspaceHistory } from '../workspace/types'

export const defaultCurrentWorkspace: string | null = null

export const defaultRecentWorkspaces: WorkspaceHistory[] = [
  {
    path: '/Users/demo/projects/tweetpilot-sample',
    name: 'tweetpilot-sample',
    lastAccessed: '2026-04-15T10:30:00.000Z',
  },
  {
    path: '/Users/demo/projects/marketing-workbench',
    name: 'marketing-workbench',
    lastAccessed: '2026-04-14T09:20:00.000Z',
  },
]
