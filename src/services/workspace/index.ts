import { serviceMode } from '../runtime'
import { workspaceMockService } from './mock'
import { workspaceTauriService } from './tauri'

export { type WorkspaceHistory, type WorkspaceService } from './types'

export const workspaceService = serviceMode === 'tauri' ? workspaceTauriService : workspaceMockService
